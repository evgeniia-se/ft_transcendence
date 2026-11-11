import { getIOIfReady } from "./hub.js";
// broadcastToProject sends an event to every connected client in a project room.
// Called from the kanban services after each mutation, so every caller (HTTP routes, public API,
// git webhooks) broadcasts. No-op when the hub isn't running, so the services work without Socket.IO.
export function broadcastToProject(projectId, event) {
    getIOIfReady()?.to(projectId).emit(event.type, event.payload);
}
// buildCardMutationEvent constructs the event payload for a card create/update/move/delete, called from card.service.ts.
export function buildCardMutationEvent(eventType, card) {
    return { type: eventType, payload: card };
}
//# sourceMappingURL=broadcast.js.map