import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma/client.js";
import { broadcastToProject } from "./broadcast.js";
import { getProjectIdForBoard } from "./board.service.js";
// broadcastToBoardProject resolves a board to its project and broadcasts to that project's room
async function broadcastToBoardProject(boardId, type, payload) {
    const projectId = await getProjectIdForBoard(boardId);
    if (projectId) {
        broadcastToProject(projectId, { type, payload });
    }
}
export async function createList(input) {
    const list = await prisma.list.create({
        data: {
            boardId: input.boardId,
            title: input.title,
            position: input.position,
        },
    });
    await broadcastToBoardProject(list.boardId, "list_created", list);
    return list;
}
export async function getList(id) {
    const list = await prisma.list.findUnique({
        where: { id },
        include: {
            cards: {
                orderBy: [{ position: "asc" }, { id: "asc" }],
            },
        },
    });
    return list;
}
export async function updateList(id, input) {
    try {
        const list = await prisma.list.update({
            where: { id },
            data: input,
        });
        await broadcastToBoardProject(list.boardId, "list_updated", list);
        return list;
    }
    catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025")
            return null;
        throw err;
    }
}
// returns the deleted row, null if not found. Broadcasts "list_deleted" to the project room
export async function deleteList(id) {
    try {
        const deleted = await prisma.list.delete({ where: { id } });
        await broadcastToBoardProject(deleted.boardId, "list_deleted", { id });
        return deleted;
    }
    catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025")
            return null;
        throw err;
    }
}
// resolves a list id to its project id through its board, used to pick the broadcast room
export async function getProjectIdForList(listId) {
    const list = await prisma.list.findUnique({
        where: { id: listId },
        select: { board: { select: { projectId: true } } },
    });
    return list?.board.projectId ?? null;
}
// false means one of the lists doesn't exist or doesn't belong to boardId, in which case nothing is changed
export async function reorderLists(boardId, orderedListIds) {
    try {
        const updates = orderedListIds.map((listId, index) => prisma.list.update({
            where: { id: listId, boardId },
            data: { position: index },
        }));
        await prisma.$transaction(updates);
        await broadcastToBoardProject(boardId, "lists_reordered", { boardId, orderedListIds });
        return true;
    }
    catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025")
            return false;
        throw err;
    }
}
//# sourceMappingURL=list.service.js.map