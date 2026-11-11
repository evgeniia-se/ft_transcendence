//Owner: Track 4 (Whiteboard, notes, and supporting modules)
//Responsible for: copying a folder tree kept apart from the folders service to avoid a circular import
import type { Folder } from "@prisma/client";
import { prisma } from "../../db/prisma/client.js";
import { copyAttachment } from "../attachments/attachments.service.js";
import { DocumentError } from "./documentError.js";
import {
	MAX_DEPTH,
	MAX_SUBFOLDERS,
	childrenOf,
	depthOf,
	heightBelow,
	loadTree,
} from "./folders.service.js";

//not atomic a failed file copy leaves a partial copy behind
export async function copyFolder(
	projectId: string,
	userId: string,
	id: string,
	targetParentId: string | null,
): Promise<Folder> {
	const tree = await loadTree(projectId);
	const source = tree.get(id);
	if (!source) throw new DocumentError("folder_not_found", 404);
	if (targetParentId !== null && !tree.has(targetParentId)) throw new DocumentError("folder_not_found", 404);

	for (let cursor: string | null = targetParentId; cursor !== null; cursor = tree.get(cursor)?.parentId ?? null) {
		if (cursor === id) throw new DocumentError("folder_cycle", 409);
	}
	if (depthOf(tree, targetParentId) + 1 + heightBelow(tree, id) > MAX_DEPTH) throw new DocumentError("max_depth_reached", 409);
	if (childrenOf(tree, targetParentId).length >= MAX_SUBFOLDERS) throw new DocumentError("max_subfolders_reached", 409);

	const beside = targetParentId === source.parentId;
	const name = beside ? `${source.name} (copie)`.slice(0, 100) : source.name;
	return duplicate(source.id, targetParentId, name);

	async function duplicate(folderId: string, parentId: string | null, folderName: string): Promise<Folder> {
		const created = await prisma.folder.create({
			data: { projectId, parentId, name: folderName, createdBy: userId },
		});
		const files = await prisma.attachment.findMany({ where: { projectId, folderId }, select: { id: true } });
		for (const file of files) await copyAttachment(projectId, file.id, userId, created.id, { keepName: true });
		for (const child of childrenOf(tree, folderId)) await duplicate(child.id, created.id, child.name);
		return created;
	}
}
