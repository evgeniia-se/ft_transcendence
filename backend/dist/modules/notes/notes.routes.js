import { requireAuth, requireRole } from "../permissions/permissions.middleware.js";
import { getLatestNote, autosaveNote } from "./notes.service.js";
export async function registerNotesRoutes(app) {
    app.get("/:projectId", { preHandler: [requireAuth, requireRole("viewer")] }, getNoteHandler);
    app.put("/:projectId", { preHandler: [requireAuth, requireRole("member")] }, autosaveNoteHandler);
}
//async means this func returns a promise, await means wait for the promise to resolve, then return the result
//get the note when GET
async function getNoteHandler(request, reply) {
    const { projectId } = request.params; //i know there's a projectId in request, get it
    //request.userId; request.params; request.body//params = url path
    const note = await getLatestNote(projectId); //find the note of this projectId in database
    reply.code(200).send({ note }); //send the note to the frontend using reply:FastifyReply, code 200
}
//save the note when PUT
async function autosaveNoteHandler(request, reply) {
    const userId = request.userId; //get the userId in request
    if (!userId) {
        reply.code(401).send({ error: "unauthenticated" });
        return;
    }
    const { projectId } = request.params;
    const body = request.body; //unknown means we dont know what type; undefined means we dont know if the body exists
    const contentJson = body?.contentJson; //? means get the value of contentJson safely
    //check if the contentJson is a JSON object, if not, return 400 error
    if (typeof contentJson !== "object" || contentJson === null || Array.isArray(contentJson)) {
        reply.code(400).send({ error: "invalid_input", details: ["contentJson must be a JSON object"] });
        return;
    }
    const note = await autosaveNote(projectId, userId, contentJson);
    reply.code(200).send({ note });
}
//# sourceMappingURL=notes.routes.js.map