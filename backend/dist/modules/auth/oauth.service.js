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
import { randomBytes } from "crypto";
import jwt from "jsonwebtoken";
import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma/client.js";
import { hashPassword } from "./password.service.js";
import { encryptToken, decryptToken } from "./tokenCrypto.js";
const PROVIDER = "github";
let serviceConfig;
export function initOAuthService(config) {
    serviceConfig = config;
}
function getConfig() {
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
    constructor(reason) {
        super(`OAuth exchange failed: ${reason}`);
        this.name = "OAuthExchangeError";
    }
}
// OAuthStateError covers a missing, expired, malformed, or provider-mismatched state param
export class OAuthStateError extends Error {
    constructor(reason) {
        super(`OAuth state check failed: ${reason}`);
        this.name = "OAuthStateError";
    }
}
export class OAuthAccountConflictError extends Error {
    constructor(reason) {
        super(reason);
        this.name = "OAuthAccountConflictError";
    }
}
function getGithubConfig() {
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
// Verifying the signature + expiry match gives the same CSRF guarantee (an attacker
// can't forge a valid state without stateSecret) without needing anywhere to store it.
const STATE_TTL_SECONDS = 600; // 10 minutes
const STATE_TYP = "oauth_state";
function generateState() {
    const claims = { typ: STATE_TYP, nonce: randomBytes(16).toString("hex") };
    return jwt.sign(claims, getConfig().stateSecret, { expiresIn: STATE_TTL_SECONDS });
}
function verifyState(state) {
    if (!state) {
        throw new OAuthStateError("missing state parameter");
    }
    let decoded;
    try {
        decoded = jwt.verify(state, getConfig().stateSecret);
    }
    catch (err) {
        if (err instanceof jwt.TokenExpiredError) {
            throw new OAuthStateError("state has expired. the login attempt took too long, please try again");
        }
        throw new OAuthStateError("state is invalid or the token was modified");
    }
    if (typeof decoded !== "object" || decoded === null || decoded.typ !== STATE_TYP) {
        throw new OAuthStateError("state token has an unexpected shape");
    }
}
// --- GitHub endpoints ------------------------------------------------------------------
const AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const TOKEN_URL = "https://github.com/login/oauth/access_token";
const USER_URL = "https://api.github.com/user";
// repo / api are what Track 3's git module needslater (via Octokit) to link
// branches and register webhooks on the user's behalf
const SCOPE = "read:user user:email repo";
// getOAuthRedirectUrl builds the provider consent-screen URL the frontend redirects the user to
export function getOAuthRedirectUrl() {
    const config = getGithubConfig();
    const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        scope: SCOPE,
        state: generateState(),
    });
    return `${AUTHORIZE_URL}?${params.toString()}`;
}
async function exchangeCodeForToken(code) {
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
    const data = (await response.json());
    if (!data.access_token) {
        throw new OAuthExchangeError(data.error_description ?? data.error ?? "no access_token in provider response");
    }
    return { accessToken: data.access_token };
}
async function fetchGitHubProfile(accessToken) {
    const authHeaders = { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json" };
    const userRes = await fetch(USER_URL, { headers: authHeaders });
    if (!userRes.ok) {
        throw new OAuthExchangeError(`GitHub profile fetch returned ${userRes.status}`);
    }
    const user = (await userRes.json());
    if (!user.email) {
        throw new OAuthExchangeError("GitHub did not return an email for this account");
    }
    return {
        oauthId: String(user.id),
        email: user.email.toLowerCase(),
        name: user.name ?? user.login,
        avatar: user.avatar_url,
    };
}
async function randomUnusablePassword() {
    return hashPassword(randomBytes(32).toString("hex"));
}
// upsertOAuthAccount stores (or refreshes) the encrypted GitHub token for a user's linked
// identity. Uses upsert rather than a plain create so a concurrent re-login for the same GitHub
// identity can never race against the (provider, providerId) unique constraint
async function upsertOAuthAccount(userId, providerId, accessToken) {
    const encrypted = encryptToken(accessToken);
    await prisma.oAuthAccount.upsert({
        where: { provider_providerId: { provider: PROVIDER, providerId } },
        update: { accessToken: encrypted, scopes: SCOPE },
        create: { userId, provider: PROVIDER, providerId, accessToken: encrypted, scopes: SCOPE },
    });
}
// handleOAuthCallback exchanges the provider's auth code for a token, creates/links the User, and returns the User
export async function handleOAuthCallback(code, state) {
    verifyState(state);
    const { accessToken } = await exchangeCodeForToken(code);
    const profile = await fetchGitHubProfile(accessToken);
    // 1. Already linked to this provider identity
    const existingAccount = await prisma.oAuthAccount.findUnique({
        where: { provider_providerId: { provider: PROVIDER, providerId: profile.oauthId } },
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
        where: { email: profile.email }
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
    // 3. Brand new user
    const { hash, salt } = await randomUnusablePassword();
    let user;
    try {
        user = await prisma.user.create({
            data: {
                email: profile.email,
                name: profile.name,
                avatar: profile.avatar,
                passwordHash: hash,
                passwordSalt: salt,
            },
        });
    }
    catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
            throw new OAuthAccountConflictError(`account ${profile.email} was just created by a concurrent request`);
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
export async function linkOAuthAccount(userId, code) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        throw new OAuthAccountConflictError(`no user with id ${userId}`);
    }
    const { accessToken } = await exchangeCodeForToken(code);
    const profile = await fetchGitHubProfile(accessToken);
    const existing = await prisma.oAuthAccount.findUnique({
        where: { provider_providerId: { provider: PROVIDER, providerId: profile.oauthId } },
    });
    if (existing && existing.userId !== userId) {
        throw new OAuthAccountConflictError("this GitHub account is already linked to a different user");
    }
    await upsertOAuthAccount(userId, profile.oauthId, accessToken);
    if (profile.avatar && !user.avatar) {
        await prisma.user.update({
            where: { id: userId },
            data: { avatar: profile.avatar }
        });
    }
}
// getDecryptedAccessToken is the integration point Track 3's branchLink.service.ts should call
// (e.g. `getDecryptedAccessToken(userId)`) to get a usable GitHub token. There is no
// User.oauthAccessToken field to read directly by design. Returns null if the user has never linked a GitHub account,
// which Track 3 should surface as "connect your GitHub account" rather than a generic error
export async function getDecryptedAccessToken(userId) {
    const account = await prisma.oAuthAccount.findFirst({
        where: { userId, provider: PROVIDER },
    });
    if (!account) {
        return null;
    }
    return decryptToken(account.accessToken);
}
//# sourceMappingURL=oauth.service.js.map