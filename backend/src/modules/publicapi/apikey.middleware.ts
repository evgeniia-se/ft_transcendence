// Owner: Track 1 (Foundation, Auth, and API infrastructure)
// Responsible for: the Fastify preHandlers/constraint that authenticate public API requests by API key
// (the API-key counterpart of permissions.middleware.ts's JWT-based requireAuth)

import type { FastifyRequest, FastifyReply, FastifyServerOptions } from "fastify";
import type { ApiKey } from "@prisma/client";
import { validateApiKey } from "./apikeys.service.js";

// PUBLIC_API_KEY_HEADER is the header an external client presents its key in
export const PUBLIC_API_KEY_HEADER = "x-api-key";

declare module "fastify" {
	interface FastifyRequest {
		apiKey? : ApiKey; // apiKey is the validated key row, set by requireApiKey
	}
}

// requireApiKey rejects requests without a valid API key
export async function requireApiKey(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	const header = request.headers[PUBLIC_API_KEY_HEADER];
	const presented = Array.isArray(header) ? header[0] : header;

	if (!presented || presented.trim() === "") {
		reply.code(401).send({ error: "missing_api_key" });
		return;
	}

	const apiKey = await validateApiKey(presented.trim());
	if (!apiKey) {
		reply.code(401).send({ error: "invalid_api_key" });
		return;
	}

	request.apiKey = apiKey;
	request.userId = apiKey.userId as string;
}

// enforceKeyProjectScope rejects a project-scoped key used against another project
export async function enforceKeyProjectScope(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	const scope = request.apiKey?.projectId;
	if (!scope) {
		return;
	}
	const params = request.params as Record<string, string | undefined> | undefined;
	if (params?.projectId !== scope) {
		reply.code(403).send({ error: "api_key_project_mismatch" });
	}
}

// apiKeyRouteConstraint is a Fastify custom constraint strategy (passed via Fastify({ routerOptions: { constraints } }) in app.ts)
export const apiKeyRouteConstraint: NonNullable<NonNullable<FastifyServerOptions["routerOptions"]>["constraints"]>[string] = {
	name: "apiAuth",
	storage() {
		const handlers = new Map<string, unknown>();
		return {
			get: (value: string) => handlers.get(value) ?? null,
			set: (value: string, handler: unknown) => {
				handlers.set(value, handler);
			},
		};
	},
	deriveConstraint(req) {
		return req.headers[PUBLIC_API_KEY_HEADER] !== undefined ? "apikey" : undefined;
	},
	validate(value: unknown) {
		if (value !== "apikey") {
			throw new Error(`apiAuth constraint must be apikey, got ${String(value)}`);
		}
	},
	mustMatchWhenDerived: false,
} as NonNullable<NonNullable<FastifyServerOptions["routerOptions"]>["constraints"]>[string];

// API_KEY_ROUTE_CONSTRAINT is the constraints value public routes that share a path with a JWT route declare
export const API_KEY_ROUTE_CONSTRAINT = { apiAuth: "apikey" } as const;
