// Owner: Track 2 (Person B — WebSocket layer)
// Responsible for: the names of the Socket.IO rooms, so every module that joins, leaves or emits to one agrees on
// them. A project room is just the project id (kanban events), the others are separate because their traffic is
// chatty and kanban pages must not receive it.
export const projectRoom = (projectId: string): string => projectId;
export const whiteboardRoom = (projectId: string): string => `whiteboard:${projectId}`;
export const noteRoom = (noteId: string): string => `note:${noteId}`;
export const userRoom = (userId: string): string => `user:${userId}`;
