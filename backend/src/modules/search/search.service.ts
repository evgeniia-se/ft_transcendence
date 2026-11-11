//Owner: Track 4 (Whiteboard, notes, and supporting modules)
//user can search a word in notes, cards, and attachments within a project; this service returns the results to the frontend
import { prisma } from "../../db/prisma/client.js";
export type SearchType = "card" | "note" | "attachment";
export type SearchSort = "relevance" | "date" | "title";

export const SEARCH_TYPES: SearchType[] = ["card", "note", "attachment"];
export const SEARCH_SORTS: SearchSort[] = ["relevance", "date", "title"];

//interface defines the structure of a search result
export interface SearchResult {
	entityType: SearchType;//type
	entityId: string;//ID
	title: string;//title
	snippet: string;//snippet,resume
	date: string;
	author: { id: string; name: string } | null;
	tags: { id: string; name: string; color: string }[];
	folderId?: string | null;
}

export interface SearchOptions {
	query: string;
	types: SearchType[];
	tagId?: string;
	authorId?: string;
	from?: Date;
	to?: Date;
	sort: SearchSort;
	page: number;
	limit: number;
}

export interface SearchPage {
	results: SearchResult[];
	total: number;
	page: number;
	limit: number;
}

type Scored = SearchResult & { score: number };

// safety cap on rows read per type before sorting
const MAX_SCAN_PER_TYPE = 500;
const SNIPPET_RADIUS = 60;//before and after the match, how many charaters to show in the snippet

//intern helper function, make a snippet/query=word to search for, text=the content to search in
function makeSnippet(text: string, query: string): string {
	const at = text.toLowerCase().indexOf(query.toLowerCase());//first index of the query in the text
	if (at === -1) return text.slice(0, SNIPPET_RADIUS * 2);//show the first 120 charaters if the query is not found

	const start = Math.max(0, at - SNIPPET_RADIUS);//start index of the snippet, 60 charaters before the match
	const end = Math.min(text.length, at + query.length + SNIPPET_RADIUS);//end index of the snippet, 60 charaters after the match
	return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
}//return a snippet with the query highlighted, and ellipses if the snippet is not at the start or end of the text

// extractPlainText walks a Tiptap JSON document and returns only the text it contains,
// so search never matches or displays structural keys like "type" or "content".
export function extractPlainText(node: unknown): string {
	if (node === null || typeof node !== "object") return "";

	if (Array.isArray(node)) {
		return node.map(extractPlainText).join("");
	}

	const record = node as { type?: unknown; text?: unknown; content?: unknown };

	if (record.type === "text" && typeof record.text === "string") {
		return record.text;
	}

	const inner = extractPlainText(record.content);
	// paragraphs and headings are separate blocks: add a space so words don't run together
	return record.type === "paragraph" || record.type === "heading" ? `${inner} ` : inner;
}

function countOccurrences(text: string, needle: string): number {
	let count = 0;
	for (let at = text.indexOf(needle); at !== -1; at = text.indexOf(needle, at + needle.length)) count++;
	return count;
}

// title match weighs more than a match in the body
function relevance(title: string, body: string, query: string): number {
	if (query === "") return 0;
	const needle = query.toLowerCase();
	const name = title.toLowerCase();
	let score = 0;
	if (name === needle) score += 100;
	else if (name.startsWith(needle)) score += 60;
	else if (name.includes(needle)) score += 40;
	return score + Math.min(countOccurrences(body.toLowerCase(), needle), 10) * 5;
}

function dateRange(options: SearchOptions): { gte?: Date; lte?: Date } | undefined {
	if (!options.from && !options.to) return undefined;
	return { ...(options.from ? { gte: options.from } : {}), ...(options.to ? { lte: options.to } : {}) };
}

export async function searchCards(projectId: string, options: SearchOptions): Promise<Scored[]> {
	const query = options.query;
	const range = dateRange(options);
	const cards = await prisma.card.findMany({
		where: {
			list: { board: { projectId } },
			...(query ? { OR: [
				{ title: { contains: query, mode: "insensitive" } },
				{ description: { contains: query, mode: "insensitive" } },
			] } : {}),
			...(options.tagId ? { tags: { some: { tagId: options.tagId } } } : {}),
			...(options.authorId ? { createdBy: options.authorId } : {}),
			...(range ? { updatedAt: range } : {}),
		},
		include: {
			creator: { select: { id: true, name: true } },
			tags: { select: { tag: { select: { id: true, name: true, color: true } } } },
		},
		take: MAX_SCAN_PER_TYPE,
		orderBy: { updatedAt: "desc" },
	});

	return cards.map((card) => ({
		entityType: "card" as const,
		entityId: card.id,
		title: card.title,
		snippet: makeSnippet(card.description || card.title, query),
		date: card.updatedAt.toISOString(),
		author: card.creator,
		tags: card.tags.map((row) => row.tag),
		score: relevance(card.title, card.description ?? "", query),
	}));
}

// notes have no tags so a tag filter leaves them out
export async function searchNotes(projectId: string, options: SearchOptions): Promise<Scored[]> {
	if (options.tagId) return [];
	const query = options.query;
	const needle = query.toLowerCase();
	const range = dateRange(options);
	const notes = await prisma.note.findMany({
		where: {
			projectId,
			...(options.authorId ? { updatedBy: options.authorId } : {}),
			...(range ? { updatedAt: range } : {}),
		},
		include: { editor: { select: { id: true, name: true } } },
		orderBy: { updatedAt: "desc" },
		take: MAX_SCAN_PER_TYPE,
	});

	const results: Scored[] = [];
	for (const note of notes) {
		const text = extractPlainText(note.contentJson).trim();
		const inTitle = note.title.toLowerCase().includes(needle);
		const inText = text.toLowerCase().includes(needle);
		if (query && !inTitle && !inText) continue;
		results.push({
			entityType: "note",
			entityId: note.id,
			title: note.title,
			snippet: makeSnippet(inText || !query ? text || note.title : note.title, query),
			date: note.updatedAt.toISOString(),
			author: note.editor,
			tags: [],
			score: relevance(note.title, text, query),
		});
		if (results.length === MAX_SCAN_PER_TYPE) break;
	}
	return results;
}

export async function searchAttachments(projectId: string, options: SearchOptions): Promise<Scored[]> {
	if (options.tagId) return [];
	const query = options.query;
	const range = dateRange(options);
	const attachments = await prisma.attachment.findMany({
		where: {
			projectId,
			...(query ? { fileName: { contains: query, mode: "insensitive" } } : {}),
			...(options.authorId ? { uploadedBy: options.authorId } : {}),
			...(range ? { uploadedAt: range } : {}),
		},
		include: { uploader: { select: { id: true, name: true } } },
		take: MAX_SCAN_PER_TYPE,
		orderBy: { uploadedAt: "desc" },
	});

	return attachments.map((attachment) => ({
		entityType: "attachment" as const,
		entityId: attachment.id,
		title: attachment.fileName,
		snippet: attachment.fileType,
		date: attachment.uploadedAt.toISOString(),
		author: attachment.uploader,
		tags: [],
		folderId: attachment.folderId,
		score: relevance(attachment.fileName, "", query),
	}));
}

function compare(sort: SearchSort): (a: Scored, b: Scored) => number {
	const byDate = (a: Scored, b: Scored): number => b.date.localeCompare(a.date);
	if (sort === "date") return byDate;
	if (sort === "title") return (a, b) => a.title.localeCompare(b.title, "fr", { sensitivity: "base" }) || byDate(a, b);
	return (a, b) => b.score - a.score || byDate(a, b);
}

// search every type then sort and keep one page
export async function searchAll(projectId: string, options: SearchOptions): Promise<SearchPage> {
	const wanted = new Set(options.types);
	const [cards, notes, attachments] = await Promise.all([
		wanted.has("card") ? searchCards(projectId, options) : [],
		wanted.has("note") ? searchNotes(projectId, options) : [],
		wanted.has("attachment") ? searchAttachments(projectId, options) : [],
	]);

	const all = [...cards, ...notes, ...attachments].sort(compare(options.sort));
	const start = (options.page - 1) * options.limit;
	const results: SearchResult[] = all.slice(start, start + options.limit).map((row) => {
		const result: SearchResult & { score?: number } = { ...row };
		delete result.score;
		return result;
	});
	return { results, total: all.length, page: options.page, limit: options.limit };
}
