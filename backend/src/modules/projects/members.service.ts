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

// Owner: Track 1 (Foundation, Auth, and API infrastructure)
// Responsible for: adding/removing members within a project, part of the Organization system major module
import type { Prisma, ProjectMember, User } from "@prisma/client";
import { prisma } from "../../db/prisma/client.js";
import { ROLES, ROLE_RANK, type Role } from "../permissions/roles.service.js"

type DBClient = typeof prisma | Prisma.TransactionClient;

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

type SafeUser = Pick<User, "id" | "name" | "email" | "avatar" | "createdAt">;
export type MemberWithUser = ProjectMember & { user: SafeUser };


// addMember adds a user to a project with a given role.
export async function addMember(projectId: string, userId: string, role: Role, db: DBClient = prisma): Promise<void> {
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

export async function findUserByEmail(email: string): Promise<{ id: string } | null> {
	return prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } });
}

export async function isMember(projectId: string, userId: string): Promise<boolean> {
	const row = await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId } } });
	return row !== null;
}

// removeMember removes a user's membership from a project.
export async function removeMember(projectId: string, userId: string): Promise<void> {
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
			where: { projectId, role: "admin"},
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
export async function listMembers(projectId: string): Promise<ProjectMember[]> {
	const members = await prisma.projectMember.findMany({
		where: { projectId },
		select:{ projectId: true, userId: true, role: true,
			user: { select: { id: true, name: true, email: true, avatar: true, createdAt: true }},
		},
	});
	return (members as MemberWithUser[]).sort(
		(a, b) => ROLE_RANK[b.role as Role] - ROLE_RANK[a.role as Role]);
}
