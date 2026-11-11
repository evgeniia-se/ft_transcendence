/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   projects.service.ts                                :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: lulmaruy <lulmaruy@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/09/10 20:16:15 by lulmaruy          #+#    #+#             */
/*   Updated: 2026/09/20 17:50:13 by lulmaruy         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */
import { prisma } from "../../db/prisma/client.js";
import { ROLES } from "../permissions/roles.service.js";
import { DEFAULT_TAGS } from "../kanban/tag.service.js";
const MAX_NAME_LENGTH = 100;
function validateProjectName(name) {
    const errors = [];
    const trimmed = name?.trim() ?? "";
    if (!trimmed) {
        errors.push("name is required");
    }
    else if (trimmed.length > MAX_NAME_LENGTH) {
        errors.push(`name must be at most ${MAX_NAME_LENGTH} characters`);
    }
    return errors;
}
export class InvalidProjectInputError extends Error {
    details;
    constructor(details) {
        super("invalid project input");
        this.details = details;
        this.name = "InvalidProjectInputError";
    }
}
// createProject creates a new project (workspace) and makes the creator its owner/admin member
export async function createProject(ownerId, input) {
    const errors = validateProjectName(input.name);
    if (errors.length > 0) {
        throw new InvalidProjectInputError(errors);
    }
    const name = input.name.trim();
    return prisma.$transaction(async (tx) => {
        const project = await tx.project.create({
            data: { name, ownerId },
        });
        await tx.projectMember.create({
            data: { projectId: project.id, userId: ownerId, role: ROLES.ADMIN },
        });
        await tx.tag.createMany({
            data: DEFAULT_TAGS.map((tag) => ({ ...tag, projectId: project.id })),
        });
        return project;
    });
}
// getProject fetches a project by ID, checking the caller is a member
export async function getProject(id) {
    return prisma.project.findUnique({ where: { id } });
}
export class NotAProjectMemberError extends Error {
    userId;
    projectId;
    constructor(userId, projectId) {
        super(`user ${userId} is not a member of project ${projectId}`);
        this.userId = userId;
        this.projectId = projectId;
        this.name = "NotAProjectMemberError";
    }
}
// transferProjectOwnership reassigns a project's ownerId to one of its existing members and promotes that member to admin
export async function transferProjectOwnership(projectId, newOwnerId, db = prisma) {
    const membership = await db.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId: newOwnerId } },
    });
    if (!membership) {
        throw new NotAProjectMemberError(newOwnerId, projectId);
    }
    const project = await db.project.update({
        where: { id: projectId },
        data: { ownerId: newOwnerId },
    });
    await db.projectMember.upsert({
        where: { projectId_userId: { projectId, userId: newOwnerId } },
        create: { projectId, userId: newOwnerId, role: ROLES.ADMIN },
        update: { role: ROLES.ADMIN },
    });
    return project;
}
// updateProject edits a project's editable fields (name, etc.)
export async function updateProject(id, input) {
    if (input.name !== undefined) {
        const errors = validateProjectName(input.name);
        if (errors.length > 0) {
            throw new InvalidProjectInputError(errors);
        }
    }
    return prisma.project.update({
        where: { id },
        data: input.name !== undefined ? { name: input.name.trim() } : {}
    });
}
// deleteProject removes a project and cascades to its boards/lists/cards/notes/attachments
export async function deleteProject(id) {
    await prisma.project.delete({ where: { id } });
}
// listProjectsForUser returns every project a given user is a member of, for the project switcher UI
export async function listProjectsForUser(userId) {
    return prisma.project.findMany({
        where: { members: { some: { userId } } },
        orderBy: { createdAt: "desc" },
    });
}
//# sourceMappingURL=projects.service.js.map