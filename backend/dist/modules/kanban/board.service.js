import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma/client.js";
import { broadcastToProject } from "./broadcast.js";
import { CARD_TAGS_INCLUDE, withTags } from "./tag.service.js";
export async function createBoard(input) {
    const board = await prisma.board.create({
        data: {
            projectId: input.projectId,
            title: input.title,
        },
    });
    broadcastToProject(board.projectId, { type: "board_created", payload: board });
    return board;
}
const BOARD_WITH_LISTS_AND_CARDS = {
    lists: {
        orderBy: [{ position: "asc" }, { id: "asc" }],
        include: {
            cards: {
                orderBy: [{ position: "asc" }, { id: "asc" }],
                include: CARD_TAGS_INCLUDE,
            },
        },
    },
};
function flattenCardTags(board) {
    return {
        ...board,
        lists: board.lists.map((list) => ({ ...list, cards: list.cards.map(withTags) })),
    };
}
// creates a board for the project if none exists yet
// null return means the project does not exist, this is only an existence check not a permission check
export async function getOrCreateBoardForProject(projectId) {
    const existing = await prisma.board.findFirst({
        where: { projectId },
        include: BOARD_WITH_LISTS_AND_CARDS,
    });
    if (existing) {
        return flattenCardTags(existing);
    }
    try {
        const created = await prisma.board.create({
            data: { projectId, title: "BoardTitle" }, // TODO: allow real board and project names
        });
        return { ...created, lists: [] };
    }
    catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
            return null;
        }
        throw err;
    }
}
export async function getBoard(id) {
    const board = await prisma.board.findUnique({
        where: { id },
        include: BOARD_WITH_LISTS_AND_CARDS,
    });
    return board ? flattenCardTags(board) : null;
}
// returns the deleted row, null if not found. Broadcasts "board_deleted" to the project room
export async function deleteBoard(id) {
    try {
        const deleted = await prisma.board.delete({ where: { id } });
        broadcastToProject(deleted.projectId, { type: "board_deleted", payload: { id } });
        return deleted;
    }
    catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025")
            return null;
        throw err;
    }
}
// resolves a board id to its project id, used to pick the broadcast room
export async function getProjectIdForBoard(boardId) {
    const board = await prisma.board.findUnique({
        where: { id: boardId },
        select: { projectId: true },
    });
    return board?.projectId ?? null;
}
//# sourceMappingURL=board.service.js.map