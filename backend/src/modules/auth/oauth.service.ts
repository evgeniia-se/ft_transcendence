/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   oauth.service.ts                                   :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: lulmaruy <lulmaruy@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/09/15 21:02:09 by lulmaruy          #+#    #+#             */
/*   Updated: 2026/09/28 21:13:30 by lulmaruy         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

// Owner: Track 1 (Foundation, Auth, and API infrastructure)
// Responsible for: OAuth2 login flow (GitHub only), covering the OAuth minor module and feeding the credential source Track 3 needs for Octokit API calls.
import { randomBytes, timingSafeEqual } from "crypto";
import jwt from "jsonwebtoken";
import { Prisma, type User } from "@prisma/client";
import { prisma } from "../../db/prisma/client.js";
import type { OAuthProviderConfig } from "../../config/env.js";
import { hashPassword } from "./password.service.js";
import { encryptToken, decryptToken } from "./tokenCrypto.js";
import { isSignupOpen } from "./signupGate.js";

const PROVIDER = "github";

// Set once via initOAuthService, called from app.ts's buildApp right after initJwtService —
// same pattern, so this module doesn't reach into env.ts directly and app.ts stays the one
// place loadConfig()'s result gets handed out.
// stateSecret signs the short-lived state CSRF token (see generateState/verifyState below).
// app.ts passes config.jwtSecret for this — reusing the session-JWT secret rather than adding
// a new required env var, since there's no server-side session store to keep a separate secret
// in sync with anyway. Named `stateSecret` here (not `jwtSecret`) so swapping in a dedicated
// secret later, if ever wanted, is a one-line change at the call site, not a rename here.
export interface OAuthServiceConfig {
	github: OAuthProviderConfig;
	stateSecret: string;
}

let serviceConfig: OAuthServiceConfig | undefined;

export function initOAuthService(config: OAuthServiceConfig): void {
	serviceConfig = config;
}

function getConfig(): OAuthServiceConfig {
	if (!serviceConfig) {
		throw new Error("OAuth service not configured");
	}
	return serviceConfig;
}

export class OAuthNotConfiguredError extends Error {
	constructor() {
		super("OAuth provider github is not configured. set GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET / GITHUB_OAUTH_REDIRECT_URI (see .env.example)");
		this.name = "OAuthNotConfiguredError";
	}
}

export class OAuthExchangeError extends Error {
	constructor(reason: string) {
		super(`OAuth exchange failed: ${reason}`);
		this.name = "OAuthExchangeError";
	}
}

// OAuthStateError covers a missing, expired, malformed, or provider-mismatched state param
export class OAuthStateError extends Error {
	constructor(reason: string) {
		super(`OAuth state check failed: ${reason}`);
		this.name = "OAuthStateError";
	}
}

// OAuthAccessDeniedError: the user clicked "Cancel" on GitHub's consent screen
export class OAuthAccessDeniedError extends Error {
	constructor() {
		super("the user refused the GitHub authorization");
		this.name = "OAuthAccessDeniedError";
	}
}

// OAuthSignupDisabledError: a first GitHub login would create an account while signup is closed by the admin
export class OAuthSignupDisabledError extends Error {
	constructor() {
		super("account creation is closed");
		this.name = "OAuthSignupDisabledError";
	}
}

export class OAuthAccountConflictError extends Error {
	constructor(reason: string) {
		super(reason);
		this.name = "OAuthAccountConflictError";
	}
}

function getGithubConfig(): OAuthProviderConfig {
	const config = getConfig().github;
	if (!config.clientId || !config.clientSecret || !config.redirectUri) {
		throw new OAuthNotConfiguredError();
	}
	return config;
}

// --- CSRF state token ----------------------------------------------------------------------
// There's no server-side session store (auth is stateless JWT — permissions.middleware.ts), so
// the state param can't be stashed server-side and compared on return the usual way. Instead
// it's a short-lived, self-contained signed token: we sign {nonce} here, hand it to
// the provider as state, and the provider hands it straight back unmodified on the callback.
// A signature alone does not tie the state to the browser that started the flow: anyone can request a valid
// state, then trick a victim into opening the callback URL with the attacker's own `code` (login CSRF: the
// victim ends up signed in as the attacker). So the same nonce is also set in an HttpOnly cookie on the browser
// that starts the flow, and the callback only accepts a state whose nonce matches that cookie.
// For a link flow (an already signed-in user adding GitHub), the state also carries that user's id, so the
// callback knows which account to attach the GitHub identity to.
const STATE_TTL_SECONDS = 600; // 10 minutes
const STATE_TYP = "oauth_state";
export const OAUTH_STATE_COOKIE = "ft_oauth_state";
export const OAUTH_STATE_TTL_SECONDS = STATE_TTL_SECONDS;

interface OAuthStateClaims {
	typ: typeof STATE_TYP;
	nonce: string; // nonce = number used once, also stored in the browser cookie
	linkUserId?: string;
}

// whether the state cookie must carry the Secure flag: true when the app is served over https
export function isOAuthCookieSecure(): boolean {
	return process.env.NODE_ENV === "production" || getConfig().github.redirectUri.startsWith("https://");
}

function generateState(linkUserId?: string): { state: string; nonce: string } {
	const nonce = randomBytes(16).toString("hex");
	const claims: OAuthStateClaims = { typ: STATE_TYP, nonce, ...(linkUserId ? { linkUserId } : {}) };
	return { state: jwt.sign(claims, getConfig().stateSecret, { expiresIn: STATE_TTL_SECONDS }), nonce };
}

function verifyState(state: string | undefined, browserNonce: string | undefined): OAuthStateClaims {
	if (!state) {
		throw new OAuthStateError("missing state parameter");
	}
	let decoded: unknown;
	try {
		decoded = jwt.verify(state, getConfig().stateSecret);
	} catch (err) {
		if (err instanceof jwt.TokenExpiredError) {
			throw new OAuthStateError("state has expired. the login attempt took too long, please try again");
		}
		throw new OAuthStateError("state is invalid or the token was modified");
	}
	if (
		typeof decoded !== "object" || decoded === null || (decoded as Partial<OAuthStateClaims>).typ !== STATE_TYP ||
		typeof (decoded as Partial<OAuthStateClaims>).nonce !== "string"
	) {
		throw new OAuthStateError("state token has an unexpected shape");
	}
	const claims = decoded as OAuthStateClaims;
	if (!browserNonce) {
		throw new OAuthStateError("this browser did not start the login (state cookie missing)");
	}
	const expected = Buffer.from(claims.nonce);
	const actual = Buffer.from(browserNonce);
	if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
		throw new OAuthStateError("this browser did not start the login (state cookie mismatch)");
	}
	return claims;
}

// --- GitHub endpoints ------------------------------------------------------------------
const AUTHORIZE_URL = "https://github.com/login/oauth/authorize";

const TOKEN_URL = "https://github.com/login/oauth/access_token";

const USER_URL = "https://api.github.com/user";

// repo / api are what Track 3's git module needslater (via Octokit) to link
// branches and register webhooks on the user's behalf
const SCOPE = "read:user user:email repo";

// startOAuthFlow builds the provider consent-screen URL the user is sent to, plus the nonce the caller must put
// in the OAUTH_STATE_COOKIE cookie of that same browser. With `linkUserId`, the callback attaches the GitHub
// account to that user instead of logging in.
export function startOAuthFlow(linkUserId?: string): { url: string; nonce: string } {
	const config = getGithubConfig();
	const { state, nonce } = generateState(linkUserId);

	const params = new URLSearchParams({
		client_id: config.clientId,
		redirect_uri: config.redirectUri,
		scope: SCOPE,
		state,
	});

	return { url: `${AUTHORIZE_URL}?${params.toString()}`, nonce };
}

// token exchange + profile fetch

interface ExchangedToken {
	accessToken: string;
}

async function exchangeCodeForToken(code: string): Promise<ExchangedToken> {
	const config = getGithubConfig();

	const body = {
		client_id: config.clientId,
		client_secret: config.clientSecret,
		code,
		redirect_uri: config.redirectUri,
	};

	const response = await fetch(TOKEN_URL, {
		method: "POST",
		headers: { "Content-Type": "application/json", Accept: "application/json" },
		body: JSON.stringify(body),
	});

	if (!response.ok) {
		throw new OAuthExchangeError(`github token endpoint returned ${response.status}`);
	}

	const data = (await response.json()) as { access_token?: string; error?: string; error_description?: string };
	if (!data.access_token) {
		throw new OAuthExchangeError(data.error_description ?? data.error ?? "no access_token in provider response");
	}

	return { accessToken: data.access_token };
}

interface OAuthProfile {
	oauthId: string;
	email: string | null; // only fetched when needed (login), always a verified address
	name: string;
	avatar: string | null;
}

const EMAILS_URL = "https://api.github.com/user/emails";

// The email of the public profile is often null (GitHub lets users hide it), so the verified primary address is
// read from /user/emails instead (scope user:email). Only a verified address may be used: an unverified one could
// belong to someone else and would let this login attach itself to their account.
async function fetchVerifiedEmail(authHeaders: Record<string, string>): Promise<string> {
	const res = await fetch(EMAILS_URL, { headers: authHeaders });
	if (!res.ok) {
		throw new OAuthExchangeError(`GitHub emails fetch returned ${res.status}`);
	}
	const emails = (await res.json()) as { email: string; primary: boolean; verified: boolean }[];
	const verified = emails.filter((entry) => entry.verified);
	const chosen = verified.find((entry) => entry.primary) ?? verified[0];
	if (!chosen) {
		throw new OAuthExchangeError("this GitHub account has no verified email address");
	}
	return chosen.email.toLowerCase();
}

async function fetchGitHubProfile(accessToken: string, options: { needEmail: boolean }): Promise<OAuthProfile> {
	const authHeaders = { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json" };

	const userRes = await fetch(USER_URL, { headers: authHeaders });
	if (!userRes.ok) {
		throw new OAuthExchangeError(`GitHub profile fetch returned ${userRes.status}`);
	}
	const user = (await userRes.json()) as {
		id: number;
		login: string;
		name: string | null;
		avatar_url: string | null;
	};

	return {
		oauthId: String(user.id),
		email: options.needEmail ? await fetchVerifiedEmail(authHeaders) : null,
		name: user.name ?? user.login,
		avatar: user.avatar_url,
	};
}

async function randomUnusablePassword(): Promise<{ hash: string; salt: string }> {
	return hashPassword(randomBytes(32).toString("hex"));
}

// upsertOAuthAccount stores (or refreshes) the encrypted GitHub token for a user's linked
// identity. Uses upsert rather than a plain create so a concurrent re-login for the same GitHub
// identity can never race against the (provider, providerId) unique constraint
async function upsertOAuthAccount(userId: string, providerId: string, accessToken: string): Promise<void> {
	const encrypted = encryptToken(accessToken);
	await prisma.oAuthAccount.upsert({
		where: { provider_providerId: { provider: PROVIDER, providerId }},
		update: { accessToken: encrypted, scopes: SCOPE},
		create: { userId, provider: PROVIDER, providerId, accessToken: encrypted, scopes: SCOPE},
	});
}

// handleOAuthCallback exchanges the provider's auth code for a token, creates/links the User, and returns the User.
// `browserNonce` is the value of the OAUTH_STATE_COOKIE cookie sent by the browser on the callback request.
// `linked` is true when the state came from a link flow: the GitHub account was attached to an already
// signed-in user, who is the returned user.
export async function handleOAuthCallback(
	code: string,
	state: string,
	browserNonce: string | undefined,
): Promise<{ user: User; linked: boolean }> {
	const claims = verifyState(state, browserNonce);

	if (claims.linkUserId) {
		return { user: await linkOAuthAccount(claims.linkUserId, code), linked: true };
	}
	return { user: await loginWithGitHub(code), linked: false };
}

async function loginWithGitHub(code: string): Promise<User> {
	const { accessToken } = await exchangeCodeForToken(code);
	const profile = await fetchGitHubProfile(accessToken, { needEmail: true });
	if (!profile.email) {
		throw new OAuthExchangeError("no email in the GitHub profile");
	}
	const email = profile.email;

	// 1. Already linked to this provider identity
	const existingAccount = await prisma.oAuthAccount.findUnique({
		where: { provider_providerId: { provider: PROVIDER, providerId: profile.oauthId }},
		include: { user: true },
	});
	if (existingAccount) {
		const user = existingAccount.user.avatar || !profile.avatar
		? existingAccount.user
		: await prisma.user.update({
			where: { id: existingAccount.userId },
			data: { avatar: profile.avatar },
		});
		await upsertOAuthAccount(user.id, profile.oauthId, accessToken);
		return user;
	}

	// 2. Not linked yet, but an account with this email already exists —> link onto it rather
	// than creating a duplicate User
	const existingByEmail = await prisma.user.findUnique({
		where: { email }
	});
	if (existingByEmail) {
		const user = existingByEmail.avatar || !profile.avatar
		? existingByEmail
		: await prisma.user.update({
			where: { id: existingByEmail.id },
			data: { avatar: profile.avatar },
		});
		await upsertOAuthAccount(user.id, profile.oauthId, accessToken);
		return user;
	}

	// 3. Brand new user, only while signup is open
	if (!(await isSignupOpen())) {
		throw new OAuthSignupDisabledError();
	}
	const { hash, salt } = await randomUnusablePassword();
	let user: User;
	try {
		user = await prisma.user.create({
			data: {
				email,
				name: profile.name,
				avatar: profile.avatar,
				passwordHash: hash,
				passwordSalt: salt,
			},
		});
	} catch (err) {
		if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
			throw new OAuthAccountConflictError(`account ${email} was just created by a concurrent request`);
		}
		throw err;
	}
	await upsertOAuthAccount(user.id, profile.oauthId, accessToken);
	return user;
}

// linkOAuthAccount attaches a GitHub identity to an already-authenticated user (adding OAuth on top of email/password),
// instead of going through handleOAuthCallback's find-or-create-by-email path
// Guards against linking a GitHub identity that's already claimed by a different user
// it's "one user per GitHub identity"
export async function linkOAuthAccount(userId: string, code: string): Promise<User> {
	const user = await prisma.user.findUnique({ where: { id: userId } });
	if (!user) {
		throw new OAuthAccountConflictError(`no user with id ${userId}`);
	}

	const { accessToken } = await exchangeCodeForToken(code);
	const profile = await fetchGitHubProfile(accessToken, { needEmail: false });
	const existing = await prisma.oAuthAccount.findUnique({
		where: { provider_providerId: { provider: PROVIDER, providerId: profile.oauthId }},
	});
	if (existing && existing.userId !== userId) {
		throw new OAuthAccountConflictError("this GitHub account is already linked to a different user");
	}

	await upsertOAuthAccount(userId, profile.oauthId, accessToken);
	if (profile.avatar && !user.avatar) {
		return prisma.user.update({
			where: { id: userId },
			data: { avatar: profile.avatar }
		});
	}
	return user;
}

// getDecryptedAccessToken is the integration point Track 3's branchLink.service.ts should call
// (e.g. `getDecryptedAccessToken(userId)`) to get a usable GitHub token. There is no
// User.oauthAccessToken field to read directly by design. Returns null if the user has never linked a GitHub account,
// which Track 3 should surface as "connect your GitHub account" rather than a generic error
export async function getDecryptedAccessToken(userId: string): Promise<string | null> {
	const account = await prisma.oAuthAccount.findFirst({
		where: { userId, provider: PROVIDER },
	});
	if (!account) {
		return null;
	}
	return decryptToken(account.accessToken);
}

