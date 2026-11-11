// Owner: Track 4 (Whiteboard, notes, and supporting modules)
// Responsible for: the notes list and single note entry point
import { boot } from "../shared/boot";
import Notes from "./Notes.svelte";
import NotesList from "./NotesList.svelte";

const match = window.location.pathname.match(/^\/app\/([^/]+)\/notes(?:\/([^/]+))?\/?$/);
const projectId = match?.[1];
const noteId = match?.[2];

if (!projectId) {
	window.location.replace("/app");
} else if (noteId) {
	boot(Notes, { auth: "required", props: { projectId, noteId } });
} else {
	boot(NotesList, { auth: "required", props: { projectId } });
}
