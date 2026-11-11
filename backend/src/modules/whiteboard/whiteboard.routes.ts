// Owner: Track 4 (Whiteboard, notes, and supporting modules)
// Responsible for: Fastify route handlers for the shared per-project whiteboard (load + autosave).
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { Prisma } from "@prisma/client";
import { requireAuth, requireRole } from "../permissions/permissions.middleware.js";
import { getWhiteboard, saveWhiteboard, saveWhiteboardFile, getWhiteboardFile, SceneTooLargeError, FileQuotaError } from "./whiteboard.service.js";
import { MAX_ELEMENTS_PER_SCENE, validateElements } from "./whiteboard.elements.js";

//Images Excalidraw accepts. SVG is fine here: it only ever reaches the page through <img>, never inline.
const IMAGE_DATA_URL = /^data:image\/(png|jpeg|gif|webp|svg\+xml|bmp|x-icon|avif);base64,[A-Za-z0-9+/=]+$/;
const FILE_ID = /^[A-Za-z0-9_-]{1,100}$/;
const MAX_FILE_BYTES = 6 * 1024 * 1024;//6 MiB, a little over Excalidraw's own 4 MiB image limit once base64-encoded

//An Excalidraw scene with many shapes easily passes Fastify's default 1 MiB body limit.
const MAX_SCENE_BYTES = 5 * 1024 * 1024;//5 MiB
//add routes for the whiteboard to the Fastify app instance
export async function registerWhiteboardRoutes(app: FastifyInstance): Promise<void> {
	app.get("/:projectId", { preHandler: [requireAuth, requireRole("viewer")] }, getWhiteboardHandler);
	app.put(
		"/:projectId",
		{ preHandler: [requireAuth, requireRole("member")], bodyLimit: MAX_SCENE_BYTES },
		saveWhiteboardHandler,
	);
	app.put(
		"/:projectId/files/:fileId",
		{ preHandler: [requireAuth, requireRole("member")], bodyLimit: MAX_FILE_BYTES },
		saveFileHandler,
	);
	app.get("/:projectId/files/:fileId", { preHandler: [requireAuth, requireRole("viewer")] }, getFileHandler);
}

//return the project's saved scene (null if none yet).
async function getWhiteboardHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	const { projectId } = request.params as { projectId: string };

	const whiteboard = await getWhiteboard(projectId);
	reply.code(200).send({ whiteboard });
}

//save a debounced scene from the frontend canvas.
async function saveWhiteboardHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	const userId = request.userId;
	if (!userId) {
		reply.code(401).send({ error: "unauthenticated" });
		return;
	}

	const { projectId } = request.params as { projectId: string };
	const body = request.body as { sceneJson?: unknown } | undefined;
	const sceneJson = body?.sceneJson;

	if (typeof sceneJson !== "object" || sceneJson === null || Array.isArray(sceneJson)) {
		reply.code(400).send({ error: "invalid_input", details: ["sceneJson must be a JSON object"] });
		return;
	}
	//safe after the check above: sceneJson is a non-null, non-array object
	const scene = sceneJson as Prisma.InputJsonObject;
	const elements = validateElements(scene.elements ?? [], MAX_ELEMENTS_PER_SCENE);
	if (!elements) {
		reply.code(400).send({ error: "invalid_input", details: ["sceneJson.elements must be an array of elements"] });
		return;
	}

	try {
		const whiteboard = await saveWhiteboard(projectId, userId, scene, elements);
		reply.code(200).send({ whiteboard });
	} catch (error) {
		if (error instanceof SceneTooLargeError) {
			reply.code(413).send({ error: "scene_too_large" });
			return;
		}
		throw error;
	}
}


//store an image used on the board (an image element only carries a fileId, the pixels live here).
async function saveFileHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	const { projectId, fileId } = request.params as { projectId: string; fileId: string };
	const body = request.body as { dataURL?: unknown } | undefined;
	const dataURL = body?.dataURL;

	if (!FILE_ID.test(fileId) || typeof dataURL !== "string" || !IMAGE_DATA_URL.test(dataURL)) {
		reply.code(400).send({ error: "invalid_input", details: ["dataURL must be a base64 image data URL"] });
		return;
	}
	//the mime type is read from the data URL itself, so the two can never disagree
	const mimeType = dataURL.slice(5, dataURL.indexOf(";"));

	try {
		await saveWhiteboardFile(projectId, fileId, mimeType, dataURL);
	} catch (error) {
		if (error instanceof FileQuotaError) {
			reply.code(413).send({ error: "too_many_files" });
			return;
		}
		throw error;
	}
	reply.code(204).send();
}

async function getFileHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	const { projectId, fileId } = request.params as { projectId: string; fileId: string };

	const file = await getWhiteboardFile(projectId, fileId);
	if (!file) {
		reply.code(404).send({ error: "file_not_found" });
		return;
	}
	reply.code(200).send({ file: { id: file.fileId, mimeType: file.mimeType, dataURL: file.dataUrl, created: file.createdAt.getTime() } });
}
