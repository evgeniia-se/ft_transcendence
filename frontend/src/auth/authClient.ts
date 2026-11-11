// Owner: Track 1 (Foundation, Auth, and API infrastructure)
// Responsible for: auth-specific HTTP calls (signup/login/logout) and the client-side session
// (JWT + user profile) that loginForm.ts, signupForm.ts, and oauthFlow.ts all read/write.

const AUTH_API_BASE = "/api/auth";
const TOKEN_STORAGE_KEY = "ft_transcendence.auth.token";
const USER_STORAGE_KEY = "ft_transcendence.auth.user";
export const USER_UPDATED_EVENT = "ft:user-updated";

export interface AuthUser {
	id: string;
	email: string;
	name: string;
	// uploaded picture path, a GitHub URL, or none (the default avatar is drawn from the name)
	avatar?: string | null;
}

export interface AuthResponse {
	token: string;
	user: AuthUser;
}

export interface SignupInput {
	email: string;
	password: string;
	name: string;
}

export interface LoginInput {
	email: string;
	password: string;
}

// AuthApiError wraps a failed auth request
export class AuthApiError extends Error {
	readonly status: number;
	readonly code: string;
	readonly details: string[];

	constructor(status: number, code: string, details: string[] = [], message?: string) {
		super(message ?? code);
		this.name = "AuthApiError";
		this.status = status;
		this.code = code;
		this.details = details;
	}
}

// authRequest is the low-level function signup/login/logout are built on, deliberately separate from
// apiClient.ts's apiRequest `authToken` is only ever passed by logout(), which is the
// one auth-module call made by an already-authenticated user
async function authRequest<T>(path: string, body?: unknown, authToken?: string): Promise<T> {
	let res: Response;
	try {
		res = await fetch(`${AUTH_API_BASE}${path}`, {
			method: "POST",
			headers: {"Content-Type": "application/json",...(authToken ? { Authorization: `Bearer ${authToken}` }: {}),},
			body: body !== undefined ? JSON.stringify(body): undefined,
		});
	} catch {
		throw new AuthApiError(0, "network_error", [], "Could not reach the server. Check your connection.");
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
		const errorBody = (payload ?? {}) as { error?: string; details?: string[]};
		throw new AuthApiError(res.status, errorBody.error ?? "unknown_error", errorBody.details ?? []);
	}

	return payload as T;
}

// signup calls POST /api/auth/signup
export function signup(input: SignupInput): Promise<AuthResponse> {
	return authRequest<AuthResponse>("/signup", input);
}

// login calls POST /api/auth/login
export function login(input: LoginInput): Promise<AuthResponse> {
	return authRequest<AuthResponse>("/login", input);
}

// logout calls POST /api/auth/logout
export async function logout(): Promise<void> {
	const token = getStoredToken();
	try {
		await authRequest<void>("/logout", undefined, token ?? undefined);
	} catch {
	// Ignore server errors — local logout must always succeed
	}
	clearAuthSession();
}

// --- session storage
// localStorage because this is a multi-page app, so any session state kept only in
// a JS variable would be lost the moment login redirects to the dashboard

export function getStoredToken(): string | null {
	try {
		return localStorage.getItem(TOKEN_STORAGE_KEY);
	} catch {
		return null;
	}
}

export function getStoredUser(): AuthUser | null {
	try {
		const raw = localStorage.getItem(USER_STORAGE_KEY);
		return raw ? (JSON.parse(raw) as AuthUser) : null;
	} catch {
		return null;
	}
}

export function isAuthenticated(): boolean {
	return getStoredToken() !== null;
}

// storeAuthSession persists both the token and user profile — used after signup/login, which return both
export function storeAuthSession(session: AuthResponse): void {
	try {
		localStorage.setItem(TOKEN_STORAGE_KEY, session.token);
		localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(session.user));
	} catch {
		// storage unavailable and nothing more we can do client-side
	}
}

export function storeToken(token: string): void {
	try {
		localStorage.setItem(TOKEN_STORAGE_KEY, token);
	} catch {
		// nothing more we can do client-side
	}
}

// storeUser persists just the profile — used when the token arrived on its own (GitHub OAuth)
export function storeUser(user: AuthUser): void {
	try {
		localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
	} catch {
	}
	// the account menu of the same page shows the name and the picture
	window.dispatchEvent(new CustomEvent(USER_UPDATED_EVENT));
}

export function clearAuthSession(): void {
	try {
		localStorage.removeItem(TOKEN_STORAGE_KEY);
		localStorage.removeItem(USER_STORAGE_KEY);
	} catch {
		// storage unavailable
	}
}
