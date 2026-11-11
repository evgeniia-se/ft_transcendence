import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma/client.js";
import { broadcastToProject } from "./broadcast.js";
import { getProjectIdForBoard } from "./board.service.js";
import { SERIALIZABLE } from "../../db/concurrency.js";
import { MAX_LISTS_PER_BOARD, QuotaError } from "./quota.js";
import { closeGapsInBoard, makeRoomInBoard, withProjectLock } from "./positions.js";

// broadcastToBoardProject resolves a board to its project and broadcasts to that project's room
async function broadcastToBoardProject(boardId: string, type: string, payload: unknown): Promise<void> {
	const projectId = await getProjectIdForBoard(boardId);
	if (projectId) {
		broadcastToProject(projectId, { type, payload });
	}
}

// `position` is the index the list should take in the board: the lists after it move right by one.
export async function createList(input: { boardId: string; title: string; position: number}) {
	const projectId = await getProjectIdForBoard(input.boardId);
	const list = await withProjectLock(projectId, input.boardId, () =>
		prisma.$transaction(async (tx) => {
			if ((await tx.list.count({ where: { boardId: input.boardId } })) >= MAX_LISTS_PER_BOARD) throw new QuotaError();
			const at = await makeRoomInBoard(tx, input.boardId, input.position);
			return tx.list.create({ data: { boardId: input.boardId, title: input.title, position: at } });
		}, SERIALIZABLE),
	);
	await broadcastToBoardProject(list.boardId, "list_created", list);
	return list;
}

export async function getList(id: string) {
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

export async function updateList(id: string, input:  Prisma.ListUncheckedUpdateInput) {
	try 
	{
		const list = await prisma.list.update({
			where: { id },
			data: input,
		});
		await broadcastToBoardProject(list.boardId, "list_updated", list);
		return list;
	}
	catch (err)
	{
		if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025")
			return null;
		throw err;
	}
}


// returns the deleted row, null if not found. Broadcasts "list_deleted" to the project room
export async function deleteList(id: string) {
	try {
		const boardId = (await prisma.list.findUnique({ where: { id }, select: { boardId: true } }))?.boardId;
		if (!boardId) return null;
		const projectId = await getProjectIdForBoard(boardId);
		const deleted = await withProjectLock(projectId, boardId, () =>
			prisma.$transaction(async (tx) => {
				const list = await tx.list.delete({ where: { id } });
				await closeGapsInBoard(tx, list.boardId);
				return list;
			}, SERIALIZABLE),
		);
		await broadcastToBoardProject(deleted.boardId, "list_deleted", { id });
		return deleted;
	}
	catch (err)
	{
		if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025")
			return null;
		throw err;
	}
}

// resolves a list id to its project id through its board, used to pick the broadcast room
export async function getProjectIdForList(listId: string): Promise<string | null> {
	const list = await prisma.list.findUnique({
		where: { id: listId },
		select: { board: { select: { projectId: true } } },
	});
	return list?.board.projectId ?? null;
}

// false means one of the lists doesn't exist or doesn't belong to boardId, in which case nothing is changed
export async function reorderLists(boardId: string, orderedListIds: string[]) {
	const projectId = await getProjectIdForBoard(boardId);
	return withProjectLock(projectId, boardId, async () => {
		try {
			await prisma.$transaction(async (tx) => {
				for (const [index, listId] of orderedListIds.entries()) {
					await tx.list.update({ where: { id: listId, boardId }, data: { position: index } });
				}
				// a list created while the order was being decided is not in it: it goes after the others
				const others = await tx.list.findMany({ where: { boardId, id: { notIn: orderedListIds } }, orderBy: [{ position: "asc" }, { id: "asc" }], select: { id: true } });
				for (const [i, list] of others.entries()) {
					await tx.list.update({ where: { id: list.id }, data: { position: orderedListIds.length + i } });
				}
			}, SERIALIZABLE);
			await broadcastToBoardProject(boardId, "lists_reordered", { boardId, orderedListIds });
			return true;
		}
		catch (err)
		{
			if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025")
				return false;
			throw err;
		}
	});
}
