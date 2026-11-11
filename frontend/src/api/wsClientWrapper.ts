// Owner: Track 1 (Foundation, Auth, and API infrastructure)
// Responsible for: the low-level, feature-agnostic Socket.IO connection wrapper (connect/reconnect/emit) that Track 2 Person B's Kanban-specific client builds on

import { io } from "socket.io-client";

const RETRY_BASE_MS = 5000;
const RETRY_MAX_MS = 20000;

type MessageHandler = (event: string, data: unknown) => void;

export interface SocketConnection {
	emit: (event: string, data: unknown) => void;
	onAny: (handler: MessageHandler) => void;// onAny receives every server event as (eventName, firstPayloadArgument)
	// onConnect fires on the first connect AND on every automatic reconnect. Socket.IO rooms live on the
	// server-side socket, so a reconnect lands in no room: feature clients must re-emit their join event
	// (e.g. kanban's "join_project") from this callback, not just once after creating the connection
	onConnect: (handler: () => void) => void;
	onConnectError: (handler: (error: Error) => void) => void;// onConnectError fires when a connection attempt fails
	onDisconnect: (handler: () => void) => void;// fires when an established connection drops
	disconnect: () => void;
}

// createSocketConnection opens a Socket.IO connection to the backend hub and returns a handle for emitting/subscribing
// url is the server origin (pass window.location.origin).
// The JWT travels in the handshake auth payload (socket.handshake.auth.token). hub.ts verifies it before accepting
// the connection and refuses it with the error message "unauthorized" or "token_expired" (see onConnectError).
export function createSocketConnection(url: string, authToken: string): SocketConnection {
	// Socket.IO's built-in reconnection (with backoff) replaces the manual reconnect logic a raw WebSocket wrapper would need
	const socket = io(url, {
		auth: { token: authToken },
		reconnectionDelay: RETRY_BASE_MS,
		reconnectionDelayMax: RETRY_MAX_MS,
		randomizationFactor: 0.1,
	});

	// Socket.IO only retries by itself when the connection was lost on the network side. When the server closed it
	// (expired token, ...) nothing comes back unless we ask: retry after 5 s, 10 s, then every 20 s.
	let serverRetries = 0;
	let serverRetryTimer: ReturnType<typeof setTimeout> | undefined;
	socket.on("connect", () => {
		serverRetries = 0;
	});
	socket.on("disconnect", (reason) => {
		if (reason !== "io server disconnect") return;
		clearTimeout(serverRetryTimer);
		serverRetryTimer = setTimeout(() => socket.connect(), Math.min(RETRY_BASE_MS * 2 ** serverRetries, RETRY_MAX_MS));
		serverRetries += 1;
	});
	socket.on("connect_error", () => {
		if (socket.active) return;
		clearTimeout(serverRetryTimer);
		serverRetryTimer = setTimeout(() => socket.connect(), Math.min(RETRY_BASE_MS * 2 ** serverRetries, RETRY_MAX_MS));
		serverRetries += 1;
	});

	return {
		emit: (event, data) => {
			socket.emit(event, data);
		},
		onAny: (handler) => {
			socket.onAny((event: string, ...args: unknown[]) => handler(event, args[0]));
		},
		onConnect: (handler) => {
			socket.on("connect", handler);
		},
		onConnectError: (handler) => {
			socket.on("connect_error", handler);
		},
		onDisconnect: (handler) => {
			socket.on("disconnect", handler);
		},
		disconnect: () => {
			clearTimeout(serverRetryTimer);
			socket.disconnect();
		},
	};
}
