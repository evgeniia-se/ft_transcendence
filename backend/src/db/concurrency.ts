// Owner: Track 1 (Foundation, Auth, and API infrastructure)
// Responsible for: the two tools every "read, decide, write" operation uses to stay correct when several people act at
// once: a per-key queue (so one backend never races against itself) and a retry for the transactions Postgres aborts
// (so a second backend instance stays correct too).
import { Prisma } from "@prisma/client";

const queues = new Map<string, Promise<unknown>>();

// inSequence runs the tasks that share a key one after the other, in this process. The result and the errors of a
// task are its own: a failing task does not stop the ones queued behind it.
export function inSequence<T>(key: string, task: () => Promise<T>): Promise<T> {
	const run = (queues.get(key) ?? Promise.resolve()).then(task, task);
	const tail = run.catch(() => undefined);
	queues.set(key, tail);
	void tail.then(() => {
		if (queues.get(key) === tail) queues.delete(key);
	});
	return run;
}

// The isolation level of the transactions that read something and write depending on it.
export const SERIALIZABLE = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable } as const;

// Postgres aborts a Serializable transaction that lost a race (P2034: write conflict or deadlock), and a unique
// insert that lost it fails with P2002. Both succeed when run again on the new state.
// A deadlock outside a transaction (a cascade delete against concurrent inserts) reaches us as an unknown request
// error that only carries Postgres' message.
export function isConflict(err: unknown): boolean {
	if (err instanceof Prisma.PrismaClientKnownRequestError) return err.code === "P2034" || err.code === "P2002";
	return err instanceof Prisma.PrismaClientUnknownRequestError && /deadlock detected|40P01|40001/.test(err.message);
}

// retryOnConflict runs `run` again, after a short random wait, when it lost a race. Anything else is thrown.
export async function retryOnConflict<T>(run: () => Promise<T>, attempts = 8): Promise<T> {
	for (let attempt = 1; ; attempt++) {
		try {
			return await run();
		} catch (err) {
			if (!isConflict(err) || attempt >= attempts) throw err;
			await new Promise((resolve) => setTimeout(resolve, Math.random() * 20 * attempt));
		}
	}
}
