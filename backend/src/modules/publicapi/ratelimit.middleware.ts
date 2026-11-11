// Owner: Track 1 (Foundation, Auth, and API infrastructure)
// Responsible for: rate limiting for the Public API major module, per the api_keys.rate_limit column
import type { FastifyRequest, FastifyReply } from "fastify";

export const RATE_LIMIT_WINDOW_MS = 60_000;

export interface RateLimitResult {
	allowed: boolean;
	limit: number;
	remaining: number;
	resetAt: number;
}

interface Window {
	count: number;
	resetAt: number;
}

const windows = new Map<string, Window>();

// Drop expired windows so the map doesn't grow with every key ever seen
setInterval(() => {
	const now = Date.now();
	for (const [id, w] of windows) {
		if (w.resetAt <= now) {
			windows.delete(id);
		}
	}
}, RATE_LIMIT_WINDOW_MS).unref();

// checkRateLimit checks and increments the request count for an API key within the current window
export async function checkRateLimit(apiKeyId: string, limit: number): Promise<RateLimitResult> {
	const now = Date.now();
	let w = windows.get(apiKeyId);
	if (!w || w.resetAt <= now) {
		w = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
		windows.set(apiKeyId, w);
	}

	if (w.count >= limit) {
		return { allowed: false, limit, remaining: 0, resetAt: w.resetAt };
	}
	w.count += 1;
	return { allowed: true, limit, remaining: limit - w.count, resetAt: w.resetAt };
}

// rateLimitMiddleware enforces the per-key rate limit before a public API handler runs. Register as a preHandler
// after requireApiKey (which sets request.apiKey) and before any DB-heavy checks
export async function rateLimitMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	const apiKey = request.apiKey;
	if (!apiKey) {
		reply.code(401).send({ error: "missing_api_key" });
		return;
	}

	const result = await checkRateLimit(apiKey.id, apiKey.rateLimit);
	const resetSeconds = Math.max(0, Math.ceil((result.resetAt - Date.now()) / 1000));

	reply.header("X-RateLimit-Limit", result.limit);
	reply.header("X-RateLimit-Remaining", result.remaining);
	reply.header("X-RateLimit-Reset", Math.ceil(result.resetAt / 1000));

	if (!result.allowed) {
		reply.header("Retry-After", resetSeconds);
		reply.code(429).send({
			error: "rate_limit_exceeded",
			limit: result.limit,
			retryAfter: resetSeconds,
		});
	}
}


