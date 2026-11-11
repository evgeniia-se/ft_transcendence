// Owner: Track 2 (Person B — WebSocket layer)
import { broadcastToProject } from "./broadcast.js";
export function broadcastPresence(projectId, userId, status) {
    broadcastToProject(projectId, { type: "presence", payload: { userId, status } });
}
// Also covers reconnects: the client re-emits "join_project" on every "connect" event, so this
// runs again after a drop. Presence alone doesn't replay missed mutations — the client still
// refetches board state over HTTP after reconnecting.
export function handleReconnect(socketId, projectId, userId) {
    broadcastPresence(projectId, userId, "joined");
}
//# sourceMappingURL=presence.js.map