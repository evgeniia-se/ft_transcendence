// Owner: Track 2 (Person A — Kanban CRUD and UI)
// Responsible for: keeping the `position` of cards in a list and of lists in a board a clean 0..n-1 sequence, which
// the interface and the move logic rely on. Positions are only an order: callers ask for an index, never for a raw
// number, and the sequence is rebuilt around it, so two people adding something at the same index cannot end up with
// the same position. Always called inside a Serializable transaction, serialised per project (see card.service.ts).
import type { Prisma } from "@prisma/client";
import { inSequence, retryOnConflict } from "../../db/concurrency.js";

type Tx = Prisma.TransactionClient;

// makeRoomInList renumbers the cards of the list 0..n-1 in their current order, leaving a hole at the returned index,
// where the caller then puts the new card. `index` is clamped to the end of the list.
export async function makeRoomInList(tx: Tx, listId: string, index: number | undefined): Promise<number> {
	const cards = await tx.card.findMany({ where: { listId }, orderBy: [{ position: "asc" }, { id: "asc" }], select: { id: true, position: true } });
	const at = Math.min(Math.max(index ?? cards.length, 0), cards.length);
	for (const [i, card] of cards.entries()) {
		const wanted = i >= at ? i + 1 : i;
		if (card.position !== wanted) await tx.card.update({ where: { id: card.id }, data: { position: wanted } });
	}
	return at;
}

// closeGapsInList renumbers the cards of the list 0..n-1 (after one left it).
export async function closeGapsInList(tx: Tx, listId: string): Promise<void> {
	const cards = await tx.card.findMany({ where: { listId }, orderBy: [{ position: "asc" }, { id: "asc" }], select: { id: true, position: true } });
	for (const [i, card] of cards.entries()) {
		if (card.position !== i) await tx.card.update({ where: { id: card.id }, data: { position: i } });
	}
}

export async function makeRoomInBoard(tx: Tx, boardId: string, index: number | undefined): Promise<number> {
	const lists = await tx.list.findMany({ where: { boardId }, orderBy: [{ position: "asc" }, { id: "asc" }], select: { id: true, position: true } });
	const at = Math.min(Math.max(index ?? lists.length, 0), lists.length);
	for (const [i, list] of lists.entries()) {
		const wanted = i >= at ? i + 1 : i;
		if (list.position !== wanted) await tx.list.update({ where: { id: list.id }, data: { position: wanted } });
	}
	return at;
}

export async function closeGapsInBoard(tx: Tx, boardId: string): Promise<void> {
	const lists = await tx.list.findMany({ where: { boardId }, orderBy: [{ position: "asc" }, { id: "asc" }], select: { id: true, position: true } });
	for (const [i, list] of lists.entries()) {
		if (list.position !== i) await tx.list.update({ where: { id: list.id }, data: { position: i } });
	}
}

// Everything that changes the order of cards in a project (add, move, delete) runs one operation at a time in this
// process, inside a Serializable transaction that is retried if Postgres aborts it: two people acting at once get the
// same result as if they had acted one after the other. Without it, cards added at the same moment got the same
// position and 30 simultaneous moves all failed with a deadlock.
export function withProjectLock<T>(projectId: string | null, fallbackKey: string, task: () => Promise<T>): Promise<T> {
	return inSequence(`kanban:${projectId ?? fallbackKey}`, () => retryOnConflict(task));
}
