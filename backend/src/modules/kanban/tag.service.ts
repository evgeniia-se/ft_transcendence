import { Prisma, type Tag } from "@prisma/client";
import { prisma } from "../../db/prisma/client.js";
import { broadcastToProject } from "./broadcast.js";
import { SERIALIZABLE, inSequence, retryOnConflict } from "../../db/concurrency.js";

export const DEFAULT_TAGS = [
	{ name: "WIP", color: "#d97706" },
	{ name: "En cours", color: "#2563eb" },
	{ name: "À relire", color: "#7c3aed" },
	{ name: "Bloqué", color: "#dc2626" },
	{ name: "Bug", color: "#be185d" },
];

//Despite the name, this is every relation a card payload carries: its tags and its Git link (null when none).
export const CARD_TAGS_INCLUDE = { tags: { select: { tag: true } }, gitLink: true } as const;

export class TagConflictError extends Error {
	constructor() {
		super("tag name already used in this project");
		this.name = "TagConflictError";
	}
}

// flattens the card_tags rows into a plain tags array
export function withTags<T extends { tags: { tag: Tag }[] }>(card: T) {
	const tags = card.tags.map((row) => row.tag).sort((a, b) => a.name.localeCompare(b.name));
	return { ...card, tags };
}

export async function getProjectIdForTag(tagId: string): Promise<string | null> {
	const tag = await prisma.tag.findUnique({ where: { id: tagId }, select: { projectId: true } });
	return tag?.projectId ?? null;
}

export function listTags(projectId: string) {
	return prisma.tag.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } });
}

export async function createTag(projectId: string, input: { name: string; color?: string }) {
	try {
		const tag = await prisma.tag.create({
			data: { projectId, name: input.name.trim(), color: input.color },
		});
		broadcastToProject(projectId, { type: "tag_created", payload: tag });
		return tag;
	} catch (err) {
		if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")
			throw new TagConflictError();
		throw err;
	}
}

// returns null if the tag doesn't exist
export async function updateTag(id: string, input: { name?: string; color?: string }) {
	try {
		const tag = await prisma.tag.update({
			where: { id },
			data: { name: input.name?.trim(), color: input.color },
		});
		broadcastToProject(tag.projectId, { type: "tag_updated", payload: tag });
		return tag;
	} catch (err) {
		if (err instanceof Prisma.PrismaClientKnownRequestError) {
			if (err.code === "P2025") return null;
			if (err.code === "P2002") throw new TagConflictError();
		}
		throw err;
	}
}

// returns null if the tag doesn't exist. The card_tags rows are removed by the cascade
export async function deleteTag(id: string) {
	try {
		const tag = await prisma.tag.delete({ where: { id } });
		broadcastToProject(tag.projectId, { type: "tag_deleted", payload: { id } });
		return tag;
	} catch (err) {
		if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025")
			return null;
		throw err;
	}
}

// replaces all the tags of a card. Returns null if the card doesn't exist, "invalid_tags" if a tag is
// unknown or belongs to another project
export async function setCardTags(cardId: string, tagIds: string[]) {
	const uniqueIds = [...new Set(tagIds)];
	const found = await prisma.card.findUnique({
		where: { id: cardId },
		select: { list: { select: { board: { select: { projectId: true } } } } },
	});
	if (!found) return null;
	const projectId = found.list.board.projectId;

	const valid = await prisma.tag.count({ where: { id: { in: uniqueIds }, projectId } });
	if (valid !== uniqueIds.length) return "invalid_tags" as const;

	try {
		// Replacing the tags is "delete them all, add these": two of them running together interleaved and left the
		// union of both sets. One per card at a time, and Serializable for a second backend instance.
		const card = await inSequence(`cardtags:${cardId}`, () =>
			retryOnConflict(() =>
				prisma.$transaction(async (tx) => {
					await tx.cardTag.deleteMany({ where: { cardId } });
					await tx.cardTag.createMany({
						data: uniqueIds.map((tagId) => ({ cardId, tagId })),
						skipDuplicates: true,
					});
					return tx.card.findUniqueOrThrow({ where: { id: cardId }, include: CARD_TAGS_INCLUDE });
				}, SERIALIZABLE),
			),
		);
		const payload = withTags(card);
		broadcastToProject(projectId, { type: "card_updated", payload });
		return payload;
	} catch (err) {
		if (err instanceof Prisma.PrismaClientKnownRequestError && (err.code === "P2025" || err.code === "P2003"))
			return null;
		throw err;
	}
}
