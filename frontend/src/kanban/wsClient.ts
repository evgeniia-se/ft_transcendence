// Owner: Track 2 (Person B — WebSocket layer)
// Responsible for: the Kanban-specific Socket.IO connection — authenticates with the session JWT, joins
// the project room (again after every reconnect, since rooms live on the server-side socket) and forwards
// every server event to the board store.
import { createSocketConnection } from "../api/wsClientWrapper";
import { getStoredToken, clearAuthSession } from "../auth/authClient";
import { loginUrl } from "../shared/session";

export interface KanbanSocketHandlers {
  // every event the server emits (card_created, list_updated, presence, ...)
  onEvent: (event: string, payload: unknown) => void;
  // the connection came back after a drop: events were missed in between, the caller must refetch
  onReconnect: () => void;
  // the live connection is up (true) or dropped (false)
  onStatus?: (connected: boolean) => void;
}

// connectKanbanSocket returns a function that closes the connection
export function connectKanbanSocket(projectId: string, handlers: KanbanSocketHandlers): () => void {
  const token = getStoredToken();
  if (!token) {
    redirectToLogin();
    return () => {};
  }

  const socket = createSocketConnection(window.location.origin, token);
  let connectedBefore = false;

  socket.onConnect(() => {
    handlers.onStatus?.(true);
    socket.emit("join_project", projectId);
    if (connectedBefore) {
      handlers.onReconnect();
    }
    connectedBefore = true;
  });

  socket.onDisconnect(() => handlers.onStatus?.(false));

  // hub.ts rejects the handshake with these messages when the JWT is missing, invalid or expired
  socket.onConnectError((error) => {
    handlers.onStatus?.(false);
    if (error.message === "unauthorized" || error.message === "token_expired") {
      redirectToLogin();
    }
  });

  socket.onAny(handlers.onEvent);

  return socket.disconnect;
}

function redirectToLogin(): void {
  clearAuthSession();
  window.location.href = loginUrl();
}
