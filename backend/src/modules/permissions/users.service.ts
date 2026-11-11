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

// Owner: Track 1 (Foundation, Auth, and API infrastructure)
// Responsible for: admin-facing user CRUD required by the Advanced permissions major module
import type { User } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma/client.js";
import { retryOnConflict } from "../../db/concurrency.js";
import { hashPassword, verifyPassword } from "../auth/password.service.js";
import { forgetAvatarFile } from "./avatar.service.js";
import { transferProjectOwnership, NotAProjectMemberError } from "../projects/projects.service.js";

export interface UpdateUserInput {
	name?: string;
}

// the shape of the signed-in user in API responses and in the frontend session
export function toPublicUser(user: User): { id: string; email: string; name: string; avatar: string | null } {
	return { id: user.id, email: user.email, name: user.name, avatar: user.avatar };
}

// listUsers returns all users, for the admin user-management view
export async function listUsers(): Promise<User[]> {
	return prisma.user.findMany({ orderBy: { createdAt: "asc" } });
}

// getUser fetches a single user by ID
export async function getUser(id: string): Promise<User | null> {
	return prisma.user.findUnique({ where: { id }});
}

// updateUser applies an edit to a user's own account (display name)
export async function updateUser(id: string, input: UpdateUserInput): Promise<User> {
	return prisma.user.update({ where: { id }, data: input });
}

export class WrongPasswordError extends Error {
	constructor() {
		super("current password is wrong");
		this.name = "WrongPasswordError";
	}
}

// changePassword replaces the password after checking the current one. Accounts created through GitHub only have a
// random password nobody knows, so they cannot pass the check.
export async function changePassword(id: string, currentPassword: string, newPassword: string): Promise<void> {
	const user = await prisma.user.findUnique({ where: { id } });
	if (!user) throw new UserNotFoundError();
	if (!(await verifyPassword(currentPassword, user.passwordHash, user.passwordSalt))) throw new WrongPasswordError();
	const { hash, salt } = await hashPassword(newPassword);
	await prisma.user.update({ where: { id }, data: { passwordHash: hash, passwordSalt: salt } });
}

export interface VisibleProfile {
	id: string;
	name: string;
	avatar: string | null;
	createdAt: Date;
	//only the person themself and the admins of a project they share see it
	email?: string;
	//the projects the two people have in common, with the role of the person looked at
	projects: { id: string; name: string; role: string }[];
}

// getVisibleProfile is what `viewerId` may see of `targetId`: their own profile, or the profile of somebody who
// belongs to at least one of the same projects. null when the user does not exist or is a stranger, so ids cannot
// be probed. The email is kept for the person themself and for the admins of a shared project.
export async function getVisibleProfile(viewerId: string, targetId: string): Promise<VisibleProfile | null> {
	const target = await prisma.user.findUnique({ where: { id: targetId } });
	if (!target) return null;
	const base = { id: target.id, name: target.name, avatar: target.avatar, createdAt: target.createdAt };

	if (viewerId === targetId) {
		const memberships = await prisma.projectMember.findMany({ where: { userId: targetId }, include: { project: { select: { name: true } } } });
		return { ...base, email: target.email, projects: memberships.map((m) => ({ id: m.projectId, name: m.project.name, role: m.role })) };
	}

	const shared = await prisma.projectMember.findMany({
		where: { userId: targetId, project: { members: { some: { userId: viewerId } } } },
		include: { project: { select: { name: true, members: { where: { userId: viewerId }, select: { role: true } } } } },
	});
	if (shared.length === 0) return null;
	const viewerIsAdmin = shared.some((m) => m.project.members[0]?.role === "admin");
	return {
		...base,
		...(viewerIsAdmin ? { email: target.email } : {}),
		projects: shared.map((m) => ({ id: m.projectId, name: m.project.name, role: m.role })),
	};
}

export class UserNotFoundError extends Error {
	constructor() {
		super("user not found");
		this.name = "UserNotFoundError";
	}
}

export class TransferTargetRequiredError extends Error {
	constructor(public readonly projectIds: string[]) {
		super("transferTo is required: user owns one or more shared projects");
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
	constructor(public readonly projectIds: string[]) {
		super("user is the last remaining admin of one or more projects they do not own");
		this.name = "LastAdminOfMembershipError";
	}
}

// transferTo is a member ID (userId) to hand ownership to for any shared project this user
// owns. Required only if the user owns at least one project with other members
export interface DeleteUserOptions {
	transferTo?: string;
}

// deleteUser removes a user account and transfer owner if there's another member
// in the project, then delete the user
// Returns the projects the user was a member of and that go on without them: their other members need to know.
export async function deleteUser(id: string, options: DeleteUserOptions = {}): Promise<{ leftProjectIds: string[] }> {
	const { avatar, ...result } = await retryOnConflict(() => prisma.$transaction(
		async (tx) => {
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
					await transferProjectOwnership(project.id, options.transferTo as string, tx);
					await tx.note.updateMany({
						where: { projectId: project.id, updatedBy: id },
						data: { updatedBy: options.transferTo as string },
					});
					await tx.attachment.updateMany({
						where: { projectId: project.id, uploadedBy: id },
						data: { uploadedBy: options.transferTo as string },
					});
					await tx.whiteboard.updateMany({
						where: { projectId: project.id, updatedBy: id },
						data: { updatedBy: options.transferTo as string },
					});
				}

				for (const project of soloProjects) {
					await tx.project.delete({ where: { id: project.id } });
				}

				await tx.notification.deleteMany({ where: { userId: id } });
				await tx.apiKey.deleteMany({ where: { userId: id } });
				const memberOf = await tx.projectMember.findMany({ where: { userId: id }, select: { projectId: true } });
				const deleted = new Set(soloProjects.map((project) => project.id));
				await tx.user.delete({ where: { id } });
				return { avatar: user.avatar, leftProjectIds: memberOf.map((m) => m.projectId).filter((projectId) => !deleted.has(projectId)) };
		},
		{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
	));
	await forgetAvatarFile(avatar);
	return result;
}
