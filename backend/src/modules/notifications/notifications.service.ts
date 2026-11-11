//Owner: Track 4 (Whiteboard, notes, and supporting modules)
//create, list, and mark notifications as read for a user, and fan a project event out to the people it concerns
import type { Notification, Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma/client.js";
import { broadcastToUser } from "../kanban/broadcast.js";
import { inSequence } from "../../db/concurrency.js";

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;
//read notifications are only kept this long, they are removed the next time their owner opens the list
const READ_RETENTION_DAYS = 30;
//an "updated" event repeated by the same person on the same thing within this window refreshes the unread
//notification instead of adding one more (autosave of a note, a card description typed over several minutes)
const COALESCE_WINDOW_MS = 10 * 60 * 1000;

//what happened in a project, told to its members
export interface ProjectEvent {
	projectId: string;
	//who did it: never told about their own action, and named in the message. null for an automatic change (GitHub)
	actorId: string | null;
	//card_created, note_updated, file_deleted, member_removed...: the kind of change
	type: string;
	//what happened, without the actor: "a créé la carte « X »". With no actor it is the whole sentence.
	//Stored as `message`: the French wording, kept for notifications read without `key` (older clients, old rows).
	text: string;
	//the sentence the frontend writes in the reader's language (notif.ev.<key>), with these values in it.
	//The actor's name is added by the frontend from actorName.
	key: string;
	params?: Record<string, string>;
	//the thing that changed, used to coalesce repeated updates
	entityId?: string;
	//in-app page to open from the notification, e.g. /app/<projectId>/notes/<noteId>
	path?: string | null;
	//tell only these users instead of every member (still never the actor)
	to?: string[];
	//never tell these users, on top of the actor
	exclude?: string[];
	//merge with a recent unread notification of the same actor on the same entity (needs actorId and entityId)
	coalesce?: boolean;
}

//create a notification for a user with prisma.notification.create
export async function createNotification(
	userId: string,//the notification to whom
	notifType: string,//card, note, file, etc.
	payload: unknown,//the JSON payload of the notification
): Promise<Notification> {
	if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
		throw new Error("payload must be a JSON object");
	}

	const notification = await prisma.notification.create({
		data: {
		userId,
		type: notifType,
		payload: payload as Prisma.InputJsonObject },
	});
	broadcastToUser(userId, { type: "notification", payload: notification });
	return notification;
}

//notifyProject tells the members of a project (or the `to` subset) about an event. It never throws: a
//notification that cannot be written must not undo or fail the change that caused it.
export async function notifyProject(event: ProjectEvent): Promise<void> {
	try {
		if (event.coalesce && event.actorId && event.entityId) {
			//"is there already one to refresh?" then "create or refresh" must not interleave for the same person and
			//thing, or two quick edits would each find nothing and both create one
			await inSequence(`${event.type}:${event.entityId}:${event.actorId}`, () => deliver(event));
		} else {
			await deliver(event);
		}
	} catch (err) {
		console.warn(`[Notif] Failed to deliver ${event.type} for project ${event.projectId}:`, err);
	}
}

async function deliver(event: ProjectEvent): Promise<void> {
	const [project, actor, members] = await Promise.all([
		prisma.project.findUnique({ where: { id: event.projectId }, select: { name: true } }),
		event.actorId ? prisma.user.findUnique({ where: { id: event.actorId }, select: { name: true } }) : null,
		event.to
			? null
			: prisma.projectMember.findMany({ where: { projectId: event.projectId }, select: { userId: true } }),
	]);
	if (!project) return;

	const candidates = event.to ?? (members ?? []).map((member) => member.userId);
	const recipients = [...new Set(candidates)].filter((userId) => userId !== event.actorId && !event.exclude?.includes(userId));
	if (recipients.length === 0) return;

	const payload = {
		message: actor ? `${actor.name} ${event.text}` : event.text,
		key: event.key,
		params: event.params ?? {},
		projectId: event.projectId,
		projectName: project.name,
		actorId: event.actorId,
		actorName: actor?.name ?? null,
		entityId: event.entityId ?? null,
		url: event.path ?? null,
	} satisfies Prisma.InputJsonObject;

	let fresh = recipients;
	const emitted: Notification[] = [];

	if (event.coalesce && event.actorId && event.entityId) {
		const recent = await prisma.notification.findMany({
			where: {
				userId: { in: recipients },
				type: event.type,
				readAt: null,
				createdAt: { gte: new Date(Date.now() - COALESCE_WINDOW_MS) },
				AND: [
					{ payload: { path: ["entityId"], equals: event.entityId } },
					{ payload: { path: ["actorId"], equals: event.actorId } },
				],
			},
			select: { id: true, userId: true },
		});
		if (recent.length > 0) {
			//same person, same thing, still unread: bring that notification back on top with the latest wording
			await prisma.notification.updateMany({
				where: { id: { in: recent.map((row) => row.id) } },
				data: { payload, createdAt: new Date() },
			});
			emitted.push(...(await prisma.notification.findMany({ where: { id: { in: recent.map((row) => row.id) } } })));
			const refreshed = new Set(recent.map((row) => row.userId));
			fresh = recipients.filter((userId) => !refreshed.has(userId));
		}
	}

	if (fresh.length > 0) {
		emitted.push(
			...(await prisma.notification.createManyAndReturn({
				data: fresh.map((userId) => ({ userId, type: event.type, payload })),
			})),
		);
	}

	for (const notification of emitted) {
		broadcastToUser(notification.userId, { type: "notification", payload: notification });
	}
}

export interface NotificationList {
	notifications: Notification[];
	//unread notifications in total, not only in the returned page
	unreadCount: number;
}

//the newest notifications of a user, and how many are unread
export async function listNotifications(userId: string, limit = DEFAULT_LIST_LIMIT): Promise<NotificationList> {
	await prisma.notification.deleteMany({
		where: { userId, readAt: { lt: new Date(Date.now() - READ_RETENTION_DAYS * 24 * 60 * 60 * 1000) } },
	});
	const [notifications, unreadCount] = await Promise.all([
		prisma.notification.findMany({
			where: { userId },
			orderBy: { createdAt: "desc" },
			take: Math.min(Math.max(limit, 1), MAX_LIST_LIMIT),
		}),
		prisma.notification.count({ where: { userId, readAt: null } }),
	]);
	return { notifications, unreadCount };
}

//marks a notification as read, only if it belongs to this user
//returns false if no such notification exists for this user
export async function markNotificationRead(id: string, userId: string): Promise<boolean> {
	const result = await prisma.notification.updateMany({
		where: { id, userId },
		data: { readAt: new Date() },
	});
	return result.count > 0;
}

//marks every unread notification of the user as read, returns how many changed
export async function markAllNotificationsRead(userId: string): Promise<number> {
	const result = await prisma.notification.updateMany({
		where: { userId, readAt: null },
		data: { readAt: new Date() },
	});
	return result.count;
}

//deletes a notification, only if it belongs to this user; returns false if there is none
export async function deleteNotification(id: string, userId: string): Promise<boolean> {
	const result = await prisma.notification.deleteMany({ where: { id, userId } });
	return result.count > 0;
}

//deletes every notification of the user
export async function deleteAllNotifications(userId: string): Promise<void> {
	await prisma.notification.deleteMany({ where: { userId } });
}
