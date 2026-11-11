// Owner: Track 1 (Foundation, Auth, and API infrastructure)
// Responsible for: Fastify route handlers for user account deletion (deleteUser), part of the
// Advanced permissions major module.

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { requireAuth } from "./permissions.middleware.js";
import { getUser, getVisibleProfile, updateUser, toPublicUser, changePassword, WrongPasswordError, deleteUser, UserNotFoundError, TransferTargetRequiredError, TransferTargetIsSelfError, LastAdminOfMembershipError } from "./users.service.js";
import { NotAProjectMemberError } from "../projects/projects.service.js";
import multipart from "@fastify/multipart";
import { validateDisplayName, validateNewPassword } from "../auth/auth.validation.js";
import { setAvatar, removeAvatar, readAvatarFile, InvalidAvatarError, MAX_AVATAR_BYTES } from "./avatar.service.js";
import { announceMembersChanged, evictFromProject } from "../kanban/membership.events.js";


export async function registerUserRoutes(app: FastifyInstance): Promise<void> {
	await app.register(multipart, { limits: { fileSize: MAX_AVATAR_BYTES, files: 1 } });
	app.get("/me", { preHandler: requireAuth }, getMeHandler);
	app.patch("/me", { preHandler: requireAuth }, updateMeHandler);
	app.put("/me/avatar", { preHandler: requireAuth }, uploadAvatarHandler);
	app.delete("/me/avatar", { preHandler: requireAuth }, removeAvatarHandler);
	app.put(
		"/me/password",
		{ preHandler: requireAuth, config: { rateLimit: { max: 10, timeWindow: "15 minutes" } } },
		changePasswordHandler,
	);
	app.get("/:userId", { preHandler: requireAuth }, getUserHandler);
	app.delete("/:userId", { preHandler: requireAuth }, deleteUserHandler);
}

// getMeHandler returns the caller's own profile — GET /api/users/me. Same public shape as the `user`
// object in signup/login responses (never the password hash/salt). Used by frontend apiClient.getCurrentUser()
async function getMeHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	const user = await getUser(request.userId as string);
	if (!user) {
		reply.code(404).send({ error: "user_not_found" });
		return;
	}
	reply.code(200).send(toPublicUser(user));
}

// updateMeHandler edits the caller's own display name — PATCH /api/users/me. The email is the login identity and
// is not editable here.
async function updateMeHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	const body = request.body as { name?: unknown } | undefined;
	if (body === undefined || body === null || typeof body !== "object" || body.name === undefined) {
		reply.code(400).send({ error: "invalid_input", details: ["name is required"] });
		return;
	}
	const problem = validateDisplayName(body.name);
	if (problem) {
		reply.code(400).send({ error: "invalid_input", details: [problem] });
		return;
	}
	const user = await updateUser(request.userId as string, { name: (body.name as string).trim() });
	reply.code(200).send(toPublicUser(user));
}

// getUserHandler shows a profile to somebody allowed to see it — GET /api/users/:userId. Strangers get 404.
async function getUserHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	const { userId } = request.params as { userId: string };
	const profile = await getVisibleProfile(request.userId as string, userId);
	if (!profile) {
		reply.code(404).send({ error: "user_not_found" });
		return;
	}
	reply.code(200).send({ user: profile });
}

async function deleteUserHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	const { userId } = request.params as { userId: string };
	const body = request.body as { transferTo?: string } | undefined;

	if (userId !== request.userId) {
		reply.code(403).send({ error: "forbidden" });
		return;
	}

	try {
		const { leftProjectIds } = await deleteUser(userId, { transferTo: body?.transferTo });
		reply.code(204).send();
		// their open tabs leave the projects' rooms, and the people still there see the member list change
		for (const projectId of leftProjectIds) {
			await evictFromProject(projectId, userId);
			announceMembersChanged(projectId);
		}
		} catch (err) {
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
			reply.code(409).send({ error: "last_admin_of_membership", projectIds:err.projectIds })
			return;
		}
		throw err;
	}
}


// registerAvatarRoutes serves the uploaded pictures — GET /api/avatars/:file. Public on purpose: an <img> tag cannot
// send the token, and the file name is an unguessable uuid, like the avatar URLs of any other site.
export async function registerAvatarRoutes(app: FastifyInstance): Promise<void> {
	app.get("/:file", async (request, reply) => {
		const { file } = request.params as { file: string };
		const avatar = await readAvatarFile(file);
		if (!avatar) {
			reply.code(404).send({ error: "not_found" });
			return;
		}
		reply
			.header("Content-Type", avatar.contentType)
			.header("Cache-Control", "public, max-age=31536000, immutable")
			.header("X-Content-Type-Options", "nosniff")
			.header("Cross-Origin-Resource-Policy", "same-site")
			.send(avatar.data);
	});
}

// uploadAvatarHandler replaces the caller's picture — PUT /api/users/me/avatar (multipart, field "file")
async function uploadAvatarHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	const file = await request.file();
	if (!file) {
		reply.code(400).send({ error: "invalid_input", details: ["a file field is required"] });
		return;
	}
	let data: Buffer;
	try {
		data = await file.toBuffer();
	} catch {
		reply.code(413).send({ error: "avatar_too_large", maxBytes: MAX_AVATAR_BYTES });
		return;
	}
	try {
		const avatar = await setAvatar(request.userId as string, data);
		reply.code(200).send({ avatar });
	} catch (err) {
		if (err instanceof InvalidAvatarError) {
			const status = err.reason === "too_large" ? 413 : 400;
			reply.code(status).send({ error: err.reason === "too_large" ? "avatar_too_large" : "invalid_avatar", reason: err.reason, maxBytes: MAX_AVATAR_BYTES });
			return;
		}
		throw err;
	}
}

// removeAvatarHandler goes back to the default avatar — DELETE /api/users/me/avatar
async function removeAvatarHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	await removeAvatar(request.userId as string);
	reply.code(204).send();
}

// changePasswordHandler — PUT /api/users/me/password { currentPassword, newPassword }
async function changePasswordHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	const body = request.body as { currentPassword?: unknown; newPassword?: unknown } | undefined;
	if (typeof body?.currentPassword !== "string" || typeof body.newPassword !== "string") {
		reply.code(400).send({ error: "invalid_input", details: ["currentPassword and newPassword are required"] });
		return;
	}
	const problems = validateNewPassword(body.newPassword);
	if (problems.length > 0) {
		reply.code(400).send({ error: "invalid_input", details: problems });
		return;
	}
	try {
		await changePassword(request.userId as string, body.currentPassword, body.newPassword);
		reply.code(204).send();
	} catch (err) {
		if (err instanceof WrongPasswordError) {
			// 403 and not 401: the session is fine, the frontend must not log the person out
			reply.code(403).send({ error: "wrong_password" });
			return;
		}
		if (err instanceof UserNotFoundError) {
			reply.code(404).send({ error: "user_not_found" });
			return;
		}
		throw err;
	}
}
