import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma/client.js";
import { broadcastToProject } from "./broadcast.js";
export const DEFAULT_TAGS = [
    { name: "WIP", color: "#d97706" },
    { name: "En cours", color: "#2563eb" },
    { name: "À relire", color: "#7c3aed" },
    { name: "Bloqué", color: "#dc2626" },
    { name: "Bug", color: "#be185d" },
];
export const CARD_TAGS_INCLUDE = { tags: { select: { tag: true } } };
export class TagConflictError extends Error {
    constructor() {
        super("tag name already used in this project");
        this.name = "TagConflictError";
    }
}
// flattens the card_tags rows into a plain tags array
export function withTags(card) {
    const tags = card.tags.map((row) => row.tag).sort((a, b) => a.name.localeCompare(b.name));
    return { ...card, tags };
}
export async function getProjectIdForTag(tagId) {
    const tag = await prisma.tag.findUnique({ where: { id: tagId }, select: { projectId: true } });
    return tag?.projectId ?? null;
}
export function listTags(projectId) {
    return prisma.tag.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } });
}
export async function createTag(projectId, input) {
    try {
        const tag = await prisma.tag.create({
            data: { projectId, name: input.name.trim(), color: input.color },
        });
        broadcastToProject(projectId, { type: "tag_created", payload: tag });
        return tag;
    }
    catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")
            throw new TagConflictError();
        throw err;
    }
}
// returns null if the tag doesn't exist
export async function updateTag(id, input) {
    try {
        const tag = await prisma.tag.update({
            where: { id },
            data: { name: input.name?.trim(), color: input.color },
        });
        broadcastToProject(tag.projectId, { type: "tag_updated", payload: tag });
        return tag;
    }
    catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError) {
            if (err.code === "P2025")
                return null;
            if (err.code === "P2002")
                throw new TagConflictError();
        }
        throw err;
    }
}
// returns null if the tag doesn't exist. The card_tags rows are removed by the cascade
export async function deleteTag(id) {
    try {
        const tag = await prisma.tag.delete({ where: { id } });
        broadcastToProject(tag.projectId, { type: "tag_deleted", payload: { id } });
        return tag;
    }
    catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025")
            return null;
        throw err;
    }
}
// replaces all the tags of a card. Returns null if the card doesn't exist, "invalid_tags" if a tag is
// unknown or belongs to another project
export async function setCardTags(cardId, tagIds) {
    const uniqueIds = [...new Set(tagIds)];
    const found = await prisma.card.findUnique({
        where: { id: cardId },
        select: { list: { select: { board: { select: { projectId: true } } } } },
    });
    if (!found)
        return null;
    const projectId = found.list.board.projectId;
    const valid = await prisma.tag.count({ where: { id: { in: uniqueIds }, projectId } });
    if (valid !== uniqueIds.length)
        return "invalid_tags";
    try {
        const card = await prisma.$transaction(async (tx) => {
            await tx.cardTag.deleteMany({ where: { cardId } });
            await tx.cardTag.createMany({
                data: uniqueIds.map((tagId) => ({ cardId, tagId })),
                skipDuplicates: true,
            });
            return tx.card.findUniqueOrThrow({ where: { id: cardId }, include: CARD_TAGS_INCLUDE });
        });
        const payload = withTags(card);
        broadcastToProject(projectId, { type: "card_updated", payload });
        return payload;
    }
    catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && (err.code === "P2025" || err.code === "P2003"))
            return null;
        throw err;
    }
}
//# sourceMappingURL=tag.service.js.map