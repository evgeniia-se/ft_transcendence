import { Prisma, type Tag } from "@prisma/client";
import { MAX_BOARDS_PER_PROJECT, QuotaError } from "./quota.js";
import { prisma } from "../../db/prisma/client.js";
import { broadcastToProject } from "./broadcast.js";
import { CARD_TAGS_INCLUDE, withTags } from "./tag.service.js";
import { SERIALIZABLE, inSequence, retryOnConflict } from "../../db/concurrency.js";

export async function createBoard(input: { projectId: string; title: string}) {
	if ((await prisma.board.count({ where: { projectId: input.projectId } })) >= MAX_BOARDS_PER_PROJECT) throw new QuotaError();
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
		orderBy: [{ position: "asc" as const }, { id: "asc" as const }],
		include: {
			cards: {
				orderBy: [{ position: "asc" as const }, { id: "asc" as const }],
				include: CARD_TAGS_INCLUDE,
			},
		},
	},
};

function flattenCardTags<B extends { lists: { cards: { tags: { tag: Tag }[] }[] }[] }>(board: B) {
	return {
		...board,
		lists: board.lists.map((list) => ({ ...list, cards: list.cards.map(withTags) })),
	};
}

// creates a board for the project if none exists yet
// null return means the project does not exist, this is only an existence check not a permission check
// The board of a project, created the first time somebody opens it. Several members opening a new project at the same
// moment used to get one board each (ten at once created ten): creation is queued per project and re-checks inside a
// Serializable transaction, so exactly one board exists and everybody gets it. The oldest one wins, which also
// settles projects that already have several. Returns null if the project does not exist.
export async function getOrCreateBoardForProject(projectId: string) {
	const load = () =>
		prisma.board.findFirst({ where: { projectId }, orderBy: { createdAt: "asc" }, include: BOARD_WITH_LISTS_AND_CARDS });
	const existing = await load();
	if (existing) {
		return flattenCardTags(existing);
	}

	try {
		await inSequence(`board:${projectId}`, () =>
			retryOnConflict(() =>
				prisma.$transaction(async (tx) => {
					if (await tx.board.findFirst({ where: { projectId }, select: { id: true } })) return;
					const project = await tx.project.findUnique({ where: { id: projectId }, select: { name: true } });
					if (!project) return;
					await tx.board.create({ data: { projectId, title: project.name } });
				}, SERIALIZABLE),
			),
		);
	} catch (err) {
		if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
			return null;
		}
		throw err;
	}
	const board = await load();
	return board ? flattenCardTags(board) : null;
}

export async function getBoard(id: string) {
	const board = await prisma.board.findUnique({
		where: { id },
		include: BOARD_WITH_LISTS_AND_CARDS,
	});
	return board ? flattenCardTags(board) : null;
}


// returns the deleted row, null if not found. Broadcasts "board_deleted" to the project room
export async function deleteBoard(id: string) {
	try {
		const deleted = await prisma.board.delete({ where: { id } });
		broadcastToProject(deleted.projectId, { type: "board_deleted", payload: { id } });
		return deleted;
	}
	catch (err)
	{
		if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025")
			return null;
		throw err;
	}
}

// resolves a board id to its project id, used to pick the broadcast room
export async function getProjectIdForBoard(boardId: string): Promise<string | null> {
	const board = await prisma.board.findUnique({
		where: { id: boardId },
		select: { projectId: true },
	});
	return board?.projectId ?? null;
}