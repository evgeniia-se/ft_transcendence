// Owner: Track 4 (Whiteboard, notes, and supporting modules)
// Responsible for: the File upload minor module. Files live on disk under UPLOADS_DIR, which
// docker-compose mounts as a named volume; the database only stores metadata.
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import type { Attachment } from "@prisma/client";
import { prisma } from "../../db/prisma/client.js";
import { DocumentError } from "../folders/documentError.js";
import { notifyDocumentsChanged } from "../folders/documentEvents.js";
import { assertFolderUsable, cardInProject } from "../folders/folders.service.js";
import { notifyProject } from "../notifications/notifications.service.js";

// /app/uploads inside the container, backend/uploads locally (both gitignored).
// UPLOADS_DIR overrides the folder (the tests use a temporary one); by default "uploads" next to where the backend runs
const UPLOADS_DIR = path.resolve(process.env.UPLOADS_DIR ?? path.join(process.cwd(), "uploads"));

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MiB

//map of allowed MIME types to their file extensions. The extension is only used for the stored name, not the original name.
const ALLOWED_TYPES = new Map<string, string>([
	["image/png", ".png"],
	["image/jpeg", ".jpg"],
	["image/gif", ".gif"],
	["image/webp", ".webp"],
	["application/pdf", ".pdf"],
	["text/plain", ".txt"],
	["text/markdown", ".md"],
	["application/json", ".json"],
	["application/zip", ".zip"],
]);

export type AttachmentWithLinks = Attachment & { cardIds: string[] };

export interface UploadAttachmentInput {
	projectId: string;
	cardId?: string;
	folderId?: string;
	fileName: string;
	fileType: string;
	fileBuffer: Buffer;
}

//carry the reasons, so the route can answer 400 with details.
export class InvalidUploadError extends Error {
	readonly details: string[];

	constructor(details: string[]) {
		super("invalid_upload");
		this.name = "InvalidUploadError";
		this.details = details;
	}
}

//check type and size before anything touches the disk.
export function validateFileUpload(input: UploadAttachmentInput): string[] {
	const errors: string[] = [];

	if (input.fileName.trim() === "") errors.push("fileName is required");
	if (!ALLOWED_TYPES.has(input.fileType)) errors.push(`fileType ${input.fileType} is not allowed`);
	if (input.fileBuffer.length === 0) errors.push("the file is empty");
	if (input.fileBuffer.length > MAX_FILE_BYTES) {
		errors.push(`the file is larger than ${MAX_FILE_BYTES} bytes`);
	}

	return errors;
}

//write the file to disk, records it, and tells the other members about it.
export async function uploadAttachment(uploadedBy: string, input: UploadAttachmentInput): Promise<AttachmentWithLinks> {
	const errors = validateFileUpload(input);
	if (errors.length > 0) throw new InvalidUploadError(errors);
	await assertFolderUsable(input.projectId, input.folderId ?? null);
	if (input.cardId && !(await cardInProject(input.projectId, input.cardId))) {
		throw new DocumentError("card_not_found", 404);
	}

	const storedName = `${randomUUID()}${ALLOWED_TYPES.get(input.fileType) ?? ""}`;
	await mkdir(UPLOADS_DIR, { recursive: true });
	await writeFile(path.join(UPLOADS_DIR, storedName), input.fileBuffer);

	const attachment = await prisma.attachment.create({
		data: {
			projectId: input.projectId,
			folderId: input.folderId ?? null,
			...(input.cardId ? { cardLinks: { create: { cardId: input.cardId } } } : {}),
			fileUrl: storedName,
			fileName: input.fileName,
			fileSize: input.fileBuffer.length,
			fileType: input.fileType,
			uploadedBy,
		},
		include: { cardLinks: { select: { cardId: true } } },
	});

	void notifyProject({
		projectId: attachment.projectId,
		actorId: uploadedBy,
		type: "file_uploaded",
		text: `a ajouté le fichier « ${attachment.fileName} »`,
		key: "file_uploaded",
		params: { name: attachment.fileName },
		entityId: attachment.id,
		path: `/app/${attachment.projectId}/files`,
	});
	if (input.cardId) notifyDocumentsChanged(input.projectId);
	return withLinks(attachment);
}

export async function listAttachments(projectId: string, cardId?: string): Promise<AttachmentWithLinks[]> {
	const attachments = await prisma.attachment.findMany({
		where: { projectId, ...(cardId ? { cardLinks: { some: { cardId } } } : {}) },
		include: { cardLinks: { select: { cardId: true } } },
		orderBy: { uploadedAt: "desc" },
	});
	return attachments.map(withLinks);
}

export async function moveAttachment(projectId: string, id: string, folderId: string | null): Promise<AttachmentWithLinks> {
	if ((await getAttachment(projectId, id)) === null) throw new DocumentError("attachment_not_found", 404);
	await assertFolderUsable(projectId, folderId);
	const attachment = await prisma.attachment.update({
		where: { id },
		data: { folderId },
		include: { cardLinks: { select: { cardId: true } } },
	});
	return withLinks(attachment);
}

export async function copyAttachment(
	projectId: string,
	id: string,
	userId: string,
	folderId: string | null,
	options: { keepName?: boolean } = {},
): Promise<AttachmentWithLinks> {
	const source = await getAttachment(projectId, id);
	if (source === null) throw new DocumentError("attachment_not_found", 404);
	await assertFolderUsable(projectId, folderId);

	let data: Buffer;
	try {
		data = await readFile(attachmentPath(source));
	} catch {
		throw new DocumentError("attachment_not_found", 404);
	}
	const storedName = `${randomUUID()}${ALLOWED_TYPES.get(source.fileType) ?? ""}`;
	await mkdir(UPLOADS_DIR, { recursive: true });
	await writeFile(path.join(UPLOADS_DIR, storedName), data);

	const beside = folderId === source.folderId;
	const copy = await prisma.attachment.create({
		data: {
			projectId,
			folderId,
			fileUrl: storedName,
			fileName: beside && !options.keepName ? copyName(source.fileName) : source.fileName,
			fileSize: source.fileSize,
			fileType: source.fileType,
			uploadedBy: userId,
		},
		include: { cardLinks: { select: { cardId: true } } },
	});
	return withLinks(copy);
}

function copyName(fileName: string): string {
	const dot = fileName.lastIndexOf(".");
	return dot > 0 ? `${fileName.slice(0, dot)} (copie)${fileName.slice(dot)}` : `${fileName} (copie)`;
}

export async function linkAttachmentToCard(projectId: string, id: string, cardId: string): Promise<void> {
	if ((await getAttachment(projectId, id)) === null) throw new DocumentError("attachment_not_found", 404);
	if (!(await cardInProject(projectId, cardId))) throw new DocumentError("card_not_found", 404);
	await prisma.cardAttachment.upsert({
		where: { cardId_attachmentId: { cardId, attachmentId: id } },
		update: {},
		create: { cardId, attachmentId: id },
	});
	notifyDocumentsChanged(projectId);
}

export async function unlinkAttachmentFromCard(projectId: string, id: string, cardId: string): Promise<void> {
	if ((await getAttachment(projectId, id)) === null) throw new DocumentError("attachment_not_found", 404);
	await prisma.cardAttachment.deleteMany({ where: { cardId, attachmentId: id } });
	notifyDocumentsChanged(projectId);
}

function withLinks(attachment: Attachment & { cardLinks: { cardId: string }[] }): AttachmentWithLinks {
	const { cardLinks, ...rest } = attachment;
	return { ...rest, cardIds: cardLinks.map((link) => link.cardId) };
}

//an id from another project must not resolve here,
export async function getAttachment(projectId: string, id: string): Promise<Attachment | null> {
	return prisma.attachment.findFirst({ where: { id, projectId } });
}

//turn a stored record into the file's location on disk.
export function attachmentPath(attachment: Attachment): string {
	return path.join(UPLOADS_DIR, attachment.fileUrl);
}

//remove the record and then the file. Returns false if there was nothing to delete.
export async function deleteAttachment(projectId: string, id: string): Promise<boolean> {
	const attachment = await getAttachment(projectId, id);
	if (attachment === null) return false;

	//The row goes first: a leftover file on disk is harmless, a row pointing at a missing file is not.
	await prisma.attachment.delete({ where: { id } });
	notifyDocumentsChanged(projectId);
	try {
		await unlink(attachmentPath(attachment));
	} catch {
		//already gone — nothing to clean up
	}

	return true;
}