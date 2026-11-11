// Owner: Track 4 (Whiteboard, notes, and supporting modules)
// Responsible for: Fastify route handlers for uploading, listing, downloading and deleting attachments.
import { readFile } from "node:fs/promises";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import multipart from "@fastify/multipart";
import { DocumentError, answer } from "../folders/documentError.js";
import { requireAuth, requireRole } from "../permissions/permissions.middleware.js";
import { notifyProject } from "../notifications/notifications.service.js";
import {
	uploadAttachment,
	listAttachments,
	getAttachment,
	attachmentPath,
	copyAttachment,
	deleteAttachment,
	linkAttachmentToCard,
	moveAttachment,
	unlinkAttachmentFromCard,
	InvalidUploadError,
} from "./attachments.service.js";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MiB, same ceiling the service enforces

export async function registerAttachmentsRoutes(app: FastifyInstance): Promise<void> {
	await app.register(multipart, { limits: { fileSize: MAX_FILE_BYTES, files: 1 } });

	// projectId comes first in every path because requireRole only reads params.projectId.
	app.post("/:projectId", { preHandler: [requireAuth, requireRole("member")] }, uploadAttachmentHandler);
	app.get("/:projectId", { preHandler: [requireAuth, requireRole("viewer")] }, listAttachmentsHandler);
	app.get("/:projectId/:id", { preHandler: [requireAuth, requireRole("viewer")] }, getAttachmentHandler);
	app.delete("/:projectId/:id", { preHandler: [requireAuth, requireRole("member")] }, deleteAttachmentHandler);
	app.patch(
		"/:projectId/:id",
		{
			preHandler: [requireAuth, requireRole("member")],
			schema: {
				body: {
					type: "object",
					required: ["folderId"],
					additionalProperties: false,
					properties: { folderId: { type: ["string", "null"] } },
				},
			},
		},
		moveAttachmentHandler,
	);
	app.post(
		"/:projectId/:id/copy",
		{
			preHandler: [requireAuth, requireRole("member")],
			schema: {
				body: {
					type: "object",
					additionalProperties: false,
					properties: { folderId: { type: ["string", "null"] } },
				},
			},
		},
		copyAttachmentHandler,
	);
	app.put("/:projectId/:id/cards/:cardId", { preHandler: [requireAuth, requireRole("member")] }, linkHandler);
	app.delete("/:projectId/:id/cards/:cardId", { preHandler: [requireAuth, requireRole("member")] }, unlinkHandler);
}

async function uploadAttachmentHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	const userId = request.userId;
	if (!userId) {
		reply.code(401).send({ error: "unauthenticated" });
		return;
	}

	const { projectId } = request.params as { projectId: string };
	const { cardId, folderId } = request.query as { cardId?: string; folderId?: string };

	const file = await request.file();
	if (!file) {
		reply.code(400).send({ error: "invalid_input", details: ["a file field is required"] });
		return;
	}

	// toBuffer() throws once the stream goes past the fileSize limit set above.
	let fileBuffer: Buffer;
	try {
		fileBuffer = await file.toBuffer();
	} catch {
		reply.code(413).send({ error: "file_too_large" });
		return;
	}

	try {
		const attachment = await uploadAttachment(userId, {
			projectId,
			cardId,
			folderId,
			fileName: file.filename,
			fileType: file.mimetype,
			fileBuffer,
		});
		reply.code(201).send({ attachment });
	} catch (err) {
		if (err instanceof InvalidUploadError) {
			reply.code(400).send({ error: "invalid_upload", details: err.details });
			return;
		}
		if (err instanceof DocumentError) {
			reply.code(err.status).send({ error: err.message });
			return;
		}
		throw err;
	}
}

async function listAttachmentsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	const { projectId } = request.params as { projectId: string };
	const { cardId } = request.query as { cardId?: string };

	const attachments = await listAttachments(projectId, cardId);
	reply.code(200).send({ attachments });
}

//send the stored file back.
async function getAttachmentHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	const { projectId, id } = request.params as { projectId: string; id: string };

	const attachment = await getAttachment(projectId, id);
	if (attachment === null) {
		reply.code(404).send({ error: "attachment_not_found" });
		return;
	}

	//read into memory rather than stream: MAX_FILE_BYTES caps a file at 10 MiB, and a Buffer
	let data: Buffer;
	try {
		data = await readFile(attachmentPath(attachment));
	} catch {
		//the row exists but the file is gone from the volume
		reply.code(404).send({ error: "attachment_not_found" });
		return;
	}

	//"attachment" rather than "inline": the browser saves the file instead of rendering it on our
	reply
		.header("Content-Type", attachment.fileType)
		.header("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`)
		.send(data);
}

//remove the record and the stored file.
async function deleteAttachmentHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	const { projectId, id } = request.params as { projectId: string; id: string };

	const attachment = await getAttachment(projectId, id);
	const deleted = await deleteAttachment(projectId, id);
	if (!deleted) {
		reply.code(404).send({ error: "attachment_not_found" });
		return;
	}

	reply.code(204).send();
	if (attachment) {
		void notifyProject({ projectId, actorId: request.userId as string, type: "file_deleted", text: `a supprimé le fichier « ${attachment.fileName} »`, key: "file_deleted", params: { name: attachment.fileName }, entityId: id, path: `/app/${projectId}/files` });
	}
}

async function moveAttachmentHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	const { projectId, id } = request.params as { projectId: string; id: string };
	const { folderId } = request.body as { folderId: string | null };
	await answer(reply, async () => {
		const attachment = await moveAttachment(projectId, id, folderId);
		reply.code(200).send({ attachment });
		void notifyProject({ projectId, actorId: request.userId as string, type: "file_moved", text: `a déplacé le fichier « ${attachment.fileName} »`, key: "file_moved", params: { name: attachment.fileName }, entityId: id, path: `/app/${projectId}/files`, coalesce: true });
	});
}

async function linkHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	const { projectId, id, cardId } = request.params as { projectId: string; id: string; cardId: string };
	await answer(reply, async () => {
		await linkAttachmentToCard(projectId, id, cardId);
		reply.code(204).send();
	});
}

async function unlinkHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	const { projectId, id, cardId } = request.params as { projectId: string; id: string; cardId: string };
	await answer(reply, async () => {
		await unlinkAttachmentFromCard(projectId, id, cardId);
		reply.code(204).send();
	});
}

async function copyAttachmentHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	const { projectId, id } = request.params as { projectId: string; id: string };
	const { folderId } = (request.body ?? {}) as { folderId?: string | null };
	await answer(reply, async () => {
		const attachment = await copyAttachment(projectId, id, request.userId as string, folderId ?? null);
		reply.code(201).send({ attachment });
		void notifyProject({ projectId, actorId: request.userId as string, type: "file_uploaded", text: `a ajouté le fichier « ${attachment.fileName} »`, key: "file_uploaded", params: { name: attachment.fileName }, entityId: attachment.id, path: `/app/${projectId}/files` });
	});
}
