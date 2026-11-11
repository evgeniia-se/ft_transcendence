// Owner: Track 4 (Whiteboard, notes, and supporting modules)
// Responsible for: the type badge and size shown on a file tile
import { t } from "../shared/i18n.svelte";

export function extensionBadge(file: { fileName: string; fileType: string }): string {
	const dot = file.fileName.lastIndexOf(".");
	const ext = dot > 0 ? file.fileName.slice(dot + 1) : (file.fileType.split("/")[1] ?? "");
	return ext.slice(0, 4).toUpperCase() || t("fileInfo.badge");
}

export function humanSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} ${t("size.b")}`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ${t("size.kb")}`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} ${t("size.mb")}`;
}
