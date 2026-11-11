// Owner: Track 1 (Foundation, Auth, and API infrastructure)
// Responsible for: the shared frontend API client — attaches auth headers and handles base request/response plumbing for every other module

// Every feature module's API wrapper (kanban/cardApi.ts, notes/notesApi.ts, ...) is built on apiRequest.
// auth/authClient.ts deliberately stays separate for signup/login
// this file only reads the session it stores (getStoredToken / clearAuthSession)

import { getStoredToken, clearAuthSession } from "../auth/authClient";
import type { AuthUser } from "../auth/authClient";
import { loginUrl } from "../shared/session";

// API_PREFIX is the single place the backend route prefix lives. nginx proxies `/api/` to the backend
export const API_PREFIX = "/api";
const LOGIN_PATH = "/login";

// Error codes permissions.middleware.ts sends with a 401 when the JWT is unusable
const SESSION_EXPIRED_CODES = new Set(["missing_token", "token_expired", "invalid_token", "unauthenticated"]);
interface ApiRequestOptions {
	method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
	path: string;
	body?: unknown;
	// lets the request finish after the page closes
	keepalive?: boolean;
}

export class ApiError extends Error {
	readonly status: number;
	readonly code: string;
	readonly details: string[];
	readonly payload: Record<string, unknown>;

	constructor(status: number, code: string, details: string[] = [], payload: Record<string, unknown> = {}, message?: string) {
		super(message ?? code);
		this.name = "ApiError";
		this.status = status;
		this.code = code;
		this.details = details;
		this.payload = payload;
	}
}

// apiRequest is the single low-level function every feature module's API wrapper (kanban, notes, attachments, ...) is built on
export async function apiRequest<T>(options: ApiRequestOptions): Promise<T> {
	const token = getStoredToken();

	const headers: Record<string, string> = {};
	if (token) {
		headers["Authorization"] = `Bearer ${token}`;
	}
	// a FormData body (file upload) gets its multipart content type from the browser
	if (options.body !== undefined && !(options.body instanceof FormData)) {
		headers["Content-Type"] = "application/json";
	}

	let res: Response;
	try {
		res = await fetch(`${API_PREFIX}${options.path}`, {
			method: options.method,
			headers,
			body: options.body instanceof FormData ? options.body : options.body !== undefined ? JSON.stringify(options.body) : undefined,
			keepalive: options.keepalive,
		});
	} catch {
		throw new ApiError(0, "network_error", [], {}, "Could not reach the server. Check your connection.");
	}

	if (res.status === 204) {
		return undefined as T;
	}

	let payload: unknown;
	try {
		payload = await res.json();
	} catch {
		payload = undefined;
	}

	if (!res.ok) {
		const errorBody = (payload !== null && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
		const code = typeof errorBody.error === "string" ? errorBody.error : "unknown_error";
		const details = Array.isArray(errorBody.details) ? errorBody.details.map(String) : [];

		if (res.status === 401 && token && SESSION_EXPIRED_CODES.has(code)) {
			handleSessionExpired();
		}
		throw new ApiError(res.status, code, details, errorBody);
	}
	return payload as T;
}

// handleSessionExpired drops the dead local session and redirects to login, unless already ther
function handleSessionExpired(): void {
	clearAuthSession();
	if (window.location.pathname !== LOGIN_PATH) {
		window.location.href = loginUrl();
	}
}

// getCurrentUser fetches the logged-in user's profile, used across the app for header/profile display.
export async function getCurrentUser(): Promise<AuthUser> {
	return apiRequest<AuthUser>({ method: "GET", path: "/users/me" });
}
