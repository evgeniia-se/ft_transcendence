/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   users.service.ts                                   :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: xzhen <xzhen@student.42.fr>                +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/09/09 21:34:46 by lulmaruy          #+#    #+#             */
/*   Updated: 2026/10/06 00:01:08 by xzhen            ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */
import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma/client.js";
import { transferProjectOwnership, NotAProjectMemberError } from "../projects/projects.service.js";
// listUsers returns all users, for the admin user-management view
export async function listUsers() {
    return prisma.user.findMany({ orderBy: { createdAt: "asc" } });
}
// getUser fetches a single user by ID
export async function getUser(id) {
    return prisma.user.findUnique({ where: { id } });
}
// updateUser applies an admin edit to a user's account
export async function updateUser(id, input) {
    return prisma.user.update({ where: { id }, data: input });
}
export class UserNotFoundError extends Error {
    constructor() {
        super("user not found");
        this.name = "UserNotFoundError";
    }
}
export class TransferTargetRequiredError extends Error {
    projectIds;
    constructor(projectIds) {
        super("transferTo is required: user owns one or more shared projects");
        this.projectIds = projectIds;
        this.name = "TransferTargetRequiredError";
    }
}
export class TransferTargetIsSelfError extends Error {
    constructor() {
        super("transferTo cannot be the user being deleted");
        this.name = "TransferTargetIsSelfError";
    }
}
export class LastAdminOfMembershipError extends Error {
    projectIds;
    constructor(projectIds) {
        super("user is the last remaining admin of one or more projects they do not own");
        this.projectIds = projectIds;
        this.name = "LastAdminOfMembershipError";
    }
}
// deleteUser removes a user account and transfer owner if there's another member
// in the project, then delete the user
export async function deleteUser(id, options = {}) {
    await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({ where: { id } });
        if (!user) {
            throw new UserNotFoundError();
        }
        if (options.transferTo === id) {
            throw new TransferTargetIsSelfError();
        }
        const ownedProjects = await tx.project.findMany({
            where: { ownerId: id },
            include: { members: true },
        });
        const sharedProjects = ownedProjects.filter((p) => p.members.some((m) => m.userId !== id));
        const soloProjects = ownedProjects.filter((p) => !p.members.some((m) => m.userId !== id));
        if (sharedProjects.length > 0) {
            if (!options.transferTo) {
                throw new TransferTargetRequiredError(sharedProjects.map((p) => p.id));
            }
            for (const project of sharedProjects) {
                const isMember = project.members.some((m) => m.userId === options.transferTo);
                if (!isMember) {
                    throw new NotAProjectMemberError(options.transferTo, project.id);
                }
            }
        }
        const adminMemberships = await tx.projectMember.findMany({
            where: { userId: id, role: "admin" },
            include: { project: { include: { members: true } } },
        });
        const lastAdminOf = adminMemberships.filter((m) => m.project.ownerId !== id)
            .filter((m) => m.project.members.filter((member) => member.role === "admin").length <= 1)
            .map((m) => m.projectId);
        if (lastAdminOf.length > 0) {
            throw new LastAdminOfMembershipError(lastAdminOf);
        }
        for (const project of sharedProjects) {
            await transferProjectOwnership(project.id, options.transferTo, tx);
            await tx.note.updateMany({
                where: { projectId: project.id, updatedBy: id },
                data: { updatedBy: options.transferTo },
            });
            await tx.attachment.updateMany({
                where: { projectId: project.id, uploadedBy: id },
                data: { uploadedBy: options.transferTo },
            });
            await tx.whiteboard.updateMany({
                where: { projectId: project.id, updatedBy: id },
                data: { updatedBy: options.transferTo },
            });
        }
        for (const project of soloProjects) {
            await tx.project.delete({ where: { id: project.id } });
        }
        await tx.notification.deleteMany({ where: { userId: id } });
        await tx.apiKey.deleteMany({ where: { userId: id } });
        await tx.user.delete({ where: { id } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
//# sourceMappingURL=users.service.js.map