// Owner: Track 2 (Person A — Kanban CRUD and UI)
// Responsible for: project-membership checks on the kanban routes. These routes only carry a board, list
// or card id, so the project has to be resolved first; permissions.middleware.ts's requireRole reads
// params.projectId and can't be used as is.
import type { FastifyRequest, FastifyReply } from "fastify";
import { ROLE_RANK, getUserRole, type Role } from "../permissions/roles.service.js";
import { getProjectIdForBoard } from "./board.service.js";
import { getProjectIdForList } from "./list.service.js";
import { getProjectIdForCard } from "./card.service.js";
import { getProjectIdForTag } from "./tag.service.js";

type ProjectIdResolver = (request: FastifyRequest) => Promise<string | null | undefined> | string | null | undefined;

// requireProjectRole returns a preHandler (to run after requireAuth) that rejects the request unless the
// caller holds at least minRole in the project the resolver points to.
// The routes' Fastify schemas run before preHandlers, so params and body are already validated here.
export function requireProjectRole(minRole: Role, resolveProjectId: ProjectIdResolver) {
	return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
		if (!request.userId) {
			reply.code(401).send({ error: "unauthenticated" });
			return;
		}

		const projectId = await resolveProjectId(request);
		if (!projectId) {
			reply.code(404).send({ error: "not_found" });
			return;
		}

		const role = await getUserRole(projectId, request.userId);
		if (!role || ROLE_RANK[role] < ROLE_RANK[minRole]) {
			reply.code(403).send({ error: "insufficient_role" });
			return;
		}
	};
}

// projectOf has one resolver per way a kanban route designates its project
export const projectOf = {
	projectParam: (request: FastifyRequest) => (request.params as { projectId: string }).projectId,
	projectBody: (request: FastifyRequest) => (request.body as { projectId: string }).projectId,
	boardParam: (request: FastifyRequest) => getProjectIdForBoard((request.params as { id: string }).id),
	boardIdParam: (request: FastifyRequest) => getProjectIdForBoard((request.params as { boardId: string }).boardId),
	boardBody: (request: FastifyRequest) => getProjectIdForBoard((request.body as { boardId: string }).boardId),
	listParam: (request: FastifyRequest) => getProjectIdForList((request.params as { id: string }).id),
	listBody: (request: FastifyRequest) => getProjectIdForList((request.body as { listId: string }).listId),
	tagParam: (request: FastifyRequest) => getProjectIdForTag((request.params as { id: string }).id),
	cardParam: (request: FastifyRequest) => getProjectIdForCard((request.params as { id: string }).id),
};
