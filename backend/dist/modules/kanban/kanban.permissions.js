import { ROLE_RANK, getUserRole } from "../permissions/roles.service.js";
import { getProjectIdForBoard } from "./board.service.js";
import { getProjectIdForList } from "./list.service.js";
import { getProjectIdForCard } from "./card.service.js";
import { getProjectIdForTag } from "./tag.service.js";
// requireProjectRole returns a preHandler (to run after requireAuth) that rejects the request unless the
// caller holds at least minRole in the project the resolver points to.
// The routes' Fastify schemas run before preHandlers, so params and body are already validated here.
export function requireProjectRole(minRole, resolveProjectId) {
    return async function (request, reply) {
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
    projectParam: (request) => request.params.projectId,
    projectBody: (request) => request.body.projectId,
    boardParam: (request) => getProjectIdForBoard(request.params.id),
    boardIdParam: (request) => getProjectIdForBoard(request.params.boardId),
    boardBody: (request) => getProjectIdForBoard(request.body.boardId),
    listParam: (request) => getProjectIdForList(request.params.id),
    listBody: (request) => getProjectIdForList(request.body.listId),
    tagParam: (request) => getProjectIdForTag(request.params.id),
    cardParam: (request) => getProjectIdForCard(request.params.id),
};
//# sourceMappingURL=kanban.permissions.js.map