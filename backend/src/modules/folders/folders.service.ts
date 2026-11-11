//Owner: Track 4 (Whiteboard, notes, and supporting modules)
//Responsible for: the folder tree of the Files page
import type { Folder } from "@prisma/client";
import { prisma } from "../../db/prisma/client.js";
import { DocumentError } from "./documentError.js";

//override with FOLDER_MAX_SUBFOLDERS and FOLDER_MAX_DEPTH
export const MAX_SUBFOLDERS = positiveInt(process.env.FOLDER_MAX_SUBFOLDERS, 60);
export const MAX_DEPTH = positiveInt(process.env.FOLDER_MAX_DEPTH, 8);
const MAX_NAME_LENGTH = 100;

function positiveInt(raw: string | undefined, fallback: number): number {
	const value = Number(raw);
	return Number.isInteger(value) && value > 0 ? value : fallback;
}

export async function listFolders(projectId: string): Promise<Folder[]> {
	return prisma.folder.findMany({ where: { projectId }, orderBy: { name: "asc" } });
}

export async function createFolder(
	projectId: string,
	userId: string,
	input: { name: string; parentId: string | null },
): Promise<Folder> {
	const name = cleanName(input.name);
	const tree = await loadTree(projectId);

	if (input.parentId !== null && !tree.has(input.parentId)) throw new DocumentError("folder_not_found", 404);
	if (depthOf(tree, input.parentId) + 1 > MAX_DEPTH) throw new DocumentError("max_depth_reached", 409);
	if (childrenOf(tree, input.parentId).length >= MAX_SUBFOLDERS) throw new DocumentError("max_subfolders_reached", 409);

	return prisma.folder.create({
		data: { projectId, name, parentId: input.parentId, createdBy: userId },
	});
}

//parentId undefined keeps the parent and null moves to the top level
export async function updateFolder(
	projectId: string,
	id: string,
	input: { name?: string; parentId?: string | null },
): Promise<Folder> {
	const folder = await prisma.folder.findFirst({ where: { id, projectId } });
	if (!folder) throw new DocumentError("folder_not_found", 404);

	const data: { name?: string; parentId?: string | null } = {};
	if (input.name !== undefined) data.name = cleanName(input.name);

	if (input.parentId !== undefined && input.parentId !== folder.parentId) {
		const tree = await loadTree(projectId);
		const target = input.parentId;
		if (target !== null && !tree.has(target)) throw new DocumentError("folder_not_found", 404);
		for (let cursor: string | null = target; cursor !== null; cursor = tree.get(cursor)?.parentId ?? null) {
			if (cursor === id) throw new DocumentError("folder_cycle", 409);
		}
		if (depthOf(tree, target) + 1 + heightBelow(tree, id) > MAX_DEPTH) throw new DocumentError("max_depth_reached", 409);
		if (childrenOf(tree, target).length >= MAX_SUBFOLDERS) throw new DocumentError("max_subfolders_reached", 409);
		data.parentId = target;
	}

	return prisma.folder.update({ where: { id }, data });
}

export async function deleteFolder(projectId: string, id: string): Promise<Folder> {
	const folder = await prisma.folder.findFirst({
		where: { id, projectId },
		include: { _count: { select: { children: true, attachments: true } } },
	});
	if (!folder) throw new DocumentError("folder_not_found", 404);
	const { children, attachments } = folder._count;
	if (children + attachments > 0) throw new DocumentError("folder_not_empty", 409);
	return prisma.folder.delete({ where: { id } });
}

export async function assertFolderUsable(projectId: string, folderId: string | null): Promise<void> {
	if (folderId === null) return;
	const folder = await prisma.folder.findFirst({ where: { id: folderId, projectId }, select: { id: true } });
	if (!folder) throw new DocumentError("folder_not_found", 404);
}

export async function cardInProject(projectId: string, cardId: string): Promise<boolean> {
	const card = await prisma.card.findFirst({ where: { id: cardId, list: { board: { projectId } } }, select: { id: true } });
	return card !== null;
}

export type Tree = Map<string, Folder>;

export async function loadTree(projectId: string): Promise<Tree> {
	return new Map((await listFolders(projectId)).map((folder) => [folder.id, folder]));
}

export function childrenOf(tree: Tree, parentId: string | null): Folder[] {
	return [...tree.values()].filter((folder) => folder.parentId === parentId);
}

//top level is 1 and null is 0
export function depthOf(tree: Tree, id: string | null): number {
	let depth = 0;
	for (let cursor = id; cursor !== null; cursor = tree.get(cursor)?.parentId ?? null) depth++;
	return depth;
}

export function heightBelow(tree: Tree, id: string): number {
	const children = childrenOf(tree, id);
	return children.length === 0 ? 0 : 1 + Math.max(...children.map((child) => heightBelow(tree, child.id)));
}

export function cleanName(raw: string): string {
	const name = raw.trim();
	if (name === "" || name.length > MAX_NAME_LENGTH) throw new DocumentError("invalid_name", 400);
	return name;
}
