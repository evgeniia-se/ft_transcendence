import { prisma } from "../../db/prisma/client.js";
//load a project's saved scene, or null if nobody has drawn yet.
export async function getWhiteboard(projectId) {
    return prisma.whiteboard.findUnique({ where: { projectId } });
}
//save a debounced scene from the Excalidraw canvas.
//The route validates that sceneJson is a JSON object and answers 400 if it isn't — the parameter
//type records that, so there is no second runtime check here.
export async function saveWhiteboard(projectId, userId, sceneJson) {
    //update the project's scene if it exists, otherwise create it
    return prisma.whiteboard.upsert({
        where: { projectId },
        update: { sceneJson, updatedBy: userId },
        create: { projectId, sceneJson, updatedBy: userId },
    });
}
//# sourceMappingURL=whiteboard.service.js.map