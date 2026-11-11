// Owner: Track 1 (Foundation, Auth, and API infrastructure)
// Responsible for: Fastify route handlers for user account deletion (deleteUser), part of the
// Advanced permissions major module.
import { requireAuth } from "./permissions.middleware.js";
import { getUser, deleteUser, UserNotFoundError, TransferTargetRequiredError, TransferTargetIsSelfError, LastAdminOfMembershipError } from "./users.service.js";
import { NotAProjectMemberError } from "../projects/projects.service.js";
export async function registerUserRoutes(app) {
    app.get("/me", { preHandler: requireAuth }, getMeHandler);
    app.delete("/:userId", { preHandler: requireAuth }, deleteUserHandler);
}
// getMeHandler returns the caller's own profile — GET /api/users/me. Same public shape as the `user`
// object in signup/login responses (never the password hash/salt). Used by frontend apiClient.getCurrentUser()
async function getMeHandler(request, reply) {
    const user = await getUser(request.userId);
    if (!user) {
        reply.code(404).send({ error: "user_not_found" });
        return;
    }
    reply.code(200).send({ id: user.id, email: user.email, name: user.name });
}
async function deleteUserHandler(request, reply) {
    const { userId } = request.params;
    const body = request.body;
    if (userId !== request.userId) {
        reply.code(403).send({ error: "forbidden" });
        return;
    }
    try {
        await deleteUser(userId, { transferTo: body?.transferTo });
        reply.code(204).send();
    }
    catch (err) {
        if (err instanceof UserNotFoundError) {
            reply.code(404).send({ error: "user_not_found" });
            return;
        }
        if (err instanceof TransferTargetRequiredError) {
            reply.code(400).send({ error: "transfer_target_required", projectIds: err.projectIds });
            return;
        }
        if (err instanceof TransferTargetIsSelfError) {
            reply.code(400).send({ error: "invalid_transfer_target" });
            return;
        }
        if (err instanceof NotAProjectMemberError) {
            reply.code(409).send({ error: "transfer_target_not_a_member", projectId: err.projectId });
            return;
        }
        if (err instanceof LastAdminOfMembershipError) {
            reply.code(409).send({ error: "last_admin_of_membership", projectIds: err.projectIds });
        }
        throw err;
    }
}
//# sourceMappingURL=users.routes.js.map