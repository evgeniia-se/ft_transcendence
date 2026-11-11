// Owner: Track 2 (Person B — WebSocket layer)
import { broadcastToProject } from "./broadcast.js";
import { getIOIfReady } from "./hub.js";
import { projectRoom } from "./rooms.js";

export function broadcastPresence(projectId: string, userId: string, status: "joined" | "left"): void {
  broadcastToProject(projectId, { type: "presence", payload: { userId, status } });
}

// userIsInProject tells whether the user still has a connection in the project room, apart from `exceptSocketId`.
// A person can have several tabs open: closing one must not show them as gone while another is still there.
export async function userIsInProject(projectId: string, userId: string, exceptSocketId?: string): Promise<boolean> {
  const peers = (await getIOIfReady()?.in(projectRoom(projectId)).fetchSockets()) ?? [];
  return peers.some((peer) => peer.id !== exceptSocketId && peer.data.userId === userId);
}

// broadcastLeftIfGone says "left" only when that was the user's last connection to the project.
export async function broadcastLeftIfGone(projectId: string, userId: string, exceptSocketId?: string): Promise<void> {
  if (!(await userIsInProject(projectId, userId, exceptSocketId))) broadcastPresence(projectId, userId, "left");
}

// Also covers reconnects: the client re-emits "join_project" on every "connect" event, so this
// runs again after a drop. Presence alone doesn't replay missed mutations — the client still
// refetches board state over HTTP after reconnecting.
export function handleReconnect(socketId: string, projectId: string, userId: string): void {
  broadcastPresence(projectId, userId, "joined");
}
