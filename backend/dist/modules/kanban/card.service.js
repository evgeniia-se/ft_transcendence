import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma/client.js";
import { broadcastToProject } from "./broadcast.js";
import { getProjectIdForList } from "./list.service.js";
import { CARD_TAGS_INCLUDE, withTags } from "./tag.service.js";
// broadcastToListProject resolves a list to its project and broadcasts to that project's room
async function broadcastToListProject(listId, type, payload) {
    const projectId = await getProjectIdForList(listId);
    if (projectId) {
        broadcastToProject(projectId, { type, payload });
    }
}
// position is optional: callers that don't care (the public API) get the card appended at the end of the list
export async function createCard(input) {
    const position = input.position ?? await prisma.card.count({ where: { listId: input.listId } });
    const card = await prisma.card.create({
        data: {
            listId: input.listId,
            title: input.title,
            description: input.description,
            position,
        },
        include: CARD_TAGS_INCLUDE,
    });
    const payload = withTags(card);
    await broadcastToListProject(card.listId, "card_created", payload);
    return payload;
}
// resolves a card id to its project id through its list and board, used for permission checks
export async function getProjectIdForCard(cardId) {
    const card = await prisma.card.findUnique({
        where: { id: cardId },
        select: { list: { select: { board: { select: { projectId: true } } } } },
    });
    return card?.list.board.projectId ?? null;
}
export async function getCard(id) {
    const card = await prisma.card.findUnique({
        where: { id },
        include: CARD_TAGS_INCLUDE,
    });
    return card ? withTags(card) : null;
}
export async function updateCard(id, input) {
    try {
        const card = await prisma.card.update({
            where: { id },
            data: input,
            include: CARD_TAGS_INCLUDE,
        });
        const payload = withTags(card);
        await broadcastToListProject(card.listId, "card_updated", payload);
        return payload;
    }
    catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025")
            return null;
        throw err;
    }
}
const MOVE_MAX_ATTEMPTS = 3;
// moveCard puts a card at index `position` of list `toListId` (clamped to the list's length) and renumbers
// the positions 0..n-1 of the lists it leaves and joins. Returns null if the card or the destination list
// doesn't exist, or if the destination list belongs to another project.
// Race-safe under concurrent moves: the read-then-write runs in a serializable transaction, retried when
// Postgres aborts it because another move touched the same rows (Prisma error P2034).
// Broadcasts "card_moved" with the new card order of both lists, so clients don't have to replay the shift.
export async function moveCard(cardId, toListId, position) {
    for (let attempt = 1;; attempt++) {
        try {
            const result = await prisma.$transaction(async (tx) => {
                const card = await tx.card.findUnique({
                    where: { id: cardId },
                    select: { listId: true, list: { select: { board: { select: { projectId: true } } } } },
                });
                const target = await tx.list.findUnique({
                    where: { id: toListId },
                    select: { board: { select: { projectId: true } } },
                });
                if (!card || !target || target.board.projectId !== card.list.board.projectId) {
                    return null;
                }
                const fromListId = card.listId;
                const orderOf = async (listId) => (await tx.card.findMany({
                    where: { listId },
                    orderBy: [{ position: "asc" }, { id: "asc" }],
                    select: { id: true },
                })).map((c) => c.id);
                const sameList = fromListId === toListId;
                const fromOrder = (await orderOf(fromListId)).filter((id) => id !== cardId);
                const toOrder = sameList ? fromOrder : await orderOf(toListId);
                toOrder.splice(Math.min(position, toOrder.length), 0, cardId);
                if (!sameList) {
                    for (const [index, id] of fromOrder.entries()) {
                        await tx.card.update({ where: { id }, data: { position: index } });
                    }
                }
                for (const [index, id] of toOrder.entries()) {
                    await tx.card.update({ where: { id }, data: { position: index, listId: toListId } });
                }
                return { projectId: target.board.projectId, cardId, fromListId, toListId, fromOrder: sameList ? toOrder : fromOrder, toOrder };
            }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
            if (!result) {
                return null;
            }
            const { projectId, ...event } = result;
            broadcastToProject(projectId, { type: "card_moved", payload: event });
            return event;
        }
        catch (err) {
            const conflict = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034";
            if (!conflict || attempt >= MOVE_MAX_ATTEMPTS)
                throw err;
        }
    }
}
// returns the deleted row, null if not found. Broadcasts "card_deleted" to the project room
export async function deleteCard(id) {
    try {
        const deleted = await prisma.card.delete({ where: { id } });
        await broadcastToListProject(deleted.listId, "card_deleted", { id });
        return deleted;
    }
    catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025")
            return null;
        throw err;
    }
}
//# sourceMappingURL=card.service.js.map