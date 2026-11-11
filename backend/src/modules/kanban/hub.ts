// Owner: Track 2 (Person B — WebSocket layer)

import { Server as SocketIOServer } from "socket.io";
import type { Server as HttpServer } from "http";
import { broadcastLeftIfGone, handleReconnect } from "./presence.js";
import { validateJwt, JwtExpiredError } from "../auth/jwt.service.js";
import { userRoom } from "./rooms.js";
import { createTokenBucket } from "./socketLimit.js";
import { SOCKET_ROLE_TTL_MS, getUserRole } from "../permissions/roles.service.js";
import { registerWhiteboardEvents } from "../whiteboard/whiteboard.realtime.js";
import { registerNoteCollabHandlers } from "../notes/notes.collab.js";

declare module "fastify" {
  interface FastifyInstance {
    io: SocketIOServer;
  }
}

let io: SocketIOServer | null = null;

export function createKanbanHub(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    // `||` not `??`: docker-compose passes CORS_ORIGIN through as "" when unset in .env
    cors: { origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim()) : process.env.NODE_ENV === "production" ? false : "*" },
    // whiteboard deltas can carry many shapes (the HTTP save allows 5 MiB)
    maxHttpBufferSize: 5 * 1024 * 1024,
  });

  // The JWT sent in the handshake (auth.token) is verified here, the same way requireAuth does for HTTP.
  // socket.data.userId is the verified user id, never the raw token.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token !== "string" || token.length === 0) {
      next(new Error("unauthorized"));
      return;
    }
    try {
      const claims = validateJwt(token);
      socket.data.userId = claims.userId;
      socket.data.tokenExpiresAt = claims.exp * 1000;
      next();
    } catch (err) {
      next(new Error(err instanceof JwtExpiredError ? "token_expired" : "unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    // personal room: notifications for this user reach every tab, wherever they are in the app
    socket.join(userRoom(socket.data.userId));
    registerWhiteboardEvents(socket);

    registerNoteCollabHandlers(socket);

    const joinedProjects = new Set<string>();
    const takeJoinToken = createTokenBucket(10, 1);

    const expiry = setTimeout(
      () => socket.disconnect(true),
      Math.min(Math.max(socket.data.tokenExpiresAt - Date.now(), 0), 2 ** 31 - 1),
    );
    const roleCheck = setInterval(() => {
      for (const id of [...joinedProjects]) {
        void getUserRole(id, socket.data.userId).then((role) => {
          if (role || !joinedProjects.has(id)) return;
          joinedProjects.delete(id);
          socket.leave(id);
          void broadcastLeftIfGone(id, socket.data.userId, socket.id);
        });
      }
    }, SOCKET_ROLE_TTL_MS);

    socket.on("join_project", async (projectId: string) => {
      if (typeof projectId !== "string" || projectId.length === 0) return;
      if (!takeJoinToken()) return;
      // only members of the project (any role) may listen to its room
      const role = await getUserRole(projectId, socket.data.userId);
      if (!role) {
        socket.emit("join_denied", { projectId });
        return;
      }
      joinedProjects.add(projectId);
      socket.join(projectId);
      // presence events only say who joins/leaves from now on: tell the newcomer who is already here
      const peers = await socket.nsp.in(projectId).fetchSockets();
      const userIds = [...new Set(peers.map((peer) => peer.data.userId as string))];
      socket.emit("presence_snapshot", { projectId, userIds });
      handleReconnect(socket.id, projectId, socket.data.userId);
    });

    socket.on("leave_project", (projectId: string) => {
      if (typeof projectId !== "string" || projectId.length === 0) return;
      if (!socket.rooms.has(projectId)) return;
      socket.leave(projectId);
      joinedProjects.delete(projectId);
      void broadcastLeftIfGone(projectId, socket.data.userId, socket.id);
    });

    socket.on("disconnect", () => {
      clearTimeout(expiry);
      clearInterval(roleCheck);
      for (const id of joinedProjects) void broadcastLeftIfGone(id, socket.data.userId, socket.id);
      joinedProjects.clear();
    });
  });

  return io;
}

// getIOIfReady returns null instead of throwing when the hub isn't running (sandbox server, scripts)
export function getIOIfReady(): SocketIOServer | null {
  return io;
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error("Socket.IO server not initialized — call createKanbanHub first");
  }
  return io;
}
