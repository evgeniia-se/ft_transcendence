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

// Owner: Track 1 (Foundation, Auth, and API infrastructure)
// Responsible for: Fastify route handlers for project (organization) CRUD and membership management.
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { requireAuth, requireRole } from "../permissions/permissions.middleware.js";
import { ROLES, ROLE_RANK, getUserRole, type Role } from "../permissions/roles.service.js";
import { getUser } from "../permissions/users.service.js";
import { notifyProject } from "../notifications/notifications.service.js";
import { announceMembersChanged, announceProjectDeleted, announceProjectUpdated, evictFromProject } from "../kanban/membership.events.js";
import { createProject, getProject, updateProject, deleteProject, listProjectsForUser, transferProjectOwnership, InvalidProjectInputError, NotAProjectMemberError, type CreateProjectInput, type UpdateProjectInput, } from "./projects.service.js";
import { addMember, removeMember, listMembers, findUserByEmail, isMember, UserNotFoundError, LastAdminError, OwnerRoleError } from "./members.service.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// A role coming from the request body is untrusted input. ROLE_RANK is a plain object
// Object.hasOwn only matches keys we actually defined on ROLE_RANK
function isKnownRole(role: unknown): role is Role {
	return typeof role === "string" && Object.hasOwn(ROLE_RANK, role);
}

// Every path below that carries a project ID uses :projectId
export async function registerProjectsRoutes(app: FastifyInstance): Promise<void> {
	app.get("/", { preHandler: requireAuth }, listProjectsHandler);
	app.post("/", { preHandler: requireAuth }, createProjectHandler);
	app.get("/:projectId", { preHandler: [requireAuth, requireRole(ROLES.VIEWER)] }, getProjectHandler);
	app.put("/:projectId", { preHandler: [requireAuth, requireRole(ROLES.ADMIN)] }, updateProjectHandler);
	app.delete("/:projectId", { preHandler: [requireAuth, requireRole(ROLES.ADMIN)] }, deleteProjectHandler);

	app.get("/:projectId/members", { preHandler: [requireAuth, requireRole(ROLES.VIEWER)] }, listMembersHandler);
	app.post("/:projectId/members", { preHandler: [requireAuth, requireRole(ROLES.ADMIN)] }, addMemberHandler);
	app.put("/:projectId/members/:userId", { preHandler: [requireAuth, requireRole(ROLES.ADMIN)] }, setMemberRoleHandler);
	app.delete("/:projectId/members/:userId", { preHandler: [requireAuth, requireRole(ROLES.ADMIN)] }, removeMemberHandler);
	app.post("/:projectId/transfer-ownership", { preHandler: [requireAuth, requireRole(ROLES.ADMIN)] }, transferOwnershipHandler);
}

// listProjectsHandler returns every project the caller belongs to
async function listProjectsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	const projects = await listProjectsForUser(request.userId as string);
	reply.code(200).send({ projects });
}

// createProjectHandler creates a new project owned by the caller
async function createProjectHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	const body = request.body as Partial<CreateProjectInput> | undefined;

	try {
		const project = await createProject(request.userId as string, { name: body?.name ?? "" });
		reply.code(201).send({ project });
	} catch (err) {
		if (err instanceof InvalidProjectInputError) {
			reply.code(400).send({ error: "invalid_input", details: err.details });
			return;
		}
		throw err;
	}
}

// getProjectHandler fetches a single project by :projectId param
async function getProjectHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	const { projectId } = request.params as { projectId: string };
	const project = await getProject(projectId);
	if (!project) {
		reply.code(404).send({ error: "project_not_found" });
		return;
	}
	reply.code(200).send({ project });
}

// updateProjectHandler edits a project's name (admin only)
async function updateProjectHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	const { projectId } = request.params as { projectId: string };
	const body = request.body as Partial<UpdateProjectInput> | undefined;

	try {
		const project = await updateProject(projectId, { name: body?.name });
		reply.code(200).send({ project });
		announceProjectUpdated(project);
		if (body?.name !== undefined) {
			void notifyProject({ projectId, actorId: request.userId as string, type: "project_updated", text: `a renommé le projet en « ${project.name} »`, key: "project_renamed", params: { name: project.name }, entityId: projectId, path: `/app/${projectId}`, coalesce: true });
		}
	} catch (err) {
		if (err instanceof InvalidProjectInputError) {
			reply.code(400).send({ error: "invalid_input", details: err.details });
			return;
		}
		throw err;
	}
}

// deleteProjectHandler deletes a project (admin only)
async function deleteProjectHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	const { projectId } = request.params as { projectId: string };
	const project = await getProject(projectId);
	if (!project) {
		reply.code(404).send({ error: "project_not_found" });
		return;
	}
	if (project.ownerId !== request.userId) {
		reply.code(403).send({ error: "owner_required" });
		return;
	}
	//the members are deleted with the project: they are told before, and there is no page left to open
	await notifyProject({ projectId, actorId: request.userId as string, type: "project_deleted", text: `a supprimé le projet « ${project.name} »`, key: "project_deleted", params: { name: project.name }, entityId: projectId, path: null });
	await announceProjectDeleted(projectId);
	await deleteProject(projectId);
	reply.code(204).send();
}

// The person concerned and the rest of the project are told about a change of membership, in different words.
async function tellMemberChange(
	request: FastifyRequest,
	projectId: string,
	userId: string,
	change: "added" | "role" | "removed",
	role?: Role,
): Promise<void> {
	try {
		const [project, user] = await Promise.all([getProject(projectId), getUser(userId)]);
		if (!project || !user) return;
		const actorId = request.userId as string;
		const path = change === "removed" ? null : `/app/${projectId}`;
		const base = { projectId, actorId, entityId: userId, path };
		const toThem = {
			added: `vous a ajouté au projet « ${project.name} » (rôle : ${role})`,
			role: `a changé votre rôle dans le projet « ${project.name} » (rôle : ${role})`,
			removed: `vous a retiré du projet « ${project.name} »`,
		}[change];
		const toOthers = {
			added: `a ajouté ${user.name} au projet (rôle : ${role})`,
			role: `a changé le rôle de ${user.name} (rôle : ${role})`,
			removed: userId === actorId ? "a quitté le projet" : `a retiré ${user.name} du projet`,
		}[change];
		// role is the code (admin, member, viewer): the frontend shows it in the reader's language
		const params = { project: project.name, user: user.name, role: role ?? "" };
		const keyToThem = `member_${change}_you`;
		const keyToOthers = change === "removed" && userId === actorId ? "member_left" : `member_${change}`;
		// nobody is left to tell the removed person's project about themselves: members are looked up after the change
		await notifyProject({ ...base, type: `member_${change}`, text: toThem, key: keyToThem, params, to: [userId] });
		await notifyProject({ ...base, type: `member_${change}`, text: toOthers, key: keyToOthers, params, exclude: [userId] });
	} catch (err) {
		request.log.warn({ err }, "could not notify the project members");
	}
}

// listMembersHandler returns a project's members and their roles
async function listMembersHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	const { projectId } = request.params as { projectId: string };
	const members = await listMembers(projectId);
	reply.code(200).send({ members });
}

// addMemberHandler adds a user to the project with a given role, or changes the role of a member (admin only)
async function addMemberHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	const { projectId } = request.params as { projectId: string };
	const body = request.body as { userId?: unknown; email?: unknown; role?: unknown } | undefined;
	const email = typeof body?.email === "string" ? body.email.trim() : "";
	const role = body?.role;

	if (!isKnownRole(role) || (email === "" && (typeof body?.userId !== "string" || body.userId === ""))) {
		reply.code(400).send({ error: "invalid_input", details: ["userId or email and a valid role are required"] });
		return;
	}
	if (email === "") {
		await applyMemberRole(request, reply, projectId, body?.userId as string, role);
		return;
	}
	if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
		reply.code(400).send({ error: "invalid_input", details: ["email is not valid"] });
		return;
	}
	const user = await findUserByEmail(email);
	if (!user) {
		reply.code(404).send({ error: "user_not_found" });
		return;
	}
	if (await isMember(projectId, user.id)) {
		reply.code(409).send({ error: "already_member" });
		return;
	}
	await applyMemberRole(request, reply, projectId, user.id, role);
}

// setMemberRoleHandler changes the role of an existing member — PUT /api/projects/:projectId/members/:userId
// (admin only). Unlike the POST above it never adds somebody: a user who is not a member gets 404.
async function setMemberRoleHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	const { projectId, userId } = request.params as { projectId: string; userId: string };
	const body = request.body as { role?: unknown } | undefined;

	if (!isKnownRole(body?.role)) {
		reply.code(400).send({ error: "invalid_input", details: ["a valid role is required (admin, member or viewer)"] });
		return;
	}
	if ((await getUserRole(projectId, userId)) === null) {
		reply.code(404).send({ error: "not_a_project_member" });
		return;
	}
	await applyMemberRole(request, reply, projectId, userId, body.role);
}

async function applyMemberRole(request: FastifyRequest, reply: FastifyReply, projectId: string, userId: string, role: Role): Promise<void> {
	try {
		const previousRole = await getUserRole(projectId, userId);
		await addMember(projectId, userId, role);
		reply.code(204).send();
		announceMembersChanged(projectId);
		void tellMemberChange(request, projectId, userId, previousRole === null ? "added" : "role", role);
	} catch (err) {
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
async function removeMemberHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	const { projectId, userId } = request.params as { projectId: string; userId: string };
	try {
		const wasMember = (await getUserRole(projectId, userId)) !== null;
		await removeMember(projectId, userId);
		reply.code(204).send();
		await evictFromProject(projectId, userId);
		announceMembersChanged(projectId);
		if (wasMember) void tellMemberChange(request, projectId, userId, "removed");
	} catch (err) {
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

async function transferOwnershipHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	const { projectId } = request.params as { projectId: string };
	const body = request.body as { newOwnerId?: string } | undefined;

	if (!body?.newOwnerId) {
		reply.code(400).send({ error: "invalid_input", details: ["newOwnerId is required"]});
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
	} catch (err) {
		if (err instanceof NotAProjectMemberError) {
			reply.code(409).send({ error: "not_a_project_member" });
			return;
		}
		throw err;
	}
}
