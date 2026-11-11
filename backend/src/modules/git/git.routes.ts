// Owner: Track 3 (Git integration)
// Responsible for: the JWT-authenticated routes the kanban UI uses to link a card to a GitHub branch —
// GitHub connection status, branch listing, link (optionally creating the branch) and unlink.
// The webhook that later moves the card is in webhook.routes.ts.
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { requireAuth } from "../permissions/permissions.middleware.js";
import { ROLES } from "../permissions/roles.service.js";
import { requireProjectRole, projectOf } from "../kanban/kanban.permissions.js";
import { updateCard } from "../kanban/card.service.js";
import { getDecryptedAccessToken } from "../auth/oauth.service.js";
import { createBranch, ensureRepoWebhook, linkCardToBranch, listBranches, parseRepoUrl, unlinkCardFromBranch } from "./branchLink.service.js";
import { listProjectWebhookEvents } from "./webhookLog.service.js";

//what git accepts as a branch name, minus the exotic cases (no "..", no leading "-" or "/", no ".lock" ending)
const BRANCH_NAME = /^(?!-)(?!.*\.\.)(?!.*\/\/)(?!.*\.lock$)(?!\/)(?!.*\/$)[A-Za-z0-9._/-]{1,200}$/;

const idParam = { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } } as const;

export async function registerGitRoutes(app: FastifyInstance): Promise<void> {
	app.get("/git/status", { preHandler: [requireAuth] }, statusHandler);

	app.get<{ Params: { projectId: string }; Querystring: { repoUrl?: string } }>(
		"/projects/:projectId/git/branches",
		{ preHandler: [requireAuth, requireProjectRole(ROLES.MEMBER, projectOf.projectParam)] },
		branchesHandler,
	);
	app.get<{ Params: { projectId: string }; Querystring: { limit?: string } }>(
		"/projects/:projectId/git/events",
		{ preHandler: [requireAuth, requireProjectRole(ROLES.ADMIN, projectOf.projectParam)] },
		eventsHandler,
	);
	app.post<{ Params: { id: string }; Body: { repoUrl?: string; branchName?: string; createBranch?: boolean } }>(
		"/cards/:id/git",
		{ preHandler: [requireAuth, requireProjectRole(ROLES.MEMBER, projectOf.cardParam)], schema: { params: idParam } },
		linkHandler,
	);
	app.delete<{ Params: { id: string } }>(
		"/cards/:id/git",
		{ preHandler: [requireAuth, requireProjectRole(ROLES.MEMBER, projectOf.cardParam)], schema: { params: idParam } },
		unlinkHandler,
	);
}

//whether the caller has a GitHub account linked: without one, no GitHub call can be made for them
async function statusHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	const token = await getDecryptedAccessToken(request.userId as string);
	reply.code(200).send({ connected: token !== null });
}

//Answer a failed GitHub call: the message comes from handleOctokitError and is meant for the user.
function sendGitHubError(reply: FastifyReply, error: unknown): void {
	const message = error instanceof Error ? error.message : "GitHub request failed";
	reply.code(502).send({ error: "github_error", message });
}

function validRepoUrl(repoUrl: unknown): repoUrl is string {
	if (typeof repoUrl !== "string" || repoUrl.length > 300) return false;
	try {
		parseRepoUrl(repoUrl);
		return true;
	} catch {
		return false;
	}
}

async function branchesHandler(
	request: FastifyRequest<{ Params: { projectId: string }; Querystring: { repoUrl?: string } }>,
	reply: FastifyReply,
): Promise<void> {
	const { repoUrl } = request.query;
	if (!validRepoUrl(repoUrl)) {
		reply.code(400).send({ error: "invalid_input", details: ["repoUrl must be a GitHub repository URL"] });
		return;
	}
	if ((await getDecryptedAccessToken(request.userId as string)) === null) {
		reply.code(409).send({ error: "github_not_linked" });
		return;
	}
	try {
		reply.code(200).send({ branches: await listBranches(request.userId as string, repoUrl) });
	} catch (error) {
		sendGitHubError(reply, error);
	}
}

//the audit log of the webhooks received for the repositories linked in this project (project admins only)
async function eventsHandler(
	request: FastifyRequest<{ Params: { projectId: string }; Querystring: { limit?: string } }>,
	reply: FastifyReply,
): Promise<void> {
	const limit = Number.parseInt(request.query.limit ?? "", 10);
	const events = await listProjectWebhookEvents(request.params.projectId, Number.isNaN(limit) ? undefined : limit);
	reply.code(200).send({ events });
}

async function linkHandler(
	request: FastifyRequest<{ Params: { id: string }; Body: { repoUrl?: string; branchName?: string; createBranch?: boolean } }>,
	reply: FastifyReply,
): Promise<void> {
	const { repoUrl, branchName, createBranch: shouldCreate } = request.body ?? {};
	if (!validRepoUrl(repoUrl) || typeof branchName !== "string" || !BRANCH_NAME.test(branchName)) {
		reply.code(400).send({ error: "invalid_input", details: ["a GitHub repoUrl and a valid branchName are required"] });
		return;
	}
	const userId = request.userId as string;
	//linking an existing branch needs no GitHub call, but creating one does
	if (shouldCreate === true) {
		if ((await getDecryptedAccessToken(userId)) === null) {
			reply.code(409).send({ error: "github_not_linked" });
			return;
		}
		try {
			await createBranch(userId, repoUrl, branchName);
		} catch (error) {
			sendGitHubError(reply, error);
			return;
		}
	}

	await linkCardToBranch(request.params.id, repoUrl, branchName);
	//best effort: the card is linked either way, but without the repo webhook it will not follow its PR.
	//Fails when the caller has no GitHub account, no admin right on the repo, or WEBHOOK_PUBLIC_URL is unset.
	try {
		await ensureRepoWebhook(userId, repoUrl);
	} catch (error) {
		request.log.warn({ error, repoUrl }, "could not register the GitHub webhook for the linked repository");
	}
	//re-read and broadcast, so every open board shows the link
	const card = await updateCard(request.params.id, {});
	reply.code(200).send(card);
}

async function unlinkHandler(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<void> {
	await unlinkCardFromBranch(request.params.id);
	const card = await updateCard(request.params.id, {});
	reply.code(200).send(card);
}
