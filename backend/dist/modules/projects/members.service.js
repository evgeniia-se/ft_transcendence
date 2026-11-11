/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   members.service.ts                                 :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: lulmaruy <lulmaruy@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/09/11 21:57:27 by lulmaruy          #+#    #+#             */
/*   Updated: 2026/09/30 21:06:11 by lulmaruy         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */
import { prisma } from "../../db/prisma/client.js";
import { ROLES, ROLE_RANK } from "../permissions/roles.service.js";
export class UserNotFoundError extends Error {
    constructor() {
        super("target user does not exist");
        this.name = "UserNotFoundError";
    }
}
export class LastAdminError extends Error {
    constructor() {
        super("cannot remove the project's last remaining admin");
        this.name = "LastAdminError";
    }
}
export class OwnerRoleError extends Error {
    constructor() {
        super("the project owner's role cannot be changed or removed this way");
        this.name = "OwnerRoleError";
    }
}
// addMember adds a user to a project with a given role.
export async function addMember(projectId, userId, role, db = prisma) {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
        throw new UserNotFoundError();
    }
    const project = await db.project.findUnique({
        where: { id: projectId },
        select: { ownerId: true },
    });
    if (project && project.ownerId === userId && role !== ROLES.ADMIN) {
        throw new OwnerRoleError();
    }
    const existing = await db.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId } },
    });
    if (existing && existing.role === "admin" && role !== "admin") {
        const adminCount = await db.projectMember.count({
            where: { projectId, role: "admin" },
        });
        if (adminCount <= 1) {
            throw new LastAdminError();
        }
    }
    await db.projectMember.upsert({
        where: { projectId_userId: { projectId, userId } },
        create: { projectId, userId, role },
        update: { role },
    });
}
// removeMember removes a user's membership from a project.
export async function removeMember(projectId, userId) {
    const target = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId } },
    });
    if (!target) {
        return;
    }
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { ownerId: true },
    });
    if (project && project.ownerId === userId) {
        throw new OwnerRoleError();
    }
    if (target.role === "admin") {
        const adminCount = await prisma.projectMember.count({
            where: { projectId, role: "admin" },
        });
        if (adminCount <= 1) {
            throw new LastAdminError();
        }
    }
    await prisma.projectMember.delete({
        where: { projectId_userId: { projectId, userId } },
    });
}
// listMembers returns every member of a project along with their role, for the members management view.
export async function listMembers(projectId) {
    const members = await prisma.projectMember.findMany({
        where: { projectId },
        select: { projectId: true, userId: true, role: true,
            user: { select: { id: true, name: true, email: true, avatar: true, createdAt: true } },
        },
    });
    return members.sort((a, b) => ROLE_RANK[b.role] - ROLE_RANK[a.role]);
}
//# sourceMappingURL=members.service.js.map