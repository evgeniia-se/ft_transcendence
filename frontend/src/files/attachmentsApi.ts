// Owner: Track 4 (Whiteboard, notes, and supporting modules)
// Responsible for: frontend API calls for the File upload module.
import { apiRequest, API_PREFIX } from "../api/apiClient";
import { getStoredToken } from "../auth/authClient";
import { t } from "../shared/i18n.svelte";

export interface Attachment {
	id: string;
	projectId: string;
	folderId: string | null;
	cardIds: string[];
	fileUrl: string;
	fileName: string;
	fileSize: number;
	fileType: string;
	uploadedBy: string | null;
	uploadedAt: string;
}


export class UploadError extends Error {
	readonly status: number;
	readonly details: string[];

	constructor(code: string, details: string[], status: number) {
		super(code);
		this.name = "UploadError";
		this.status = status;
		this.details = details;
	}
}
export async function listAttachments(projectId: string, cardId?: string): Promise<Attachment[]> {
	const { attachments } = await apiRequest<{ attachments: Attachment[] }>({
		method: "GET",
		path: `/attachments/${projectId}${cardId ? `?cardId=${encodeURIComponent(cardId)}` : ""}`,
	});
	return attachments;
}

export async function moveAttachment(projectId: string, id: string, folderId: string | null): Promise<Attachment> {
	const { attachment } = await apiRequest<{ attachment: Attachment }>({
		method: "PATCH",
		path: `/attachments/${projectId}/${id}`,
		body: { folderId },
	});
	return attachment;
}

export async function copyAttachment(projectId: string, id: string, folderId: string | null): Promise<Attachment> {
	const { attachment } = await apiRequest<{ attachment: Attachment }>({
		method: "POST",
		path: `/attachments/${projectId}/${id}/copy`,
		body: { folderId },
	});
	return attachment;
}

export function linkAttachmentToCard(projectId: string, id: string, cardId: string): Promise<void> {
	return apiRequest<void>({ method: "PUT", path: `/attachments/${projectId}/${id}/cards/${cardId}` });
}

export function unlinkAttachmentFromCard(projectId: string, id: string, cardId: string): Promise<void> {
	return apiRequest<void>({ method: "DELETE", path: `/attachments/${projectId}/${id}/cards/${cardId}` });
}
export function deleteAttachment(projectId: string, id: string): Promise<void> {
	return apiRequest<void>({ method: "DELETE", path: `/attachments/${projectId}/${id}` });
}

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

// same list as the server
export const ALLOWED_UPLOADS: Record<string, string[]> = {
	"image/png": [".png"],
	"image/jpeg": [".jpg", ".jpeg"],
	"image/gif": [".gif"],
	"image/webp": [".webp"],
	"application/pdf": [".pdf"],
	"text/plain": [".txt"],
	"text/markdown": [".md", ".markdown"],
	"application/json": [".json"],
	"application/zip": [".zip"],
};

export const UPLOAD_ACCEPT = [...Object.keys(ALLOWED_UPLOADS), ...Object.values(ALLOWED_UPLOADS).flat()].join(",");

const TYPE_BY_EXTENSION = new Map(Object.entries(ALLOWED_UPLOADS).flatMap(([type, exts]) => exts.map((ext) => [ext, type] as const)));

function extensionOf(name: string): string {
	const dot = name.lastIndexOf(".");
	return dot > 0 ? name.slice(dot).toLowerCase() : "";
}

// browsers often leave the type empty for md files so guess it from the name
export function uploadType(file: File): string | null {
	if (file.type && file.type in ALLOWED_UPLOADS) return file.type;
	if (file.type && file.type !== "application/octet-stream" && file.type !== "application/x-zip-compressed") return null;
	return TYPE_BY_EXTENSION.get(extensionOf(file.name)) ?? null;
}

export function validateUpload(file: File): string | null {
	if (file.name.trim() === "") return t("files.noName");
	if (file.size === 0) return t("files.isEmpty", { name: file.name });
	if (file.size > MAX_UPLOAD_BYTES) return t("files.nameTooLarge", { name: file.name });
	if (!uploadType(file)) return t("files.nameTypeRejected", { name: file.name });
	return null;
}

// XHR because fetch cannot report upload progress
export function uploadAttachment(
	projectId: string,
	file: File,
	folderId: string | null = null,
	onProgress?: (ratio: number) => void,
): Promise<Attachment> {
	const type = uploadType(file) ?? file.type;
	const form = new FormData();
	form.append("file", type === file.type ? file : new File([file], file.name, { type }));

	const query = folderId ? `?folderId=${encodeURIComponent(folderId)}` : "";
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open("POST", `${API_PREFIX}/attachments/${projectId}${query}`);
		xhr.setRequestHeader("Authorization", `Bearer ${getStoredToken() ?? ""}`);
		xhr.upload.onprogress = (event) => {
			if (event.lengthComputable) onProgress?.(event.loaded / event.total);
		};
		xhr.onerror = () => reject(new UploadError("network_error", [], 0));
		xhr.onload = () => {
			let payload: { attachment?: Attachment; error?: string; details?: string[] } = {};
			try {
				payload = JSON.parse(xhr.responseText);
			} catch {
				payload = {};
			}
			if (xhr.status >= 200 && xhr.status < 300 && payload.attachment) {
				resolve(payload.attachment);
				return;
			}
			reject(new UploadError(payload.error ?? "upload_failed", payload.details ?? [], xhr.status));
		};
		xhr.send(form);
	});
}

//the route needs the token so an img src cannot load it
export async function fetchAttachmentBlob(projectId: string, attachment: Attachment): Promise<Blob> {
	const response = await fetch(`${API_PREFIX}/attachments/${projectId}/${attachment.id}`, {
		headers: { Authorization: `Bearer ${getStoredToken() ?? ""}` },
	});
	if (!response.ok) throw new Error("download_failed");
	return response.blob();
}

export function isImage(attachment: Attachment): boolean {
	return attachment.fileType.startsWith("image/");
}

export function isPdf(attachment: Attachment): boolean {
	return attachment.fileType === "application/pdf";
}

export function isText(attachment: Attachment): boolean {
	return ["text/plain", "text/markdown", "application/json"].includes(attachment.fileType);
}

export function isPreviewable(attachment: Attachment): boolean {
	return isImage(attachment) || isPdf(attachment) || isText(attachment);
}

export async function downloadAttachment(projectId: string, attachment: Attachment): Promise<void> {
	const blob = await fetchAttachmentBlob(projectId, attachment);
	const url = URL.createObjectURL(blob);

	const link = document.createElement("a");
	link.href = url;
	link.download = attachment.fileName;
	link.click();
	URL.revokeObjectURL(url);
}