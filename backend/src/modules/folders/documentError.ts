//Owner: Track 4 (Whiteboard, notes, and supporting modules)
//Responsible for: the error thrown by the document modules and its HTTP answer
import type { FastifyReply } from "fastify";

export class DocumentError extends Error {
	readonly status: number;

	constructor(code: string, status: number) {
		super(code);
		this.name = "DocumentError";
		this.status = status;
	}
}

export async function answer(reply: FastifyReply, run: () => Promise<void>): Promise<void> {
	try {
		await run();
	} catch (error) {
		if (error instanceof DocumentError) {
			reply.code(error.status).send({ error: error.message });
			return;
		}
		throw error;
	}
}
