import { getStoredToken, getStoredUser, storeUser, type AuthUser } from "../auth/authClient";
import { getCurrentUser } from "../api/apiClient";

// same-origin paths only, so ?next= is not an open redirect
export function safeNext(raw: string | null | undefined, fallback = "/app"): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\") || /[\u0000-\u0020\u007f\\]/.test(raw)) return fallback;
  return raw;
}

export function currentPath(): string {
  return window.location.pathname + window.location.search;
}

export function loginUrl(next: string = currentPath()): string {
  return `/login?next=${encodeURIComponent(next)}`;
}

export function signupUrl(next: string = currentPath()): string {
  return `/signup?next=${encodeURIComponent(next)}`;
}

export function nextFromUrl(): string {
  return safeNext(new URLSearchParams(window.location.search).get("next"));
}

// redirects to login when there is no session; returns whether the page can render
export function requireSession(): boolean {
  if (getStoredToken()) return true;
  window.location.replace(loginUrl());
  return false;
}

let userPromise: Promise<AuthUser | null> | null = null;

// returns the user, fetching the profile when only a token is stored
export function ensureUser(): Promise<AuthUser | null> {
  const stored = getStoredUser();
  if (stored) return Promise.resolve(stored);
  userPromise ??= getCurrentUser()
    .then((user) => {
      storeUser(user);
      return user;
    })
    .catch(() => null);
  return userPromise;
}
