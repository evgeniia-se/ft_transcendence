//Owner: Track 4 (Whiteboard, notes, and supporting modules)
//Responsible for: Fastify route handler(s) for cross-entity search within a project.
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { requireAuth, requireRole } from "../permissions/permissions.middleware.js";
import { searchAll, SEARCH_SORTS, SEARCH_TYPES, type SearchOptions, type SearchSort, type SearchType } from "./search.service.js";
//max length of search string=query
const MAX_QUERY_LENGTH = 200;
const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;
const MAX_PAGE = 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export async function registerSearchRoutes(app: FastifyInstance): Promise<void> {
	app.get("/:projectId", { preHandler: [requireAuth, requireRole("viewer")] }, searchHandler);
}

type SearchQuery = Partial<Record<"q" | "type" | "tag" | "author" | "from" | "to" | "sort" | "page" | "limit", string>>;

function parseInteger(raw: string | undefined, fallback: number, min: number, max: number): number | null {
	if (raw === undefined || raw === "") return fallback;
	if (!/^\d+$/.test(raw)) return null;
	const value = Number(raw);
	return value >= min && value <= max ? value : null;
}

// a bare day for to means the end of that day
function parseDate(raw: string | undefined, endOfDay: boolean): Date | null | undefined {
	if (raw === undefined || raw === "") return undefined;
	const date = new Date(raw);
	if (Number.isNaN(date.getTime())) return null;
	if (endOfDay && DAY.test(raw)) date.setUTCHours(23, 59, 59, 999);
	return date;
}

export function parseSearchQuery(raw: SearchQuery): { ok: true; value: SearchOptions } | { ok: false; errors: string[] } {
	const errors: string[] = [];
	const query = raw.q?.trim() ?? "";
	if (query.length > MAX_QUERY_LENGTH) errors.push(`q must be at most ${MAX_QUERY_LENGTH} characters`);

	const types = raw.type ? raw.type.split(",").map((t) => t.trim()).filter(Boolean) : SEARCH_TYPES;
	if (types.length === 0 || types.some((t) => !SEARCH_TYPES.includes(t as SearchType))) {
		errors.push(`type must be a comma separated list of ${SEARCH_TYPES.join(", ")}`);
	}

	const sort = raw.sort || "relevance";
	if (!SEARCH_SORTS.includes(sort as SearchSort)) errors.push(`sort must be one of ${SEARCH_SORTS.join(", ")}`);

	if (raw.tag && !UUID.test(raw.tag)) errors.push("tag must be a uuid");
	if (raw.author && !UUID.test(raw.author)) errors.push("author must be a uuid");

	const from = parseDate(raw.from, false);
	const to = parseDate(raw.to, true);
	if (from === null) errors.push("from must be a valid date");
	if (to === null) errors.push("to must be a valid date");
	if (from && to && from.getTime() > to.getTime()) errors.push("from must be before to");

	const page = parseInteger(raw.page, 1, 1, MAX_PAGE);
	const limit = parseInteger(raw.limit, DEFAULT_LIMIT, 1, MAX_LIMIT);
	if (page === null) errors.push(`page must be an integer between 1 and ${MAX_PAGE}`);
	if (limit === null) errors.push(`limit must be an integer between 1 and ${MAX_LIMIT}`);

	if (errors.length > 0) return { ok: false, errors };
	return {
		ok: true,
		value: {
			query,
			types: [...new Set(types)] as SearchType[],
			tagId: raw.tag || undefined,
			authorId: raw.author || undefined,
			from: from ?? undefined,
			to: to ?? undefined,
			sort: sort as SearchSort,
			page: page as number,
			limit: limit as number,
		},
	};
}

//runs a combined cards/notes/attachments search for a project.
async function searchHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	const { projectId } = request.params as { projectId: string };
	const parsed = parseSearchQuery((request.query ?? {}) as SearchQuery);
	if (!parsed.ok) {
		reply.code(400).send({ error: "invalid_input", details: parsed.errors });
		return;
	}
	reply.code(200).send(await searchAll(projectId, parsed.value));
}
