/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   auth.routes.ts                                     :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: lulmaruy <lulmaruy@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/09/08 20:41:49 by lulmaruy          #+#    #+#             */
/*   Updated: 2026/09/27 19:39:54 by lulmaruy         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

// Owner: Track 1 (Foundation, Auth, and API infrastructure)
// Responsible for: Fastify route handlers for signup/login/logout

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { Prisma, type User } from "@prisma/client";
import { prisma } from "../../db/prisma/client.js";
import { validateSignupInput, type SignupInput } from "./auth.validation.js";
import { hashPassword, verifyPassword } from "./password.service.js";
import { generateJwt } from "./jwt.service.js";
import {
	handleOAuthCallback, startOAuthFlow, isOAuthCookieSecure, OAUTH_STATE_COOKIE, OAUTH_STATE_TTL_SECONDS,
	OAuthNotConfiguredError, OAuthExchangeError, OAuthStateError, OAuthAccountConflictError, OAuthAccessDeniedError, OAuthSignupDisabledError,
} from "./oauth.service.js";
import { MAX_PASSWORD_LENGTH } from "./auth.validation.js";
import { isSignupOpen } from "./signupGate.js";
import { requireAuth } from "../permissions/permissions.middleware.js";

// registerAuthRoutes mounts /api/auth/signup, /api/auth/login, /api/auth/logout on the given
// Fastify instance, called from app.ts. Canonical API base path is /api — matches
// frontend/src/auth/{loginForm,signupForm}.ts, which already call these under /api/auth/*
// AUTH_RATE_LIMIT slows down password guessing and mass sign-ups: 10 tries a minute per client address, far below
// the global limit. A person mistyping a password never gets near it.
export const AUTH_RATE_LIMIT = { max: 10, timeWindow: "1 minute" } as const;

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
	app.post("/signup", { config: { rateLimit: AUTH_RATE_LIMIT } }, signupHandler);
	// public: lets the signup form (and the admin page) know whether account creation is open
	app.get("/signup-status", async () => ({ open: await isSignupOpen() }));
	app.post("/login", { config: { rateLimit: AUTH_RATE_LIMIT } }, loginHandler);
	app.post("/logout", logoutHandler);
	app.get("/oauth/github/callback", oauthCallbackHandler);
	app.get("/oauth/github/redirect", oauthRedirectHandler);
	// a signed-in user adds GitHub to their account (needed for the Git integration when the GitHub email is not
	// the account email): the browser cannot send its JWT on a plain redirect, so the frontend calls this with
	// fetch and then navigates to the returned url
	app.post("/oauth/github/link", { preHandler: [requireAuth] }, oauthLinkHandler);
}

// the nonce of the OAuth state is kept in a cookie of the browser that starts the flow (see oauth.service.ts):
// HttpOnly so scripts cannot read it, Lax so it still comes back on the top-level redirect from github.com
function stateCookie(value: string, maxAgeSeconds: number): string {
	return `${OAUTH_STATE_COOKIE}=${value}; Path=/api/auth/oauth; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${isOAuthCookieSecure() ? "; Secure" : ""}`;
}

function readStateCookie(request: FastifyRequest): string | undefined {
	const match = request.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${OAUTH_STATE_COOKIE}=`));
	return match?.slice(OAUTH_STATE_COOKIE.length + 1);
}

async function oauthRedirectHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	try {
		const { url, nonce } = startOAuthFlow();
		reply.header("Set-Cookie", stateCookie(nonce, OAUTH_STATE_TTL_SECONDS)).redirect(url);
	} catch (err) {
		if (err instanceof OAuthNotConfiguredError) {
			request.log.warn({ err }, "OAuth redirect requested but GitHub OAuth is not configured");
			reply.redirect(`/auth/callback#error=${encodeURIComponent(err.name)}`);
			return;
		}
		throw err;
	}
}

async function oauthLinkHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	try {
		const { url, nonce } = startOAuthFlow(request.userId);
		reply.header("Set-Cookie", stateCookie(nonce, OAUTH_STATE_TTL_SECONDS)).code(200).send({ url });
	} catch (err) {
		if (err instanceof OAuthNotConfiguredError) {
			reply.code(503).send({ error: "oauth_not_configured" });
			return;
		}
		throw err;
	}
}

interface LoginInput {
	email: string;
	password: string;
}

function toAuthResponse(user: User, token: string) {
	return { token, user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar } };
}

// signupHandler creates a new user with a hashed/salted password
async function signupHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	if (!(await isSignupOpen())) {
		reply.code(403).send({ error: "signup_disabled" });
		return ;
	}
	const input = request.body as Partial<SignupInput> | undefined;
	const email = typeof input?.email === "string" ? input.email.trim().toLowerCase() : "";
	const password = typeof input?.password === "string" ? input.password : "";
	const name = typeof input?.name === "string" ? input.name.trim() : "";

	const errors = validateSignupInput({ email, password, name });
	if (errors.length > 0) {
		reply.code(400).send({ error: "invalid_input", details: errors });
		return ;
	}

	const existing = await prisma.user.findUnique({ where: { email } });
	if (existing) {
		reply.code(409).send({ error: "email_already_registered" });
		return ;
	}

	const { hash, salt } = await hashPassword(password);

	try {
		const user = await prisma.user.create({
			data: { email, name, passwordHash: hash, passwordSalt: salt },
		});
		reply.code(201).send(toAuthResponse(user, generateJwt(user.id)));
		} catch (err) {
			if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
				reply.code(409).send({ error: "email_already_registered" });
				return ;
		}
		throw err;
	}
}

// loginHandler authenticates an email/password pair and returns a session token
async function loginHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	const input = request.body as Partial<LoginInput> | undefined;
	const email = typeof input?.email === "string" ? input.email.trim().toLowerCase() : "";
	const password = typeof input?.password === "string" ? input.password : "";

	if (!email || !password || email.length > 254 || password.length > MAX_PASSWORD_LENGTH) {
		reply.code(400).send({ error: "invalid_input", details: ["email and password are required"]});
		return ;
	}

	const invalidCredentials = () => reply.code(401).send({ error: "invalid_credentials"});

	const user = await prisma.user.findUnique({ where: { email }});
	if (!user) {
		invalidCredentials();
		return ;
	}

	const valid =  await verifyPassword(password, user.passwordHash, user.passwordSalt);
	if (!valid) {
		invalidCredentials();
		return ;
	}

	reply.code(200).send(toAuthResponse(user, generateJwt(user.id)));
}

// logoutHandler invalidates the caller's current session
async function logoutHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	//  If a blocklist is added later for early revocation, insert the token's jti here
	reply.code(204).send();
}

async function oauthCallbackHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	const { code, state, error } = request.query as { code?: string; state?: string; error?: string };
	// whatever the outcome, the state cookie has done its job
	reply.header("Set-Cookie", stateCookie("", 0));

	// "Cancel" on GitHub's consent screen comes back here with ?error=access_denied and no code
	if (error === "access_denied") {
		reply.redirect(`/auth/callback#error=${OAuthAccessDeniedError.name}`);
		return;
	}

	try {
		const { user, linked } = await handleOAuthCallback(code ?? "", state ?? "", readStateCookie(request));
		// a link flow keeps the existing session: the frontend only needs to know it worked
		if (linked) {
			reply.redirect("/auth/callback#linked=1");
			return;
		}
		const token = generateJwt(user.id);
		reply.redirect(`/auth/callback#token=${encodeURIComponent(token)}`);
	} catch (err) {
		if (
			err instanceof OAuthNotConfiguredError || err instanceof OAuthExchangeError ||
			err instanceof OAuthStateError || err instanceof OAuthAccountConflictError || err instanceof OAuthSignupDisabledError) {
			request.log.warn({ err }, "OAuth callback failed");
			reply.redirect(`/auth/callback#error=${encodeURIComponent(err.name)}`);
			return;
		}
		throw err;
	}
}
