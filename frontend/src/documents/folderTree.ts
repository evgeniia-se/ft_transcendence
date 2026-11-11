// Owner: Track 4 (Whiteboard, notes, and supporting modules)
// Responsible for: pure helpers over the flat folder list
import type { Folder } from "./foldersApi";

export function childrenOf(folders: Folder[], parentId: string | null): Folder[] {
	return folders.filter((folder) => folder.parentId === parentId).sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

export function pathTo(folders: Folder[], id: string | null): Folder[] {
	const byId = new Map(folders.map((folder) => [folder.id, folder]));
	const path: Folder[] = [];
	for (let cursor = id; cursor !== null; cursor = byId.get(cursor)?.parentId ?? null) {
		const folder = byId.get(cursor);
		if (!folder) break;
		path.unshift(folder);
	}
	return path;
}

export function subtreeIds(folders: Folder[], id: string): Set<string> {
	const ids = new Set([id]);
	for (const child of childrenOf(folders, id)) {
		for (const descendant of subtreeIds(folders, child.id)) ids.add(descendant);
	}
	return ids;
}
