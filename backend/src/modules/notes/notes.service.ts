//Owner: Track 4 (Whiteboard, notes, and supporting modules)
//Responsible for: notes storage and conversion between Yjs and ProseMirror JSON
import type { Note, Prisma } from "@prisma/client";
import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { prosemirrorJSONToYXmlFragment, yDocToProsemirrorJSON } from "@tiptap/y-tiptap";
import * as Y from "yjs";
import { prisma } from "../../db/prisma/client.js";
import { notifyDocumentsChanged } from "../folders/documentEvents.js";
import { DocumentError } from "../folders/documentError.js";
import { cardInProject } from "../folders/folders.service.js";
import { extractPlainText } from "../search/search.service.js";
import { notifyProject } from "../notifications/notifications.service.js";

//must match the fragment name used by the Tiptap Collaboration extension
const FIELD = "default";
//must list the same extensions as the frontend editor or content is dropped
const schema = getSchema([StarterKit]);

const EMPTY_DOC = { type: "doc", content: [] };
const MAX_TITLE_LENGTH = 200;
const DEFAULT_TITLE = "Sans titre";
const PREVIEW_LENGTH = 400;

export interface NoteSummary {
	id: string;
	projectId: string;
	title: string;
	updatedBy: string | null;
	createdAt: Date;
	updatedAt: Date;
	cardIds: string[];
	preview: string;
}

export type PublicNote = Omit<Note, "yjsState">;

const summarySelect = {
	id: true,
	projectId: true,
	title: true,
	updatedBy: true,
	createdAt: true,
	updatedAt: true,
	contentJson: true,
	cardLinks: { select: { cardId: true } },
} as const;

function toSummary(note: Prisma.NoteGetPayload<{ select: typeof summarySelect }>): NoteSummary {
	const { cardLinks, contentJson, ...rest } = note;
	const preview = extractPlainText(contentJson).replace(/\s+/g, " ").trim().slice(0, PREVIEW_LENGTH);
	return { ...rest, cardIds: cardLinks.map((link) => link.cardId), preview };
}

export async function listNotes(projectId: string, cardId?: string): Promise<NoteSummary[]> {
	const notes = await prisma.note.findMany({
		where: { projectId, ...(cardId ? { cardLinks: { some: { cardId } } } : {}) },
		select: summarySelect,
		orderBy: { updatedAt: "desc" },
	});
	return notes.map(toSummary);
}

export async function getNote(projectId: string, noteId: string): Promise<PublicNote | null> {
	return prisma.note.findFirst({
		where: { id: noteId, projectId },
		select: { id: true, projectId: true, title: true, contentJson: true, updatedBy: true, createdAt: true, updatedAt: true },
	});
}

export async function createNote(
	projectId: string,
	userId: string,
	input: { title?: string },
): Promise<NoteSummary> {
	const note = await prisma.note.create({
		data: { projectId, title: cleanTitle(input.title ?? DEFAULT_TITLE), contentJson: EMPTY_DOC, updatedBy: userId },
		select: summarySelect,
	});
	return toSummary(note);
}

export async function updateNote(
	projectId: string,
	noteId: string,
	input: { title?: string },
): Promise<NoteSummary> {
	await requireNote(projectId, noteId);
	const note = await prisma.note.update({
		where: { id: noteId },
		data: { ...(input.title !== undefined ? { title: cleanTitle(input.title) } : {}) },
		select: summarySelect,
	});
	return toSummary(note);
}

export async function deleteNote(projectId: string, noteId: string): Promise<void> {
	await requireNote(projectId, noteId);
	await prisma.note.delete({ where: { id: noteId } });
	notifyDocumentsChanged(projectId);
}

export async function linkNoteToCard(projectId: string, noteId: string, cardId: string): Promise<void> {
	await requireNote(projectId, noteId);
	if (!(await cardInProject(projectId, cardId))) throw new DocumentError("card_not_found", 404);
	await prisma.cardNote.upsert({
		where: { cardId_noteId: { cardId, noteId } },
		update: {},
		create: { cardId, noteId },
	});
	notifyDocumentsChanged(projectId);
}

export async function unlinkNoteFromCard(projectId: string, noteId: string, cardId: string): Promise<void> {
	await requireNote(projectId, noteId);
	await prisma.cardNote.deleteMany({ where: { cardId, noteId } });
	notifyDocumentsChanged(projectId);
}

export async function getNoteProjectId(noteId: string): Promise<string | null> {
	const note = await prisma.note.findUnique({ where: { id: noteId }, select: { projectId: true } });
	return note?.projectId ?? null;
}

export async function loadNoteDoc(noteId: string): Promise<Y.Doc> {
	const note = await prisma.note.findUnique({ where: { id: noteId } });
	const doc = new Y.Doc();
	if (note?.yjsState) {
		Y.applyUpdate(doc, note.yjsState);
	} else if (note && hasContent(note.contentJson)) {
		//legacy note without Yjs state seeded from its JSON
		//fixed clientID so concurrent seeds produce identical operations and merge
		doc.clientID = 0;
		prosemirrorJSONToYXmlFragment(schema, note.contentJson, doc.getXmlFragment(FIELD));
		await saveNoteDoc(noteId, doc, null);
	}
	return doc;
}

//userId null keeps the previous updatedBy
export async function saveNoteDoc(noteId: string, doc: Y.Doc, userId: string | null): Promise<void> {
	const yjsState = Buffer.from(Y.encodeStateAsUpdate(doc));
	const contentJson = yDocToProsemirrorJSON(doc, FIELD) as unknown as Prisma.InputJsonObject;
	const note = await prisma.note.update({
		where: { id: noteId },
		data: { yjsState, contentJson, ...(userId ? { updatedBy: userId } : {}) },
		select: { projectId: true, title: true },
	});
	//the live editor saves every few seconds while people type: the notification is refreshed, not repeated
	if (userId) {
		void notifyProject({
			projectId: note.projectId,
			actorId: userId,
			type: "note_updated",
			text: `a modifié la note « ${note.title} »`,
			key: "note_updated",
			params: { name: note.title },
			entityId: noteId,
			path: `/app/${note.projectId}/notes/${noteId}`,
			coalesce: true,
		});
	}
}

async function requireNote(projectId: string, noteId: string): Promise<void> {
	const note = await prisma.note.findFirst({ where: { id: noteId, projectId }, select: { id: true } });
	if (!note) throw new DocumentError("note_not_found", 404);
}

function cleanTitle(raw: string): string {
	const title = raw.trim();
	if (title === "" || title.length > MAX_TITLE_LENGTH) throw new DocumentError("invalid_title", 400);
	return title;
}

function hasContent(json: Prisma.JsonValue): boolean {
	if (typeof json !== "object" || json === null || Array.isArray(json)) return false;
	return Array.isArray(json.content) && json.content.length > 0;
}
