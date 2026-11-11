//Owner: Track 4 (Whiteboard, notes, and supporting modules)
//Responsible for: live collaborative editing of the notes over the socket hub
import type { Socket } from "socket.io";
import * as Y from "yjs";
import { getIOIfReady } from "../kanban/hub.js";
import { noteRoom } from "../kanban/rooms.js";
import { createTokenBucket } from "../kanban/socketLimit.js";
import { getUserRole, ROLE_RANK, SOCKET_ROLE_TTL_MS, type Role } from "../permissions/roles.service.js";
import { getNoteProjectId, loadNoteDoc, saveNoteDoc } from "./notes.service.js";

const SAVE_DELAY_MS = 2000;
const MAX_UPDATE_BYTES = 1_000_000;
const MAX_AWARENESS_BYTES = 10_000;

interface LiveNote {
	doc: Y.Doc;
	saveTimer?: NodeJS.Timeout;
	saving?: Promise<void>;
	dirty: boolean;
	lastEditor: string | null;
}

interface CachedRole {
	role: Role;
	projectId: string;
	checkedAt: number;
}

interface AwarenessMessage {
	clientId: number;
	update: Uint8Array;
}

const live = new Map<string, LiveNote>();
const loading = new Map<string, Promise<LiveNote>>();

const roomOf = noteRoom;

export function registerNoteCollabHandlers(socket: Socket): void {
	//cached role per joined note refreshed so a demotion or removal takes effect
	const roles = new Map<string, CachedRole>();

	socket.on("note_join", async (msg: unknown) => {
		const noteId = noteIdOf(msg);
		if (!noteId) return;
		const projectId = await getNoteProjectId(noteId);
		const role = projectId ? await getUserRole(projectId, socket.data.userId) : null;
		if (!projectId || !role) {
			socket.emit("note_denied", { noteId });
			return;
		}
		roles.set(noteId, { role, projectId, checkedAt: Date.now() });
		//join the room before loading since a non empty room keeps the document in memory
		await socket.join(roomOf(noteId));
		try {
			const note = await getLiveNote(noteId);
			const theirs = toBytes((msg as { stateVector?: unknown }).stateVector);
			socket.emit("note_sync", {
				noteId,
				update: Y.encodeStateAsUpdate(note.doc, theirs ?? undefined),
				stateVector: Y.encodeStateVector(note.doc),
				canEdit: ROLE_RANK[role] >= ROLE_RANK.member,
			});
			await sendPeersAwareness(noteId);
		} catch (error) {
			console.error(`note_join failed for note ${noteId}:`, error);
			await leave(noteId);
		}
	});

	const takeUpdateToken = createTokenBucket(60, 30);
	const takeAwarenessToken = createTokenBucket(40, 20);

	socket.on("note_update", async (msg: unknown) => {
		if (!takeUpdateToken()) return;
		const noteId = noteIdOf(msg);
		const update = toBytes((msg as { update?: unknown } | null)?.update);
		if (!noteId || !update || update.byteLength > MAX_UPDATE_BYTES) return;
		const note = live.get(noteId);
		if (!note || !socket.rooms.has(roomOf(noteId))) return;

		const role = await currentRole(noteId);
		if (!role || ROLE_RANK[role] < ROLE_RANK.member) return;

		try {
			Y.applyUpdate(note.doc, update, socket.id);
		} catch {
			return;
		}
		socket.to(roomOf(noteId)).emit("note_update", { noteId, update });
		note.dirty = true;
		note.lastEditor = socket.data.userId;
		note.saveTimer ??= setTimeout(() => void flush(noteId), SAVE_DELAY_MS);
	});

	socket.on("note_awareness", (msg: unknown) => {
		if (!takeAwarenessToken()) return;
		const noteId = noteIdOf(msg);
		const update = toBytes((msg as { update?: unknown } | null)?.update);
		const clientId = (msg as { clientId?: unknown } | null)?.clientId;
		if (!noteId || !update || update.byteLength > MAX_AWARENESS_BYTES) return;
		if (typeof clientId !== "number" || !socket.rooms.has(roomOf(noteId))) return;

		awareness(socket).set(noteId, { clientId, update });
		socket.to(roomOf(noteId)).emit("note_awareness", { noteId, clientId, update });
	});

	socket.on("note_leave", (noteId: unknown) => {
		if (typeof noteId === "string") void leave(noteId);
	});

	socket.on("disconnect", () => {
		for (const noteId of roles.keys()) {
			removeCursor(noteId);
			void unloadIfEmpty(noteId);
		}
	});

	//the socket already left the room on disconnect so emit through the server
	function removeCursor(noteId: string): void {
		const last = awareness(socket).get(noteId);
		awareness(socket).delete(noteId);
		if (last) getIOIfReady()?.to(roomOf(noteId)).emit("note_awareness_remove", { noteId, clientId: last.clientId });
	}

	async function sendPeersAwareness(noteId: string): Promise<void> {
		for (const peer of await socket.in(roomOf(noteId)).fetchSockets()) {
			if (peer.id === socket.id) continue;
			const last = (peer.data.noteAwareness as Map<string, AwarenessMessage> | undefined)?.get(noteId);
			if (last) socket.emit("note_awareness", { noteId, clientId: last.clientId, update: last.update });
		}
	}

	async function currentRole(noteId: string): Promise<Role | null> {
		const cached = roles.get(noteId);
		if (!cached) return null;
		if (Date.now() - cached.checkedAt < SOCKET_ROLE_TTL_MS) return cached.role;
		const role = await getUserRole(cached.projectId, socket.data.userId);
		if (!role) {
			await leave(noteId);
			socket.emit("note_denied", { noteId });
			return null;
		}
		roles.set(noteId, { ...cached, role, checkedAt: Date.now() });
		return role;
	}

	async function leave(noteId: string): Promise<void> {
		roles.delete(noteId);
		await socket.leave(roomOf(noteId));
		removeCursor(noteId);
		await unloadIfEmpty(noteId);
	}
}

export async function flushAllNotes(): Promise<void> {
	await Promise.all([...live.keys()].map((noteId) => flush(noteId)));
}

export function closeLiveNote(noteId: string): void {
	const note = live.get(noteId);
	if (note) {
		clearTimeout(note.saveTimer);
		live.delete(noteId);
		note.doc.destroy();
	}
	loading.delete(noteId);
	const io = getIOIfReady();
	io?.to(roomOf(noteId)).emit("note_deleted", { noteId });
	io?.in(roomOf(noteId)).socketsLeave(roomOf(noteId));
}

function awareness(socket: Socket): Map<string, AwarenessMessage> {
	socket.data.noteAwareness ??= new Map<string, AwarenessMessage>();
	return socket.data.noteAwareness as Map<string, AwarenessMessage>;
}

function getLiveNote(noteId: string): Promise<LiveNote> {
	const existing = live.get(noteId);
	if (existing) return Promise.resolve(existing);
	const inFlight = loading.get(noteId);
	if (inFlight) return inFlight;
	//closeLiveNote drops the entry so a load that finishes after a delete is not kept
	const pending: Promise<LiveNote> = loadNoteDoc(noteId)
		.then((doc) => {
			const note: LiveNote = { doc, dirty: false, lastEditor: null };
			if (loading.get(noteId) === pending) live.set(noteId, note);
			return note;
		})
		.finally(() => {
			if (loading.get(noteId) === pending) loading.delete(noteId);
		});
	loading.set(noteId, pending);
	return pending;
}

//saves of one note run one after the other so an older state never overwrites a newer one
function flush(noteId: string): Promise<void> {
	const note = live.get(noteId);
	if (!note) return Promise.resolve();
	note.saving = (note.saving ?? Promise.resolve()).then(() => save(noteId, note));
	return note.saving;
}

async function save(noteId: string, note: LiveNote): Promise<void> {
	if (live.get(noteId) !== note) return;
	clearTimeout(note.saveTimer);
	note.saveTimer = undefined;
	if (!note.dirty) return;
	note.dirty = false;
	try {
		await saveNoteDoc(noteId, note.doc, note.lastEditor);
	} catch (error) {
		if ((error as { code?: string }).code === "P2025") return; //P2025 means the note was deleted meanwhile
		console.error(`saving note ${noteId} failed:`, error);
		note.dirty = true;
		note.saveTimer ??= setTimeout(() => void flush(noteId), SAVE_DELAY_MS);
	}
}

async function unloadIfEmpty(noteId: string): Promise<void> {
	if (!live.has(noteId) || roomSize(noteId) > 0) return;
	await flush(noteId);
	const note = live.get(noteId);
	//someone may have joined while saving or the save failed
	if (note && !note.dirty && roomSize(noteId) === 0) {
		live.delete(noteId);
		note.doc.destroy();
	}
}

//circular import with hub is fine since getIOIfReady is only called at runtime
function roomSize(noteId: string): number {
	return getIOIfReady()?.sockets.adapter.rooms.get(roomOf(noteId))?.size ?? 0;
}

function noteIdOf(msg: unknown): string | null {
	const noteId = (msg as { noteId?: unknown } | null)?.noteId;
	return typeof noteId === "string" && noteId.length > 0 ? noteId : null;
}

function toBytes(value: unknown): Uint8Array | null {
	if (value instanceof Uint8Array) return value;
	if (value instanceof ArrayBuffer) return new Uint8Array(value);
	return null;
}
