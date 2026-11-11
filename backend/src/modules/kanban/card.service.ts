import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma/client.js";
import { broadcastToProject } from "./broadcast.js";
import { getProjectIdForList } from "./list.service.js";
import { CARD_TAGS_INCLUDE, withTags } from "./tag.service.js";
import { SERIALIZABLE } from "../../db/concurrency.js";
import { MAX_CARDS_PER_LIST, QuotaError } from "./quota.js";
import { closeGapsInList, makeRoomInList, withProjectLock } from "./positions.js";

// broadcastToListProject resolves a list to its project and broadcasts to that project's room
async function broadcastToListProject(listId: string, type: string, payload: unknown): Promise<void> {
	const projectId = await getProjectIdForList(listId);
	if (projectId) {
		broadcastToProject(projectId, { type, payload });
	}
}

// `position` is the index the card should take in the list (the end when omitted, which is what the public API
// does): the cards after it move down by one.
export async function createCard(input: { listId: string; title: string; description?: string; position?: number; createdBy?: string }) {
	const projectId = await getProjectIdForList(input.listId);
	const card = await withProjectLock(projectId, input.listId, () =>
		prisma.$transaction(async (tx) => {
			if ((await tx.card.count({ where: { listId: input.listId } })) >= MAX_CARDS_PER_LIST) throw new QuotaError();
			const at = await makeRoomInList(tx, input.listId, input.position);
			return tx.card.create({
				data: { listId: input.listId, title: input.title, description: input.description, position: at, createdBy: input.createdBy },
				include: CARD_TAGS_INCLUDE,
			});
		}, SERIALIZABLE),
	);
	const payload = withTags(card);
	await broadcastToListProject(card.listId, "card_created", payload);
	return payload;
}

// resolves a card id to its project id through its list and board, used for permission checks
export async function getProjectIdForCard(cardId: string): Promise<string | null> {
	const card = await prisma.card.findUnique({
		where: { id: cardId },
		select: { list: { select: { board: { select: { projectId: true } } } } },
	});
	return card?.list.board.projectId ?? null;
}

export async function getCard(id: string) {
	const card = await prisma.card.findUnique({
		where: { id },
		include: CARD_TAGS_INCLUDE,
	});
	return card ? withTags(card) : null;
}

export async function updateCard(id: string, input: Prisma.CardUncheckedUpdateInput) {
	try 
	{
		const card = await prisma.card.update({
			where: { id },
			data: input,
			include: CARD_TAGS_INCLUDE,
		});
		const payload = withTags(card);
		await broadcastToListProject(card.listId, "card_updated", payload);
		return payload;
	}
	catch (err)
	{
		if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025")
			return null;
		throw err;
	}
}

// moveCard puts a card at index `position` of list `toListId` (clamped to the list's length) and renumbers
// the positions 0..n-1 of the lists it leaves and joins. Returns null if the card or the destination list
// doesn't exist, or if the destination list belongs to another project.
// Race-safe under concurrent moves: the read-then-write runs in a serializable transaction, one move at a time per
// project in this process and retried when Postgres aborts it (see withProjectLock).
// Broadcasts "card_moved" with the new card order of both lists, so clients don't have to replay the shift.
export async function moveCard(cardId: string, toListId: string, position: number) {
	const projectId = await getProjectIdForList(toListId);
	return withProjectLock(projectId, toListId, async () => {
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
			const orderOf = async (listId: string) =>
				(await tx.card.findMany({
					where: { listId },
					orderBy: [{ position: "asc" }, { id: "asc" }],
					select: { id: true },
				})).map((c) => c.id);

			const sameList = fromListId === toListId;
			const fromOrder = (await orderOf(fromListId)).filter((id) => id !== cardId);
			const toOrder = sameList ? fromOrder : await orderOf(toListId);
			if (!sameList && toOrder.length >= MAX_CARDS_PER_LIST) throw new QuotaError();
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
		}, SERIALIZABLE);

		if (!result) {
			return null;
		}
		const { projectId: room, ...event } = result;
		broadcastToProject(room, { type: "card_moved", payload: event });
		return event;
	});
}

// returns the deleted row, null if not found. Broadcasts "card_deleted" to the project room
export async function deleteCard(id: string) {
	try {
		const listId = (await prisma.card.findUnique({ where: { id }, select: { listId: true } }))?.listId;
		if (!listId) return null;
		const projectId = await getProjectIdForList(listId);
		const deleted = await withProjectLock(projectId, listId, () =>
			prisma.$transaction(async (tx) => {
				const card = await tx.card.delete({ where: { id } });
				await closeGapsInList(tx, card.listId);
				return card;
			}, SERIALIZABLE),
		);
		await broadcastToListProject(deleted.listId, "card_deleted", { id });
		return deleted;
	}
	catch (err)
	{
		if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025")
			return null;
		throw err;
	}
}
