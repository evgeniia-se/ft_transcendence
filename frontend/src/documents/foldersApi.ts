// Owner: Track 4 (Whiteboard, notes, and supporting modules)
// Responsible for: frontend API calls for the folder tree of the Files page
import { ApiError, apiRequest } from "../api/apiClient";
import { t } from "../shared/i18n.svelte";

export interface Folder {
	id: string;
	projectId: string;
	parentId: string | null;
	name: string;
	createdBy: string | null;
	createdAt: string;
}

export interface FolderLimits {
	maxSubfolders: number;
	maxDepth: number;
}

export function listFolders(projectId: string): Promise<{ folders: Folder[]; limits: FolderLimits }> {
	return apiRequest({ method: "GET", path: `/folders/${projectId}` });
}

export async function createFolder(projectId: string, name: string, parentId: string | null): Promise<Folder> {
	const { folder } = await apiRequest<{ folder: Folder }>({
		method: "POST",
		path: `/folders/${projectId}`,
		body: { name, parentId },
	});
	return folder;
}

export async function updateFolder(
	projectId: string,
	id: string,
	patch: { name?: string; parentId?: string | null },
): Promise<Folder> {
	const { folder } = await apiRequest<{ folder: Folder }>({ method: "PATCH", path: `/folders/${projectId}/${id}`, body: patch });
	return folder;
}

export async function copyFolder(projectId: string, id: string, parentId: string | null): Promise<Folder> {
	const { folder } = await apiRequest<{ folder: Folder }>({
		method: "POST",
		path: `/folders/${projectId}/${id}/copy`,
		body: { parentId },
	});
	return folder;
}

export function deleteFolder(projectId: string, id: string): Promise<void> {
	return apiRequest<void>({ method: "DELETE", path: `/folders/${projectId}/${id}` });
}

export function describeDocumentError(error: unknown, limits?: FolderLimits): string {
	if (!(error instanceof ApiError)) return t("folders.failed");
	switch (error.code) {
		case "max_depth_reached":
			return t("folders.maxDepth", { n: limits?.maxDepth ?? 8 });
		case "max_subfolders_reached":
			return t("folders.maxSubfolders", { n: limits?.maxSubfolders ?? 60 });
		case "folder_not_empty":
			return t("folders.notEmpty");
		case "folder_cycle":
			return t("folders.cycle");
		case "invalid_name":
			return t("folders.invalidName");
		case "invalid_title":
			return t("folders.invalidTitle");
		case "folder_not_found":
			return t("folders.notFound");
		case "insufficient_role":
			return t("error.forbidden");
		default:
			return t("folders.failed");
	}
}
