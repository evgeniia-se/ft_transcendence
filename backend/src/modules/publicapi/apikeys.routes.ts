// Owner: Track 1 (Foundation, Auth, and API infrastructure)
// Responsible for: the JWT-authenticated endpoints project admins use to issue, list and revoke API keys

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { requireAuth, requireRole } from "../permissions/permissions.middleware.js";
import { ROLES } from "../permissions/roles.service.js";
import { issueApiKey, revokeApiKey, listApiKeys, stripKeyHash, InvalidApiKeyInputError, ApiKeyNotFoundError } from "./apikeys.service.js";
import { validateIssueApiKeyBody } from "./publicapi.validation.js";

export async function registerApiKeyManagementRoutes(app: FastifyInstance): Promise<void> {
	const adminOnly = [requireAuth, requireRole(ROLES.ADMIN)];
	app.post("/projects/:projectId/api-keys", { preHandler: adminOnly }, issueApiKeyHandler);
	app.get("/projects/:projectId/api-keys", { preHandler: adminOnly }, listApiKeysHandler);
	app.delete("/projects/:projectId/api-keys/:keyId", { preHandler: adminOnly }, revokeApiKeyHandler);
}

// issueApiKeyHandler — POST /api/projects/{projectId}/api-keys
async function issueApiKeyHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	const { projectId } = request.params as { projectId: string };

	const body = validateIssueApiKeyBody(request.body);
	if (!body.ok) {
		reply.code(400).send({ error: "invalid_input", details: body.errors });
		return;
	}

	try {
		const { apiKey, plaintextKey } = await issueApiKey({
			userId: request.userId as string,
			projectId,
			rateLimit: body.value.rateLimit,
		});
		reply.code(201).send({ apiKey: stripKeyHash(apiKey), key: plaintextKey });
	} catch (err) {
		if (err instanceof InvalidApiKeyInputError) {
			reply.code(400).send({ error: "invalid_input", details: err.details });
			return;
		}
		throw err;
	}
}

// listApiKeysHandler — GET /api/projects/{projectId}/api-keys
async function listApiKeysHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	const { projectId } = request.params as { projectId: string };
	const apiKeys = await listApiKeys(projectId);
	reply.code(200).send({ apiKeys });
}

// revokeApiKeyHandler — DELETE /api/projects/{projectId}/api-keys/{keyId}
async function revokeApiKeyHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	const { projectId, keyId } = request.params as { projectId: string; keyId: string };

	try {
		await revokeApiKey(keyId, projectId);
		reply.code(204).send();
	} catch (err) {
		if (err instanceof ApiKeyNotFoundError) {
			reply.code(404).send({ error: "api_key_not_found" });
			return;
		}
		throw err;
	}
}
