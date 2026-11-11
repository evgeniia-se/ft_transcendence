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

// Owner: Track 1 (Foundation, Auth, and API infrastructure)
// Responsible for: create/edit/delete for projects (organizations) — the Organization system major module.
// Invite-link membership (project_invites, join-by-token) lives in ./invites.ts, not here —
// this file only owns the project entity itself; project_members stays the sole authorization
// source of truth regardless of how a member was added (owner creation vs. invite join).
import type { Prisma, Project } from "@prisma/client";
import { prisma } from "../../db/prisma/client.js";
import { retryOnConflict } from "../../db/concurrency.js";
import { ROLES } from "../permissions/roles.service.js";
import { DEFAULT_TAGS } from "../kanban/tag.service.js";

type DbClient = typeof prisma | Prisma.TransactionClient;

export interface CreateProjectInput {
	name: string;
}

export interface UpdateProjectInput {
	name?: string;
}

const MAX_NAME_LENGTH = 100;

function validateProjectName(name: string | undefined): string[] {
	const errors: string[] = [];
	const trimmed = name?.trim() ?? "";

	if (!trimmed) {
		errors.push("name is required");
	} else if (trimmed.length > MAX_NAME_LENGTH) {
		errors.push(`name must be at most ${MAX_NAME_LENGTH} characters`);
	}
	return errors;
}

export class InvalidProjectInputError extends Error {
	constructor(public readonly details: string[]) {
		super("invalid project input");
		this.name = "InvalidProjectInputError";
	}
}

// createProject creates a new project (workspace) and makes the creator its owner/admin member
export async function createProject(ownerId: string, input: CreateProjectInput): Promise<Project> {
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
export async function getProject(id: string): Promise<Project | null> {
	return prisma.project.findUnique({ where: { id }});
}

export class NotAProjectMemberError extends Error {
	constructor(public readonly userId: string, public readonly projectId: string) {
		super(`user ${userId} is not a member of project ${projectId}`);
		this.name = "NotAProjectMemberError";
	}
}

// transferProjectOwnership reassigns a project's ownerId to one of its existing members and promotes that member to admin
export async function transferProjectOwnership(projectId: string, newOwnerId: string, db: DbClient = prisma): Promise<Project> {
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
export async function updateProject(id: string, input: UpdateProjectInput): Promise<Project> {
	if (input.name !== undefined) {
		const errors = validateProjectName(input.name);
		if (errors.length > 0) {
			throw new InvalidProjectInputError(errors);
		}
	}

	if (input.name === undefined) {
		return prisma.project.update({ where: { id }, data: {} });
	}
	const name = input.name.trim();
	return prisma.$transaction(async (tx) => {
		const project = await tx.project.update({ where: { id }, data: { name } });
		await tx.board.updateMany({ where: { projectId: id }, data: { title: name } });
		return project;
	});
}

// deleteProject removes a project and cascades to its boards/lists/cards/notes/attachments
export async function deleteProject(id: string): Promise<void> {
	// the cascade can deadlock with something being added to the project at that very moment: run it again
	await retryOnConflict(() => prisma.project.delete({ where: { id }}));
}

// listProjectsForUser returns every project a given user is a member of, for the project switcher UI
export async function listProjectsForUser(userId: string): Promise<Project[]> {
	return prisma.project.findMany({
		where: { members: { some: { userId } } },
		orderBy: { createdAt: "desc" },
	});
}
