//Owner: Track 4 (Whiteboard, notes, and supporting modules)
//Responsible for: Fastify route handlers for the folder tree of the Files page
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { requireAuth, requireRole } from "../permissions/permissions.middleware.js";
import { answer } from "./documentError.js";
import { notifyProject } from "../notifications/notifications.service.js";
import { copyFolder } from "./folders.copy.js";
import {
	createFolder,
	deleteFolder,
	listFolders,
	updateFolder,
	MAX_DEPTH,
	MAX_SUBFOLDERS,
} from "./folders.service.js";

const nullableId = { type: ["string", "null"] } as const;

export async function registerFoldersRoutes(app: FastifyInstance): Promise<void> {
	app.get("/:projectId", { preHandler: [requireAuth, requireRole("viewer")] }, listHandler);
	app.post(
		"/:projectId",
		{
			preHandler: [requireAuth, requireRole("member")],
			schema: {
				body: {
					type: "object",
					required: ["name"],
					additionalProperties: false,
					properties: { name: { type: "string" }, parentId: nullableId },
				},
			},
		},
		createHandler,
	);
	app.patch(
		"/:projectId/:id",
		{
			preHandler: [requireAuth, requireRole("member")],
			schema: {
				body: {
					type: "object",
					additionalProperties: false,
					properties: { name: { type: "string" }, parentId: nullableId },
				},
			},
		},
		updateHandler,
	);
	app.delete("/:projectId/:id", { preHandler: [requireAuth, requireRole("member")] }, deleteHandler);
	app.post(
		"/:projectId/:id/copy",
		{
			preHandler: [requireAuth, requireRole("member")],
			schema: {
				body: {
					type: "object",
					additionalProperties: false,
					properties: { parentId: nullableId },
				},
			},
		},
		copyHandler,
	);
}

async function listHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	const { projectId } = request.params as { projectId: string };
	const folders = await listFolders(projectId);
	reply.code(200).send({ folders, limits: { maxSubfolders: MAX_SUBFOLDERS, maxDepth: MAX_DEPTH } });
}

async function createHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	const { projectId } = request.params as { projectId: string };
	const body = request.body as { name: string; parentId?: string | null };
	await answer(reply, async () => {
		const folder = await createFolder(projectId, request.userId as string, {
			name: body.name,
			parentId: body.parentId ?? null,
		});
		reply.code(201).send({ folder });
		tell(request, projectId, "folder_created", `a créé le dossier « ${folder.name} »`, folder.id, "folder_created", folder.name);
	});
}

//the members hear about a change of the folder tree once it has succeeded
//key and name: the sentence the frontend writes in the reader's language (see ProjectEvent)
function tell(request: FastifyRequest, projectId: string, type: string, text: string, entityId: string, key: string, name: string, coalesce = false): void {
	void notifyProject({ projectId, actorId: request.userId as string, type, text, key, params: { name }, entityId, path: `/app/${projectId}/files`, coalesce });
}

async function updateHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	const { projectId, id } = request.params as { projectId: string; id: string };
	const body = request.body as { name?: string; parentId?: string | null };
	await answer(reply, async () => {
		const folder = await updateFolder(projectId, id, body);
		reply.code(200).send({ folder });
		const renamed = body.name !== undefined;
		tell(request, projectId, "folder_updated", renamed ? `a renommé le dossier « ${folder.name} »` : `a déplacé le dossier « ${folder.name} »`, id, renamed ? "folder_renamed" : "folder_moved", folder.name, true);
	});
}

async function deleteHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	const { projectId, id } = request.params as { projectId: string; id: string };
	await answer(reply, async () => {
		const folder = await deleteFolder(projectId, id);
		reply.code(204).send();
		tell(request, projectId, "folder_deleted", `a supprimé le dossier « ${folder.name} »`, id, "folder_deleted", folder.name);
	});
}

async function copyHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	const { projectId, id } = request.params as { projectId: string; id: string };
	const { parentId } = (request.body ?? {}) as { parentId?: string | null };
	await answer(reply, async () => {
		const folder = await copyFolder(projectId, request.userId as string, id, parentId ?? null);
		reply.code(201).send({ folder });
		tell(request, projectId, "folder_created", `a copié le dossier « ${folder.name} »`, folder.id, "folder_copied", folder.name);
	});
}
