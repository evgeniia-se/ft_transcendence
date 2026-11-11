// Owner: Track 4 (Whiteboard, notes, and supporting modules)
// Responsible for: the File upload minor module. Files live on disk under UPLOADS_DIR, which
// docker-compose mounts as a named volume; the database only stores metadata.
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../../db/prisma/client.js";
import { createNotification } from "../notifications/notifications.service.js";
// /app/uploads inside the container, backend/uploads locally (both gitignored).
const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MiB
//map of allowed MIME types to their file extensions. The extension is only used for the stored name, not the original name.
const ALLOWED_TYPES = new Map([
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
//carry the reasons, so the route can answer 400 with details.
export class InvalidUploadError extends Error {
    details;
    constructor(details) {
        super("invalid_upload");
        this.name = "InvalidUploadError";
        this.details = details;
    }
}
//check type and size before anything touches the disk.
export function validateFileUpload(input) {
    const errors = [];
    if (input.fileName.trim() === "")
        errors.push("fileName is required");
    if (!ALLOWED_TYPES.has(input.fileType))
        errors.push(`fileType ${input.fileType} is not allowed`);
    if (input.fileBuffer.length === 0)
        errors.push("the file is empty");
    if (input.fileBuffer.length > MAX_FILE_BYTES) {
        errors.push(`the file is larger than ${MAX_FILE_BYTES} bytes`);
    }
    return errors;
}
//write the file to disk, records it, and tells the other members about it.
export async function uploadAttachment(uploadedBy, input) {
    const errors = validateFileUpload(input);
    if (errors.length > 0)
        throw new InvalidUploadError(errors);
    const storedName = `${randomUUID()}${ALLOWED_TYPES.get(input.fileType) ?? ""}`;
    await mkdir(UPLOADS_DIR, { recursive: true });
    await writeFile(path.join(UPLOADS_DIR, storedName), input.fileBuffer);
    const attachment = await prisma.attachment.create({
        data: {
            projectId: input.projectId,
            cardId: input.cardId ?? null,
            fileUrl: storedName,
            fileName: input.fileName,
            fileSize: input.fileBuffer.length,
            fileType: input.fileType,
            uploadedBy,
        },
    });
    await notifyProjectMembers(attachment, uploadedBy);
    return attachment;
}
//Everyone on the project except the uploader hears about a new file.
async function notifyProjectMembers(attachment, uploadedBy) {
    const members = await prisma.projectMember.findMany({
        where: { projectId: attachment.projectId, userId: { not: uploadedBy } },
        select: { userId: true },
    });
    await Promise.all(members.map((member) => createNotification(member.userId, "file_uploaded", {
        attachmentId: attachment.id,
        projectId: attachment.projectId,
        fileName: attachment.fileName,
    })));
}
//return a project's files, newest first.
export async function listAttachments(projectId) {
    return prisma.attachment.findMany({
        where: { projectId },
        orderBy: { uploadedAt: "desc" },
    });
}
//an id from another project must not resolve here,
export async function getAttachment(projectId, id) {
    return prisma.attachment.findFirst({ where: { id, projectId } });
}
//turn a stored record into the file's location on disk.
export function attachmentPath(attachment) {
    return path.join(UPLOADS_DIR, attachment.fileUrl);
}
//remove the record and then the file. Returns false if there was nothing to delete.
export async function deleteAttachment(projectId, id) {
    const attachment = await getAttachment(projectId, id);
    if (attachment === null)
        return false;
    //The row goes first: a leftover file on disk is harmless, a row pointing at a missing file is not.
    await prisma.attachment.delete({ where: { id } });
    try {
        await unlink(attachmentPath(attachment));
    }
    catch {
        //already gone — nothing to clean up
    }
    return true;
}
//# sourceMappingURL=attachments.service.js.map