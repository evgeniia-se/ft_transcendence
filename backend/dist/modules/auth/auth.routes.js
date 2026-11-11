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
import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma/client.js";
import { validateSignupInput } from "./auth.validation.js";
import { hashPassword, verifyPassword } from "./password.service.js";
import { generateJwt } from "./jwt.service.js";
import { handleOAuthCallback, OAuthNotConfiguredError, OAuthExchangeError, OAuthStateError, OAuthAccountConflictError, getOAuthRedirectUrl } from "./oauth.service.js";
// registerAuthRoutes mounts /api/auth/signup, /api/auth/login, /api/auth/logout on the given
// Fastify instance, called from app.ts. Canonical API base path is /api — matches
// frontend/src/auth/{loginForm,signupForm}.ts, which already call these under /api/auth/*
export async function registerAuthRoutes(app) {
    app.post("/signup", signupHandler);
    app.post("/login", loginHandler);
    app.post("/logout", logoutHandler);
    app.get("/oauth/github/callback", oauthCallbackHandler);
    app.get("/oauth/github/redirect", async (_req, reply) => {
        return reply.redirect(getOAuthRedirectUrl());
    });
}
function toAuthResponse(user, token) {
    return { token, user: { id: user.id, email: user.email, name: user.name } };
}
// signupHandler creates a new user with a hashed/salted password
async function signupHandler(request, reply) {
    const input = request.body;
    const email = input?.email?.trim().toLowerCase() ?? "";
    const password = input?.password ?? "";
    const name = input?.name?.trim() ?? "";
    const errors = validateSignupInput({ email, password, name });
    if (errors.length > 0) {
        reply.code(400).send({ error: "invalid_input", details: errors });
        return;
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
        reply.code(409).send({ error: "email_already_registered" });
        return;
    }
    const { hash, salt } = await hashPassword(password);
    try {
        const user = await prisma.user.create({
            data: { email, name, passwordHash: hash, passwordSalt: salt },
        });
        reply.code(201).send(toAuthResponse(user, generateJwt(user.id)));
    }
    catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
            reply.code(409).send({ error: "email_already_registered" });
            return;
        }
        throw err;
    }
}
// loginHandler authenticates an email/password pair and returns a session token
async function loginHandler(request, reply) {
    const input = request.body;
    const email = input?.email?.trim().toLowerCase() ?? "";
    const password = input?.password ?? "";
    if (!email || !password) {
        reply.code(400).send({ error: "invalid_input", details: ["email and password are required"] });
        return;
    }
    const invalidCredentials = () => reply.code(401).send({ error: "invalid_credentials" });
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        invalidCredentials();
        return;
    }
    const valid = await verifyPassword(password, user.passwordHash, user.passwordSalt);
    if (!valid) {
        invalidCredentials();
        return;
    }
    reply.code(200).send(toAuthResponse(user, generateJwt(user.id)));
}
// logoutHandler invalidates the caller's current session
async function logoutHandler(request, reply) {
    //  If a blocklist is added later for early revocation, insert the token's jti here
    reply.code(204).send();
}
async function oauthCallbackHandler(request, reply) {
    const { code, state } = request.query;
    try {
        const user = await handleOAuthCallback(code ?? "", state ?? "");
        const token = generateJwt(user.id);
        reply.redirect(`/auth/callback#token=${encodeURIComponent(token)}`);
    }
    catch (err) {
        if (err instanceof OAuthNotConfiguredError || err instanceof OAuthExchangeError ||
            err instanceof OAuthStateError || err instanceof OAuthAccountConflictError) {
            request.log.warn({ err }, "OAuth callback failed");
            reply.redirect(`/auth/callback#error=${encodeURIComponent(err.name)}`);
            return;
        }
        throw err;
    }
}
//# sourceMappingURL=auth.routes.js.map