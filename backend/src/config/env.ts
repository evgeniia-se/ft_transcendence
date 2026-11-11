/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   env.ts                                             :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: lulmaruy <lulmaruy@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/09/02 19:02:56 by lulmaruy          #+#    #+#             */
/*   Updated: 2026/09/29 20:46:13 by lulmaruy         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

// Owner: Track 1 (Foundation, Auth, and API infrastructure)
// Responsible for: loading and validating environment configuration (DB DSN, JWT secret, OAuth client IDs, port), read from .env per the mandatory .env/.env.example requirement.

import dotenv from 'dotenv';

dotenv.config();

export interface AppConfig {
	nodeEnv: "development" | "production" | "test";
	host: string;
	port: number;
	databaseUrl: string;
	jwtSecret: string;
	oauthGithub: OAuthProviderConfig;
	oauthTokenEncryptionKey: string;
	// password of the admin page that opens/closes signup (SIGNUP_ADMIN_PASSWORD); empty = page disabled
	signupAdminPassword: string;
	gitWebhookSecret: string;
	publicApiRateLimitDefault: number;
  // rateLimit configures the @fastify/rate-limit plugin registered globally in app.ts.
  // globalMax/globalWindowMs are the site-wide default applied to every route; the invite join
  // route (POST /api/projects/invites/:token/join) overrides these with its own dedicated,
  // stricter policy — see modules/projects/invites.ts's INVITE_JOIN_RATE_LIMIT — rather than
  // reading inviteJoinMax/inviteJoinWindowMs from here, so that policy stays a fixed, reviewable
  // constant next to the route it protects instead of an env-tunable value.
	rateLimit: {
		globalMax: number;
		globalWindowMs: number;
	};
}

// OAuthProviderConfig holds what oauth.service.ts needs per provider: the app credentials
// (getOAuthRedirectUrl/handleOAuthCallback) plus the callback URL registered with the
// provider (getOAuthRedirectUrl builds the authorize URL's redirect_uri param from this,
// rather than hardcoding or re-deriving it from the incoming request).
export interface OAuthProviderConfig {
	clientId: string;
	clientSecret: string;
	redirectUri: string;
}

function requireEnv(name: string): string {
	const value = process.env[name];
	if (value === undefined || value.trim() === "")
	{
		throw new Error(`Missing required environment variable: ${name} (see .env.example)`);
	}
	return value;
}

function optionalEnv(name: string, defaultValue: string): string {
	const value = process.env[name];
	return value === undefined || value.trim() === "" ? defaultValue : value;
}

function optionalIntEnv(name: string, defaultValue: number): number {
	const raw = process.env[name];
	if (raw === undefined || raw.trim() === "")
	{
		return defaultValue;
	}
	const parsed = Number.parseInt(raw, 10);
	if (Number.isNaN(parsed))
	{
		throw new Error(`Environment variable ${name} must be an integer, got "${raw}"`);
	}
	return parsed;
}

function loadGithubOAuthConfig(): OAuthProviderConfig {
	return {
		clientId: process.env.GITHUB_CLIENT_ID || '',
		clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
		redirectUri: process.env.GITHUB_OAUTH_REDIRECT_URI || '',
	};
}

// loadConfig reads process.env (populated from .env via dotenv), validates required vars, and returns a typed config object.
export function loadConfig(): AppConfig {
	const nodeEnv = optionalEnv("NODE_ENV", "development");
	if (nodeEnv !== "development" && nodeEnv !== "production" && nodeEnv !== "test") {
		throw new Error(`Environment variable NODE_ENV must be one of "development", "test", "production", got "${nodeEnv}"`);
	}

	const jwtSecret = requireEnv("JWT_SECRET");
	const webhookSecret = requireEnv("GIT_WEBHOOK_SECRET");
	// "change_me" is the placeholder of .env.example: with a secret everybody knows, anybody could forge a session
	// token or a webhook. `./transcendence start` generates real ones; a production start refuses the placeholders.
	for (const [name, value] of [["JWT_SECRET", jwtSecret], ["GIT_WEBHOOK_SECRET", webhookSecret]]) {
		if (value === "change_me" || value.length < 16) {
			const message = `${name} is the placeholder (or too short): set a long random value in .env (openssl rand -hex 32)`;
			if (nodeEnv === "production") throw new Error(message);
			if (nodeEnv === "development") console.warn(`[security] ${message}`);
		}
	}

	const signupAdminPassword = process.env.SIGNUP_ADMIN_PASSWORD?.trim() ?? "";
	if (signupAdminPassword !== "" && (signupAdminPassword === "change_me" || signupAdminPassword.length < 12)) {
		const message = "SIGNUP_ADMIN_PASSWORD is the placeholder (or shorter than 12 characters): the signup admin page is disabled";
		if (nodeEnv === "production") throw new Error(message);
		console.warn(`[security] ${message}`);
	}

	return {
		nodeEnv,
		host: optionalEnv("HOST", "0.0.0.0"),
		port: optionalIntEnv("PORT", 3000),
		databaseUrl: requireEnv("DATABASE_URL"),
		jwtSecret,
		oauthGithub: loadGithubOAuthConfig(),
		oauthTokenEncryptionKey: requireEnv("OAUTH_TOKEN_ENCRYPTION_KEY"),
		signupAdminPassword: signupAdminPassword,
		gitWebhookSecret: webhookSecret,
		publicApiRateLimitDefault: optionalIntEnv("PUBLIC_API_RATE_LIMIT_DEFAULT", 100),
		rateLimit: {
			globalMax: optionalIntEnv("RATE_LIMIT_GLOBAL_MAX", 300),
			globalWindowMs: optionalIntEnv("RATE_LIMIT_GLOBAL_WINDOW_MS", 60000),
		},
	};
}

