// Owner: Track 4 (Whiteboard, notes, and supporting modules)
// Responsible for: frontend API calls for the notes
import { apiRequest } from "../api/apiClient";

export interface NoteSummary {
	id: string;
	projectId: string;
	title: string;
	updatedBy: string | null;
	createdAt: string;
	updatedAt: string;
	cardIds: string[];
	preview: string;
}

export interface NoteDetail {
	id: string;
	projectId: string;
	title: string;
	updatedBy: string | null;
	createdAt: string;
	updatedAt: string;
}

export async function listNotes(projectId: string, cardId?: string): Promise<NoteSummary[]> {
	const { notes } = await apiRequest<{ notes: NoteSummary[] }>({
		method: "GET",
		path: `/notes/${projectId}${cardId ? `?cardId=${encodeURIComponent(cardId)}` : ""}`,
	});
	return notes;
}

export async function getNote(projectId: string, noteId: string): Promise<NoteDetail> {
	const { note } = await apiRequest<{ note: NoteDetail }>({ method: "GET", path: `/notes/${projectId}/${noteId}` });
	return note;
}

export async function createNote(projectId: string, input: { title?: string }): Promise<NoteSummary> {
	const { note } = await apiRequest<{ note: NoteSummary }>({ method: "POST", path: `/notes/${projectId}`, body: input });
	return note;
}

export async function updateNote(
	projectId: string,
	noteId: string,
	patch: { title?: string },
): Promise<NoteSummary> {
	const { note } = await apiRequest<{ note: NoteSummary }>({ method: "PATCH", path: `/notes/${projectId}/${noteId}`, body: patch });
	return note;
}

export function deleteNote(projectId: string, noteId: string): Promise<void> {
	return apiRequest<void>({ method: "DELETE", path: `/notes/${projectId}/${noteId}` });
}

export function linkNoteToCard(projectId: string, noteId: string, cardId: string): Promise<void> {
	return apiRequest<void>({ method: "PUT", path: `/notes/${projectId}/${noteId}/cards/${cardId}` });
}

export function unlinkNoteFromCard(projectId: string, noteId: string, cardId: string): Promise<void> {
	return apiRequest<void>({ method: "DELETE", path: `/notes/${projectId}/${noteId}/cards/${cardId}` });
}

export function noteUrl(projectId: string, noteId: string): string {
	return `/app/${projectId}/notes/${noteId}`;
}
