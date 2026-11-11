/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   projects.routes.ts                                 :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: lulmaruy <lulmaruy@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/09/12 15:44:50 by lulmaruy          #+#    #+#             */
/*   Updated: 2026/09/20 17:41:50 by lulmaruy         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */
import { requireAuth, requireRole } from "../permissions/permissions.middleware.js";
import { ROLES, ROLE_RANK } from "../permissions/roles.service.js";
import { createProject, getProject, updateProject, deleteProject, listProjectsForUser, transferProjectOwnership, InvalidProjectInputError, NotAProjectMemberError, } from "./projects.service.js";
import { addMember, removeMember, listMembers, UserNotFoundError, LastAdminError, OwnerRoleError } from "./members.service.js";
// A role coming from the request body is untrusted input. ROLE_RANK is a plain object
// Object.hasOwn only matches keys we actually defined on ROLE_RANK
function isKnownRole(role) {
    return typeof role === "string" && Object.hasOwn(ROLE_RANK, role);
}
// Every path below that carries a project ID uses :projectId
export async function registerProjectsRoutes(app) {
    app.get("/", { preHandler: requireAuth }, listProjectsHandler);
    app.post("/", { preHandler: requireAuth }, createProjectHandler);
    app.get("/:projectId", { preHandler: [requireAuth, requireRole(ROLES.VIEWER)] }, getProjectHandler);
    app.put("/:projectId", { preHandler: [requireAuth, requireRole(ROLES.ADMIN)] }, updateProjectHandler);
    app.delete("/:projectId", { preHandler: [requireAuth, requireRole(ROLES.ADMIN)] }, deleteProjectHandler);
    app.get("/:projectId/members", { preHandler: [requireAuth, requireRole(ROLES.VIEWER)] }, listMembersHandler);
    app.post("/:projectId/members", { preHandler: [requireAuth, requireRole(ROLES.ADMIN)] }, addMemberHandler);
    app.delete("/:projectId/members/:userId", { preHandler: [requireAuth, requireRole(ROLES.ADMIN)] }, removeMemberHandler);
    app.post("/:projectId/transfer-ownership", { preHandler: [requireAuth, requireRole(ROLES.ADMIN)] }, transferOwnershipHandler);
}
// listProjectsHandler returns every project the caller belongs to
async function listProjectsHandler(request, reply) {
    const projects = await listProjectsForUser(request.userId);
    reply.code(200).send({ projects });
}
// createProjectHandler creates a new project owned by the caller
async function createProjectHandler(request, reply) {
    const body = request.body;
    try {
        const project = await createProject(request.userId, { name: body?.name ?? "" });
        reply.code(201).send({ project });
    }
    catch (err) {
        if (err instanceof InvalidProjectInputError) {
            reply.code(400).send({ error: "invalid_input", details: err.details });
            return;
        }
        throw err;
    }
}
// getProjectHandler fetches a single project by :projectId param
async function getProjectHandler(request, reply) {
    const { projectId } = request.params;
    const project = await getProject(projectId);
    if (!project) {
        reply.code(404).send({ error: "project_not_found" });
        return;
    }
    reply.code(200).send({ project });
}
// updateProjectHandler edits a project's name (admin only)
async function updateProjectHandler(request, reply) {
    const { projectId } = request.params;
    const body = request.body;
    try {
        const project = await updateProject(projectId, { name: body?.name });
        reply.code(200).send({ project });
    }
    catch (err) {
        if (err instanceof InvalidProjectInputError) {
            reply.code(400).send({ error: "invalid_input", details: err.details });
            return;
        }
        throw err;
    }
}
// deleteProjectHandler deletes a project (admin only)
async function deleteProjectHandler(request, reply) {
    const { projectId } = request.params;
    const project = await getProject(projectId);
    if (!project) {
        reply.code(404).send({ error: "project_not_found" });
        return;
    }
    if (project.ownerId !== request.userId) {
        reply.code(403).send({ error: "owner_required" });
        return;
    }
    await deleteProject(projectId);
    reply.code(204).send();
}
// listMembersHandler returns a project's members and their roles
async function listMembersHandler(request, reply) {
    const { projectId } = request.params;
    const members = await listMembers(projectId);
    reply.code(200).send({ members });
}
// addMemberHandler adds a user to the project with a given role (admin only)
async function addMemberHandler(request, reply) {
    const { projectId } = request.params;
    const body = request.body;
    if (!body?.userId || !isKnownRole(body.role)) {
        reply.code(400).send({ error: "invalid_input", details: ["userId and a valid role are required"] });
        return;
    }
    try {
        await addMember(projectId, body.userId, body.role);
        reply.code(204).send();
    }
    catch (err) {
        if (err instanceof UserNotFoundError) {
            reply.code(404).send({ error: "user_not_found" });
            return;
        }
        if (err instanceof LastAdminError) {
            reply.code(409).send({ error: "last_admin" });
            return;
        }
        if (err instanceof OwnerRoleError) {
            reply.code(409).send({ error: "owner_role_immutable" });
            return;
        }
        throw err;
    }
}
// removeMemberHandler removes a user from the project (admin only).
async function removeMemberHandler(request, reply) {
    const { projectId, userId } = request.params;
    try {
        await removeMember(projectId, userId);
        reply.code(204).send();
    }
    catch (err) {
        if (err instanceof LastAdminError) {
            reply.code(409).send({ error: "last_admin" });
            return;
        }
        if (err instanceof OwnerRoleError) {
            reply.code(409).send({ error: "cannot_remove_owner" });
            return;
        }
        throw err;
    }
}
async function transferOwnershipHandler(request, reply) {
    const { projectId } = request.params;
    const body = request.body;
    if (!body?.newOwnerId) {
        reply.code(400).send({ error: "invalid_input", details: ["newOwnerId is required"] });
        return;
    }
    const project = await getProject(projectId);
    if (!project) {
        reply.code(404).send({ error: "project_not_found" });
        return;
    }
    if (project.ownerId !== request.userId) {
        reply.code(403).send({ error: "owner_required" });
        return;
    }
    try {
        const updated = await transferProjectOwnership(projectId, body.newOwnerId);
        reply.code(200).send({ project: updated });
    }
    catch (err) {
        if (err instanceof NotAProjectMemberError) {
            reply.code(409).send({ error: "not_a_project_member" });
            return;
        }
        throw err;
    }
}
//# sourceMappingURL=projects.routes.js.map