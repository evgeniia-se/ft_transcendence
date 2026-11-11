// Owner: Track 1 (Foundation, Auth, and API infrastructure)
// Responsible for: the 5+ documented REST endpoints (GET/POST/PUT/DELETE) required by the Public API major module, wrapping Track 2/3/4's underlying entities. TS equivalent of backend/internal/publicapi/endpoints.go (Go skeleton, removed).
import { requireRole } from "../permissions/permissions.middleware.js";
import { ROLES } from "../permissions/roles.service.js";
import { createCard, updateCard, deleteCard } from "../kanban/card.service.js";
import { requireApiKey, enforceKeyProjectScope, API_KEY_ROUTE_CONSTRAINT } from "./apikey.middleware.js";
import { rateLimitMiddleware } from "./ratelimit.middleware.js";
import { registerApiKeyManagementRoutes } from "./apikeys.routes.js";
import { listProjectsForKey, listProjectCards, listBelongsToProject, cardBelongsToProject, toPublicCard, } from "./publicapi.service.js";
import { validateCreateCardBody, validateUpdateCardBody, validateListCardsQuery, } from "./publicapi.validation.js";
const authChain = [requireApiKey, rateLimitMiddleware];
const projectChain = (minRole) => [...authChain, enforceKeyProjectScope, requireRole(minRole),];
// registerPublicApiRoutes mounts the documented /api/* public endpoints, called from app.ts behind API-key auth + rate limiting
export async function registerPublicApiRoutes(app) {
    app.get("/projects", { constraints: API_KEY_ROUTE_CONSTRAINT, preHandler: authChain }, getProjectsHandler);
    app.get("/projects/:projectId/cards", { preHandler: projectChain(ROLES.VIEWER) }, getCardsHandler);
    app.post("/projects/:projectId/cards", { preHandler: projectChain(ROLES.MEMBER) }, createCardHandler);
    app.put("/projects/:projectId/cards/:cardId", { preHandler: projectChain(ROLES.MEMBER) }, updateCardHandler);
    app.delete("/projects/:projectId/cards/:cardId", { preHandler: projectChain(ROLES.MEMBER) }, deleteCardHandler);
    // JWT-authenticated key management (issue/list/revoke)
    await app.register(registerApiKeyManagementRoutes);
}
// getProjectsHandler lists the caller's projects — GET /api/projects
async function getProjectsHandler(request, reply) {
    const apiKey = request.apiKey;
    const projects = await listProjectsForKey(apiKey.userId, apiKey.projectId);
    reply.code(200).send({ projects });
}
// getCardsHandler lists cards for a project — GET /api/projects/{id}/cards
async function getCardsHandler(request, reply) {
    const { projectId } = request.params;
    const query = validateListCardsQuery(request.query);
    if (!query.ok) {
        reply.code(400).send({ error: "invalid_input", details: query.errors });
        return;
    }
    const { cards, total } = await listProjectCards(projectId, query.value);
    reply.code(200).send({ cards, total, limit: query.value.limit, offset: query.value.offset });
}
// createCardHandler creates a card via the public API — POST /api/projects/{id}/cards
async function createCardHandler(request, reply) {
    const { projectId } = request.params;
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
    const card = await createCard(body.value);
    reply.code(201).send({ card: toPublicCard(card, projectId) });
}
// updateCardHandler updates a card via the public API — PUT /api/projects/{id}/cards/{cardId}
async function updateCardHandler(request, reply) {
    const { projectId, cardId } = request.params;
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
}
// deleteCardHandler deletes a card via the public API — DELETE /api/projects/{id}/cards/{cardId}
async function deleteCardHandler(request, reply) {
    const { projectId, cardId } = request.params;
    if (!(await cardBelongsToProject(cardId, projectId))) {
        reply.code(404).send({ error: "card_not_found" });
        return;
    }
    await deleteCard(cardId);
    reply.code(204).send();
}
//# sourceMappingURL=publicapi.routes.js.map