// Owner: Track 4 (Whiteboard, notes, and supporting modules)
// Responsible for: syncing a Yjs document with the server over the socket hub
import {
	applyAwarenessUpdate,
	encodeAwarenessUpdate,
	removeAwarenessStates,
	type Awareness,
} from "y-protocols/awareness";
import * as Y from "yjs";
import { createSocketConnection } from "../api/wsClientWrapper";
import { getStoredToken, clearAuthSession } from "../auth/authClient";
import { loginUrl } from "../shared/session";

export interface NoteCollabHandlers {
	onSynced: (canEdit: boolean) => void;
	onDenied: () => void;
	onDeleted: () => void;
	onStatus: (connected: boolean) => void;
}

interface SyncMessage {
	noteId: string;
	update: Uint8Array;
	stateVector: Uint8Array;
	canEdit: boolean;
}

// marks updates from the server so they are not sent back
const REMOTE = Symbol("remote");

export function connectNoteCollab(
	noteId: string,
	doc: Y.Doc,
	awareness: Awareness,
	handlers: NoteCollabHandlers,
): () => void {
	const token = getStoredToken();
	if (!token) {
		redirectToLogin();
		return () => {};
	}

	const socket = createSocketConnection(window.location.origin, token);
	let canEdit = false;

	const onLocalUpdate = (update: Uint8Array, origin: unknown): void => {
		if (origin === REMOTE || !canEdit) return;
		socket.emit("note_update", { noteId, update });
	};
	doc.on("update", onLocalUpdate);

	let joined = false;
	const sendAwareness = (clientIds: number[]): void => {
		if (!joined) return;
		socket.emit("note_awareness", {
			noteId,
			clientId: awareness.clientID,
			update: encodeAwarenessUpdate(awareness, clientIds),
		});
	};
	const onAwarenessChange = (
		{ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
		origin: unknown,
	): void => {
		if (origin === REMOTE) return;
		sendAwareness([...added, ...updated, ...removed].filter((id) => id === awareness.clientID));
	};
	awareness.on("update", onAwarenessChange);
	const forgetOthers = (): void => {
		const others = [...awareness.getStates().keys()].filter((id) => id !== awareness.clientID);
		removeAwarenessStates(awareness, others, REMOTE);
	};

	// rooms live on the server socket so join again after every reconnect
	socket.onConnect(() => {
		handlers.onStatus(true);
		socket.emit("note_join", { noteId, stateVector: Y.encodeStateVector(doc) });
	});

	socket.onDisconnect(() => {
		canEdit = false;
		joined = false;
		forgetOthers(); // their cursors would freeze while offline
		handlers.onStatus(false);
	});

	socket.onConnectError((error) => {
		handlers.onStatus(false);
		if (error.message === "unauthorized" || error.message === "token_expired") {
			redirectToLogin();
		}
	});

	socket.onAny((event, payload) => {
		const msg = payload as { noteId?: string; update?: unknown } | undefined;
		if (msg?.noteId !== noteId) return;

		if (event === "note_sync") {
			const sync = payload as SyncMessage;
			Y.applyUpdate(doc, toBytes(sync.update), REMOTE);
			canEdit = sync.canEdit;
			// what we wrote while offline that the server does not have yet
			const missing = Y.encodeStateAsUpdate(doc, toBytes(sync.stateVector));
			if (canEdit && missing.byteLength > 2) {
				socket.emit("note_update", { noteId, update: missing });
			}
			joined = true;
			sendAwareness([awareness.clientID]);
			handlers.onSynced(canEdit);
		} else if (event === "note_update") {
			Y.applyUpdate(doc, toBytes(msg.update), REMOTE);
		} else if (event === "note_awareness") {
			applyAwarenessUpdate(awareness, toBytes(msg.update), REMOTE);
		} else if (event === "note_awareness_remove") {
			removeAwarenessStates(awareness, [(payload as { clientId: number }).clientId], REMOTE);
		} else if (event === "note_denied") {
			handlers.onDenied();
		} else if (event === "note_deleted") {
			handlers.onDeleted();
		}
	});

	return () => {
		doc.off("update", onLocalUpdate);
		awareness.off("update", onAwarenessChange);
		socket.disconnect();
	};
}

function toBytes(value: unknown): Uint8Array {
	return value instanceof Uint8Array ? value : new Uint8Array(value as ArrayBuffer);
}

function redirectToLogin(): void {
	clearAuthSession();
	window.location.href = loginUrl();
}
