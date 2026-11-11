// Owner: Track 1 (Foundation, Auth, and API infrastructure)
// Responsible for: the 5+ documented REST endpoints (GET/POST/PUT/DELETE) required by the Public API major module, wrapping Track 2/3/4's underlying entities. TS equivalent of backend/internal/publicapi/endpoints.go (Go skeleton, removed).

// Every route runs the same preHandler chain:
// requireApiKey          401 — valid X-API-Key, sets request.apiKey + request.userId
// rateLimitMiddleware    429 — per-key quota (api_keys.rate_limit), sets X-RateLimit-* headers
// enforceKeyProjectScope 403 — a project-scoped key can't reach another project
// requireRole            403 — the key's user must hold the role in project_members (docs/architecture.md §5)

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { requireRole } from "../permissions/permissions.middleware.js";
import { ROLES } from "../permissions/roles.service.js";
import { createCard, updateCard, deleteCard } from "../kanban/card.service.js";
import { notifyProject } from "../notifications/notifications.service.js";
import { requireApiKey, enforceKeyProjectScope, API_KEY_ROUTE_CONSTRAINT } from "./apikey.middleware.js";
import { rateLimitMiddleware } from "./ratelimit.middleware.js";
import { registerApiKeyManagementRoutes } from "./apikeys.routes.js";
import { registerPublicApiDocsRoutes } from "./publicapi.docs.js";
import { listProjectsForKey, listProjectCards, listBelongsToProject, cardBelongsToProject, toPublicCard, } from "./publicapi.service.js";
import { validateCreateCardBody, validateUpdateCardBody, validateListCardsQuery, } from "./publicapi.validation.js";

const authChain = [requireApiKey, rateLimitMiddleware];
const projectChain = (minRole: typeof ROLES[keyof typeof ROLES]) => [...authChain, enforceKeyProjectScope, requireRole(minRole), ];

// registerPublicApiRoutes mounts the documented /api/* public endpoints, called from app.ts behind API-key auth + rate limiting
export async function registerPublicApiRoutes(app: FastifyInstance): Promise<void> {
	app.get("/projects", { constraints: API_KEY_ROUTE_CONSTRAINT, preHandler: authChain }, getProjectsHandler);
	app.get("/projects/:projectId/cards", { preHandler: projectChain(ROLES.VIEWER) }, getCardsHandler);
	app.post("/projects/:projectId/cards", { preHandler: projectChain(ROLES.MEMBER) }, createCardHandler);
	app.put("/projects/:projectId/cards/:cardId", { preHandler: projectChain(ROLES.MEMBER) }, updateCardHandler);
	app.delete("/projects/:projectId/cards/:cardId", { preHandler: projectChain(ROLES.MEMBER) }, deleteCardHandler);

	// the documentation (GET /api/docs, GET /api/openapi.json), public
	await app.register(registerPublicApiDocsRoutes);

	// JWT-authenticated key management (issue/list/revoke)
	await app.register(registerApiKeyManagementRoutes);
}

// Cards changed through the API are told to the project like the ones changed in the app. The actor is the
// owner of the key; a key with no user gets an impersonal sentence instead.
function tellProject(
	request: FastifyRequest,
	projectId: string,
	type: string,
	entityId: string,
	text: { named: string; anonymous: string },
	name: string,
	coalesce = false,
): void {
	const actorId = request.apiKey?.userId ?? null;
	void notifyProject({
		projectId,
		actorId,
		type,
		text: actorId ? text.named : text.anonymous,
		// api_card_created / api_card_created_anonymous... in the reader's language
		key: `api_${type}${actorId ? "" : "_anonymous"}`,
		params: { name },
		entityId,
		path: `/app/${projectId}`,
		coalesce,
	});
}

// getProjectsHandler lists the caller's projects — GET /api/projects
async function getProjectsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	const apiKey = request.apiKey!;
	const projects = await listProjectsForKey(apiKey.userId as string, apiKey.projectId);
	reply.code(200).send({ projects });
}

// getCardsHandler lists cards for a project — GET /api/projects/{id}/cards
async function getCardsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	const { projectId } = request.params as { projectId: string };

	const query = validateListCardsQuery(request.query);
	if (!query.ok) {
		reply.code(400).send({ error: "invalid_input", details: query.errors });
		return;
	}

	const { cards, total } = await listProjectCards(projectId, query.value);
	reply.code(200).send({ cards, total, limit: query.value.limit, offset: query.value.offset });
}

// createCardHandler creates a card via the public API — POST /api/projects/{id}/cards
async function createCardHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	const { projectId } = request.params as { projectId: string };

	const body = validateCreateCardBody(request.body);
	if (!body.ok) {
		reply.code(400).send({ error: "invalid_input", details: body.errors });
		return;
	}

	if (!(await listBelongsToProject(body.value.listId, projectId))) {
		reply.code(404).send({ error: "list_not_found" });
		return;
	}

	// Broadcasting to the project's Socket.IO room happens inside kanban's createCard
	const card = await createCard({ ...body.value, createdBy: request.userId ?? undefined });
	reply.code(201).send({ card: toPublicCard(card, projectId) });
	tellProject(request, projectId, "card_created", card.id, {
		named: `a créé la carte « ${card.title} » via l'API`,
		anonymous: `Une carte a été créée via l'API : « ${card.title} »`,
	}, card.title);
}

// updateCardHandler updates a card via the public API — PUT /api/projects/{id}/cards/{cardId}
async function updateCardHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	const { projectId, cardId } = request.params as { projectId: string; cardId: string };

	const body = validateUpdateCardBody(request.body);
	if (!body.ok) {
		reply.code(400).send({ error: "invalid_input", details: body.errors });
		return;
	}

	if (!(await cardBelongsToProject(cardId, projectId))) {
		reply.code(404).send({ error: "card_not_found" });
		return;
	}

	const card = await updateCard(cardId, body.value);
	if (!card) {
		// deleted between the belongs-to-project check and the update
		reply.code(404).send({ error: "card_not_found" });
		return;
	}
	reply.code(200).send({ card: toPublicCard(card, projectId) });
	tellProject(request, projectId, "card_updated", card.id, {
		named: `a modifié la carte « ${card.title} » via l'API`,
		anonymous: `Une carte a été modifiée via l'API : « ${card.title} »`,
	}, card.title, true);
}

// deleteCardHandler deletes a card via the public API — DELETE /api/projects/{id}/cards/{cardId}
async function deleteCardHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	const { projectId, cardId } = request.params as { projectId: string; cardId: string };

	if (!(await cardBelongsToProject(cardId, projectId))) {
		reply.code(404).send({ error: "card_not_found" });
		return;
	}

	const deleted = await deleteCard(cardId);
	reply.code(204).send();
	if (deleted) {
		tellProject(request, projectId, "card_deleted", cardId, {
			named: `a supprimé la carte « ${deleted.title} » via l'API`,
			anonymous: `Une carte a été supprimée via l'API : « ${deleted.title} »`,
		}, deleted.title);
	}
}


