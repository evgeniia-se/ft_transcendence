import { requireAuth, requireRole } from "../permissions/permissions.middleware.js";
import { getWhiteboard, saveWhiteboard } from "./whiteboard.service.js";
//An Excalidraw scene with many shapes easily passes Fastify's default 1 MiB body limit.
const MAX_SCENE_BYTES = 5 * 1024 * 1024; //5 MiB
//add routes for the whiteboard to the Fastify app instance
export async function registerWhiteboardRoutes(app) {
    app.get("/:projectId", { preHandler: [requireAuth, requireRole("viewer")] }, getWhiteboardHandler);
    app.put("/:projectId", { preHandler: [requireAuth, requireRole("member")], bodyLimit: MAX_SCENE_BYTES }, saveWhiteboardHandler);
}
//return the project's saved scene (null if none yet).
async function getWhiteboardHandler(request, reply) {
    const { projectId } = request.params;
    const whiteboard = await getWhiteboard(projectId);
    reply.code(200).send({ whiteboard });
}
//save a debounced scene from the frontend canvas.
async function saveWhiteboardHandler(request, reply) {
    const userId = request.userId;
    if (!userId) {
        reply.code(401).send({ error: "unauthenticated" });
        return;
    }
    const { projectId } = request.params;
    const body = request.body;
    const sceneJson = body?.sceneJson;
    if (typeof sceneJson !== "object" || sceneJson === null || Array.isArray(sceneJson)) {
        reply.code(400).send({ error: "invalid_input", details: ["sceneJson must be a JSON object"] });
        return;
    }
    //safe after the check above: sceneJson is a non-null, non-array object
    const scene = sceneJson;
    const whiteboard = await saveWhiteboard(projectId, userId, scene);
    reply.code(200).send({ whiteboard });
}
//# sourceMappingURL=whiteboard.routes.js.map