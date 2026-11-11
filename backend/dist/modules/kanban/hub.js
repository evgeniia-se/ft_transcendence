// Owner: Track 2 (Person B — WebSocket layer)
import { Server as SocketIOServer } from "socket.io";
import { broadcastPresence, handleReconnect } from "./presence.js";
import { validateJwt, JwtExpiredError } from "../auth/jwt.service.js";
import { getUserRole } from "../permissions/roles.service.js";
let io = null;
export function createKanbanHub(httpServer) {
    io = new SocketIOServer(httpServer, {
        // `||` not `??`: docker-compose passes CORS_ORIGIN through as "" when unset in .env
        cors: { origin: process.env.CORS_ORIGIN || "*" },
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
            socket.data.userId = validateJwt(token).userId;
            next();
        }
        catch (err) {
            next(new Error(err instanceof JwtExpiredError ? "token_expired" : "unauthorized"));
        }
    });
    io.on("connection", (socket) => {
        socket.on("join_project", async (projectId) => {
            if (typeof projectId !== "string" || projectId.length === 0)
                return;
            // only members of the project (any role) may listen to its room
            const role = await getUserRole(projectId, socket.data.userId);
            if (!role) {
                socket.emit("join_denied", { projectId });
                return;
            }
            socket.data.projectId = projectId;
            socket.join(projectId);
            // presence events only say who joins/leaves from now on: tell the newcomer who is already here
            const peers = await socket.nsp.in(projectId).fetchSockets();
            const userIds = [...new Set(peers.map((peer) => peer.data.userId))];
            socket.emit("presence_snapshot", { projectId, userIds });
            handleReconnect(socket.id, projectId, socket.data.userId);
        });
        socket.on("leave_project", (projectId) => {
            if (typeof projectId !== "string" || projectId.length === 0)
                return;
            if (!socket.rooms.has(projectId))
                return;
            socket.leave(projectId);
            broadcastPresence(projectId, socket.data.userId, "left");
            if (socket.data.projectId === projectId) {
                socket.data.projectId = undefined;
            }
        });
        socket.on("disconnect", () => {
            if (socket.data.projectId) {
                broadcastPresence(socket.data.projectId, socket.data.userId, "left");
            }
        });
    });
    return io;
}
// getIOIfReady returns null instead of throwing when the hub isn't running (sandbox server, scripts)
export function getIOIfReady() {
    return io;
}
export function getIO() {
    if (!io) {
        throw new Error("Socket.IO server not initialized — call createKanbanHub first");
    }
    return io;
}
//# sourceMappingURL=hub.js.map