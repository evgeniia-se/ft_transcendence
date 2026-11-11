import { requireAuth, requireRole } from "../permissions/permissions.middleware.js";
import { searchAll } from "./search.service.js";
//max length of search string=query
const MAX_QUERY_LENGTH = 200;
export async function registerSearchRoutes(app) {
    app.get("/:projectId", { preHandler: [requireAuth, requireRole("viewer")] }, searchHandler);
}
//runs a combined cards/notes/attachments search for a project.
async function searchHandler(request, reply) {
    const { projectId } = request.params;
    const { q } = request.query; //q? means q undefined, q can be null
    const query = q?.trim() ?? ""; //trim removes whitespace from both ends of a string
    //?? means if q is null, use the "" as default
    //if search string is too long, return 400 error
    if (query.length > MAX_QUERY_LENGTH) {
        reply.code(400).send({ error: "invalid_input", details: [`q must be at most ${MAX_QUERY_LENGTH} characters`] });
        return;
    }
    const results = await searchAll(projectId, query);
    reply.code(200).send({ results });
}
//# sourceMappingURL=search.routes.js.map