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
function requireEnv(name) {
    const value = process.env[name];
    if (value === undefined || value.trim() === "") {
        throw new Error(`Missing required environment variable: ${name} (see .env.example)`);
    }
    return value;
}
function optionalEnv(name, defaultValue) {
    const value = process.env[name];
    return value === undefined || value.trim() === "" ? defaultValue : value;
}
function optionalIntEnv(name, defaultValue) {
    const raw = process.env[name];
    if (raw === undefined || raw.trim() === "") {
        return defaultValue;
    }
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed)) {
        throw new Error(`Environment variable ${name} must be an integer, got "${raw}"`);
    }
    return parsed;
}
function loadGithubOAuthConfig() {
    return {
        clientId: process.env.GITHUB_CLIENT_ID || '',
        clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
        redirectUri: process.env.GITHUB_OAUTH_REDIRECT_URI || '',
    };
}
// loadConfig reads process.env (populated from .env via dotenv), validates required vars, and returns a typed config object.
export function loadConfig() {
    const nodeEnv = optionalEnv("NODE_ENV", "development");
    if (nodeEnv !== "development" && nodeEnv !== "production" && nodeEnv !== "test") {
        throw new Error(`Environment variable NODE_ENV must be one of "development", "test", "production", got "${nodeEnv}"`);
    }
    return {
        nodeEnv,
        host: optionalEnv("HOST", "0.0.0.0"),
        port: optionalIntEnv("PORT", 3000),
        databaseUrl: requireEnv("DATABASE_URL"),
        jwtSecret: requireEnv("JWT_SECRET"),
        oauthGithub: loadGithubOAuthConfig(),
        oauthTokenEncryptionKey: requireEnv("OAUTH_TOKEN_ENCRYPTION_KEY"),
        gitWebhookSecret: requireEnv("GIT_WEBHOOK_SECRET"),
        publicApiRateLimitDefault: optionalIntEnv("PUBLIC_API_RATE_LIMIT_DEFAULT", 100),
        rateLimit: {
            globalMax: optionalIntEnv("RATE_LIMIT_GLOBAL_MAX", 300),
            globalWindowMs: optionalIntEnv("RATE_LIMIT_GLOBAL_WINDOW_MS", 60000),
        },
    };
}
//# sourceMappingURL=env.js.map