// Owner: Track 1 (Foundation, Auth, and API infrastructure)
// Responsible for: the GitHub OAuth login flow.

import { storeToken } from "./authClient";
import { safeNext } from "../shared/session";
import { apiRequest } from "../api/apiClient";
import { t } from "../shared/i18n.svelte";

const GITHUB_OAUTH_START_PATH = "/api/auth/oauth/github/redirect";
const NEXT_KEY = "ft_oauth_next";

// `next` is saved because the OAuth redirect drops the query string
export function startOAuthLogin(next?: string): void {
  try {
    if (next) sessionStorage.setItem(NEXT_KEY, next);
    else sessionStorage.removeItem(NEXT_KEY);
  } catch {
    // storage unavailable: land on the dashboard
  }
  window.location.href = GITHUB_OAUTH_START_PATH;
}

// adds GitHub to the account of the signed-in user (login without the GitHub email matching, Git integration).
// The backend answers with the GitHub consent-screen url and sets the state cookie on this browser.
export async function startOAuthLink(next?: string): Promise<void> {
  const { url } = await apiRequest<{ url: string }>({ method: "POST", path: "/auth/oauth/github/link" });
  try {
    if (next) sessionStorage.setItem(NEXT_KEY, next);
    else sessionStorage.removeItem(NEXT_KEY);
  } catch {
    // storage unavailable: land on the dashboard
  }
  window.location.href = url;
}

export type OAuthResult = { ok: true; next: string } | { ok: false; message: string };

// reads and clears the URL fragment, stores the token on success
export function readOAuthResult(): OAuthResult {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const token = params.get("token");
  const error = params.get("error");
  const linked = params.get("linked") === "1";
  history.replaceState(null, "", window.location.pathname);

  if (error) return { ok: false, message: oauthErrorMessage(error) };
  // a link keeps the current session: there is no new token to store
  if (!token && !linked) return { ok: false, message: t("oauth.noInfo") };

  if (token) storeToken(token);
  let next = "/app";
  try {
    next = safeNext(sessionStorage.getItem(NEXT_KEY));
    sessionStorage.removeItem(NEXT_KEY);
  } catch {
  }
  return { ok: true, next };
}

// maps the error names sent by oauthCallbackHandler to messages
function oauthErrorMessage(error: string): string {
  switch (error) {
    case "OAuthNotConfiguredError":
      return t("oauth.notConfigured");
    case "OAuthStateError":
      return t("oauth.state");
    case "OAuthExchangeError":
      return t("oauth.exchange");
    case "OAuthAccessDeniedError":
      return t("oauth.accessDenied");
    case "OAuthAccountConflictError":
      return t("oauth.conflict");
    case "OAuthSignupDisabledError":
      return t("oauth.signupDisabled");
    default:
      return t("oauth.unknown");
  }
}
