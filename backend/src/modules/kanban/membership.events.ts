// Owner: Track 2 (Person B — WebSocket layer)
// Responsible for: telling the open connections about who may be in a project and what it is called, which
// the kanban mutations do not cover: the list of members and their roles, a rename, a removal, a deletion.
import { prisma } from "../../db/prisma/client.js";
import { broadcastToProject, broadcastToUser } from "./broadcast.js";
import { getIOIfReady } from "./hub.js";
import { noteRoom, projectRoom, userRoom, whiteboardRoom } from "./rooms.js";

// the members of the project, or one of their roles, changed: open boards reload the member list (it decides
// who may edit)
export function announceMembersChanged(projectId: string): void {
	broadcastToProject(projectId, { type: "members_changed", payload: { projectId } });
}

export function announceProjectUpdated(project: { id: string; name: string }): void {
	broadcastToProject(project.id, { type: "project_updated", payload: { id: project.id, name: project.name } });
}

// every room that carries the content of a project: kanban, whiteboard and each of its notes
async function projectRooms(projectId: string): Promise<string[]> {
	const notes = await prisma.note.findMany({ where: { projectId }, select: { id: true } });
	return [projectRoom(projectId), whiteboardRoom(projectId), ...notes.map((note) => noteRoom(note.id))];
}

// evictFromProject takes a person out of everything live in a project, on every tab they have open: they are
// told (to leave the page), and stop receiving events at once instead of when they next reconnect.
export async function evictFromProject(projectId: string, userId: string): Promise<void> {
	const io = getIOIfReady();
	if (!io) return;
	broadcastToUser(userId, { type: "removed_from_project", payload: { projectId } });
	io.in(userRoom(userId)).socketsLeave(await projectRooms(projectId));
	broadcastToProject(projectId, { type: "presence", payload: { userId, status: "left" } });
}

// announceProjectDeleted tells everybody connected to the project, then closes its rooms. Call it before the
// rows are deleted: the notes' rooms are found through them.
export async function announceProjectDeleted(projectId: string): Promise<void> {
	const io = getIOIfReady();
	if (!io) return;
	const rooms = await projectRooms(projectId);
	broadcastToProject(projectId, { type: "project_deleted", payload: { projectId } });
	io.in(rooms).socketsLeave(rooms);
}
