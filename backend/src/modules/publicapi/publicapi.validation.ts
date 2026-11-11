
// Owner: Track 1 (Foundation, Auth, and API infrastructure)
// Responsible for: request validation for the Public API endpoints (backend half of the mandatory
// frontend+backend validation requirement). Kanban's own validateCardInput is still a stub, so the
// public API validates its documented request shapes itself before delegating to kanban/card.service.ts.

import { MAX_RATE_LIMIT } from "./apikeys.service.js";

export const MAX_CARD_TITLE_LENGTH = 200;
export const MAX_CARD_DESCRIPTION_LENGTH = 10_000;
export const DEFAULT_PAGE_LIMIT = 50;
export const MAX_PAGE_LIMIT = 100;

export interface CreateCardBody {
	listId: string;
	title: string;
	description?: string;
}

export interface UpdateCardBody {
	title?: string;
	description?: string;
}

export interface ListCardsQuery {
	listId?: string;
	status?: string;
	limit: number;
	offset: number;
}

type Result<T> = { ok: true; value: T } | { ok: false; errors: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function checkTitle(title: unknown, errors: string[]): string | undefined {
	if (typeof title !== "string" || title.trim() === "") {
		errors.push("title is required and must be a non-empty string");
		return undefined;
	}
	if (title.trim().length > MAX_CARD_TITLE_LENGTH) {
		errors.push(`title must be at most ${MAX_CARD_TITLE_LENGTH} characters`);
		return undefined;
	}
	return title.trim();
}

function checkDescription(description: unknown, errors: string[]): string | undefined {
	if (typeof description !== "string") {
		errors.push("description must be a string");
		return undefined;
	}
	if (description.length > MAX_CARD_DESCRIPTION_LENGTH) {
		errors.push(`description must be at most ${MAX_CARD_DESCRIPTION_LENGTH} characters`);
		return undefined;
	}
	return description;
}

//  validateCreateCardBody checks POST /projects/:projectId/cards. Unknown fields are ignored
export function validateCreateCardBody(body: unknown): Result<CreateCardBody> {
	const errors: string[] = [];
	if (!isRecord(body)) {
		return { ok: false, errors: ["request body must be a JSON object"] };
	}

	if (typeof body.listId !== "string" || body.listId.trim() === "") {
		errors.push("listId is required and must be a non-empty string");
	}
	const title = checkTitle(body.title, errors);
	const description = body.description === undefined ? undefined : checkDescription(body.description, errors);

	if (errors.length > 0) {
		return { ok: false, errors };
	}
	return { ok: true, value: { listId: (body.listId as string).trim(), title: title as string, description }};
}

// validateUpdateCardBody checks PUT /projects/:projectId/cards/:cardId
export function validateUpdateCardBody(body: unknown): Result<UpdateCardBody> {
	const errors: string[] = [];
	if (!isRecord(body)) {
		return { ok: false, errors: ["request body must be a JSON object"] };
	}
	if (body.title === undefined && body.description === undefined) {
		return { ok: false, errors: ["at least one of title or description is required"] };
	}

	const value: UpdateCardBody = {};
	if (body.title !== undefined) {
		value.title = checkTitle(body.title, errors);
	}
	if (body.description !== undefined) {
		value.description = checkDescription(body.description, errors);
	}

	if (errors.length > 0) {
		return { ok: false, errors };
	}
	return { ok: true, value };
}

function parseIntParam(raw: unknown, name: string, min: number, max: number, fallback: number, errors: string[]): number {
	if (raw === undefined) {
		return fallback;
	}
	const parsed = typeof raw === "string" && /^\d+$/.test(raw) ? Number.parseInt(raw, 10) : NaN;
	if (Number.isNaN(parsed) || parsed < min || parsed > max) {
		errors.push(`${name} must be an integer between ${min} and ${max}`);
		return fallback;
	}
	return parsed;
}

// validateListCardsQuery checks GET /projects/:projectId/cards query params (listId, status, limit, offset)
export function validateListCardsQuery(query: unknown): Result<ListCardsQuery> {
	const q = isRecord(query) ? query : {};
	const errors: string[] = [];

	const limit = parseIntParam(q.limit, "limit", 1, MAX_PAGE_LIMIT, DEFAULT_PAGE_LIMIT, errors);
	const offset = parseIntParam(q.offset, "offset", 0, Number.MAX_SAFE_INTEGER, 0, errors);

	for (const name of ["listId", "status"] as const) {
		if (q[name] !== undefined && (typeof q[name] !== "string" || (q[name] as string).trim() === "")) {
			errors.push(`${name} must be a non-empty string`);
		}
	}

	if (errors.length > 0) {
		return { ok: false, errors };
	}
	return {
		ok: true,
		value: {
			listId: q.listId as string | undefined,
			status: q.status as string | undefined,
			limit,
			offset,
		}
	};
}

// validateIssueApiKeyBody checks POST /projects/:projectId/api-keys
export function validateIssueApiKeyBody(body: unknown): Result<{ rateLimit?: number }> {
	if (body === undefined || body === null) {
		return { ok: true, value: {} };
	}
	if (!isRecord(body)) {
		return { ok: false, errors: ["request body must be a JSON object"] };
	}
	if (body.rateLimit === undefined) {
		return { ok: true, value: {} };
	}
	if (!Number.isInteger(body.rateLimit) || (body.rateLimit as number) < 1 || (body.rateLimit as number) > MAX_RATE_LIMIT) {
		return { ok: false, errors: [`rateLimit must be an integer between 1 and ${MAX_RATE_LIMIT}`] };
	}
	return { ok: true, value: { rateLimit: body.rateLimit as number } };
}

