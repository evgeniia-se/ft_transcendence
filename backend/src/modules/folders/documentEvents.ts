//Owner: Track 4 (Whiteboard, notes, and supporting modules)
//Responsible for: telling open boards that card documents changed
import { broadcastToProject } from "../kanban/broadcast.js";

export function notifyDocumentsChanged(projectId: string): void {
	broadcastToProject(projectId, { type: "documents_changed", payload: {} });
}
