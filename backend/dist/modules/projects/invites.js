/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   invites.ts                                         :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: lulmaruy <lulmaruy@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/09/12 22:09:24 by lulmaruy          #+#    #+#             */
/*   Updated: 2026/09/20 15:12:01 by lulmaruy         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */
// Owner: Track 1 (Foundation, Auth, and API infrastructure)
// Responsible for: the invite-link membership flow — issuing/joining/revoking project invites
// (the `project_invites` table) — part of the Organization system major module
//
// Design note: an invite link only ever proves "this token was valid at the moment it was
// redeemed." It is NOT an authorization mechanism. Joining an invite does exactly one thing
// that matters for access control: it inserts a row into `project_members` (via
// members.service.ts's addMember). Every check after that — on this project's boards, cards,
// notes, etc. — goes through permissions.middleware.ts's requireRole/getUserRole reading
// project_members, never through re-checking the invite/token.
import { randomBytes, createHash } from "crypto";
import { prisma } from "../../db/prisma/client.js";
import { requireAuth, requireRole } from "../permissions/permissions.middleware.js";
import { getUserRole, ROLES, ROLE_RANK } from "../permissions/roles.service.js";
import { addMember } from "./members.service.js";
// INVITE_JOIN_RATE_LIMIT is the dedicated @fastify/rate-limit policy for POST
// /api/projects/invites/:token/join, registered as this route's `config.rateLimit` override
// in registerInviteRoutes below (see app.ts for where the *global* default policy is
// registered). This endpoint is intentionally stricter than the global default because:
//   - it is unauthenticated-adjacent (any logged-in user can hit it with a guessed/leaked
//     token), so it's the most attractive target for brute-forcing/enumerating invite tokens
//   - unlike most routes it has an externally-visible side effect (project_members growth)
//     even on failed attempts if not limited, so it also doubles as abuse/DoS protection
// Keyed by IP by default (the plugin's default keyGenerator); revisit if a token-scoped key
// is needed once real traffic patterns are known
export const INVITE_JOIN_RATE_LIMIT = {
    max: 5,
    timeWindow: "1 minute",
};
export class InvalidInviteInputError extends Error {
    details;
    constructor(details) {
        super("invalid invite input");
        this.details = details;
        this.name = "InvalidInviteInputError";
    }
}
export class InviteNotFoundError extends Error {
    constructor() {
        super("invite not found");
        this.name = "InviteNotFoundError";
    }
}
export class InviteRevokedError extends Error {
    constructor() {
        super("invite has been revoked");
        this.name = "InviteRevokedError";
    }
}
export class InviteExpiredError extends Error {
    constructor() {
        super("invite has expired");
        this.name = "InviteExpiredError";
    }
}
export class InviteExhaustedError extends Error {
    constructor() {
        super("invite has reached its max uses");
        this.name = "InviteExhaustedError";
    }
}
export class AlreadyMemberError extends Error {
    constructor() {
        super("user is already a member of this project");
        this.name = "AlreadyMemberError";
    }
}
// the token is already a high-entropy random value a fast hash is
// sufficient here and lets join-time lookups stay cheap
function hashToken(token) {
    return createHash("sha256").update(token).digest("hex");
}
// stripTokenHash omits the secret tokenHash column before an invite is serialized in a response body
function stripTokenHash(invite) {
    return { ...invite, tokenHash: "" };
}
// createInvite creates a new invite link for a project. Returns the plaintext token only once
export async function createInvite(projectId, createdByUserId, input) {
    const errors = [];
    if (!input.role || !Object.hasOwn(ROLE_RANK, input.role)) {
        errors.push("role must be admin, member or viewer");
    }
    if (input.maxUses !== undefined && (!Number.isInteger(input.maxUses) || input.maxUses <= 0)) {
        errors.push("maxUses must be a positive integer");
    }
    if (input.expiresAt !== undefined && (Number.isNaN(input.expiresAt.getTime()) || input.expiresAt.getTime() <= Date.now())) {
        errors.push("expiresAt must be in the future");
    }
    if (errors.length > 0) {
        throw new InvalidInviteInputError(errors);
    }
    const callerRole = await getUserRole(projectId, createdByUserId);
    if (!callerRole || ROLE_RANK[callerRole] < ROLE_RANK[ROLES.ADMIN]) {
        throw new InviteNotFoundError();
    }
    const plaintextToken = randomBytes(32).toString("base64url");
    const tokenHash = hashToken(plaintextToken);
    const invite = await prisma.projectInvite.create({
        data: {
            projectId,
            tokenHash,
            role: input.role,
            maxUses: input.maxUses,
            expiresAt: input.expiresAt,
            createdBy: createdByUserId,
        },
    });
    return { invite: stripTokenHash(invite), plaintextToken };
}
// joinInvite is called when a logged-in user redeems an invite token. This is the only place
// invite validity is checked; once it succeeds, the invite is irrelevant to future authorization
export async function joinInvite(token, userId) {
    const tokenHash = hashToken(token);
    await prisma.$transaction(async (tx) => {
        const invite = await tx.projectInvite.findUnique({ where: { tokenHash } });
        if (!invite) {
            throw new InviteNotFoundError();
        }
        if (invite.revokedAt) {
            throw new InviteRevokedError();
        }
        if (invite.expiresAt && invite.expiresAt.getTime() <= Date.now()) {
            throw new InviteExpiredError();
        }
        if (invite.maxUses !== null && invite.useCount >= invite.maxUses) {
            throw new InviteExhaustedError();
        }
        const existingMembership = await tx.projectMember.findUnique({
            where: { projectId_userId: { projectId: invite.projectId, userId } },
        });
        if (existingMembership) {
            throw new AlreadyMemberError();
        }
        const claim = await tx.projectInvite.updateMany({
            where: {
                id: invite.id, OR: [{ maxUses: null }, { useCount: { lt: invite.maxUses ?? 0 } }],
            },
            data: { useCount: { increment: 1 } },
        });
        if (claim.count === 0) {
            throw new InviteExhaustedError();
        }
        // addMember (members.service.ts) inserts the row into project_members
        // which is what authorization reads from now on, never this invite again
        await addMember(invite.projectId, userId, invite.role, tx);
    });
}
// revokeInvite disables an invite link before it expires or is fully used, e.g. if it leaked.
// Does NOT touch project_members — existing members stay members. This only stops future joins.
export async function revokeInvite(projectId, inviteId, revokedByUserId) {
    const invite = await prisma.projectInvite.findUnique({ where: { id: inviteId } });
    if (!invite || invite.projectId !== projectId) {
        throw new InviteNotFoundError();
    }
    if (invite.revokedAt) {
        throw new InviteRevokedError();
    }
    await prisma.projectInvite.update({
        where: { id: inviteId },
        data: { revokedBy: revokedByUserId, revokedAt: new Date() },
    });
}
// listInvites returns a project's outstanding and past invites for the members management view
//  Not one of the 5 documented Public API endpoints
export async function listInvites(projectId) {
    const invites = await prisma.projectInvite.findMany({
        where: { projectId },
        orderBy: { createdAt: "desc" },
    });
    return invites.map(stripTokenHash);
}
// registerInviteRoutes mounts the invite endpoints on the given Fastify instance, called from
// app.ts. All three require requireAuth (the caller must be logged in); create/revoke also
// require requireRole("admin") on :projectId since only project admins manage invites. The join
// route deliberately does NOT use requireRole — the whole point is granting access to someone
// who ISN'T a member yet — but does carry the dedicated INVITE_JOIN_RATE_LIMIT config above
export async function registerInviteRoutes(app) {
    app.post("/:projectId/invites", { preHandler: [requireAuth, requireRole(ROLES.ADMIN)] }, createInviteHandler);
    app.get("/:projectId/invites", { preHandler: [requireAuth, requireRole(ROLES.ADMIN)] }, listInviteHandler);
    app.post("/invites/:token/join", { preHandler: [requireAuth], config: { rateLimit: INVITE_JOIN_RATE_LIMIT } }, joinInviteHandler);
    app.delete("/:projectId/invites/:inviteId", { preHandler: [requireAuth, requireRole(ROLES.ADMIN)] }, revokeInviteHandler);
}
// createInviteHandler — POST /api/projects/{project_id}/invites. Admin-only (requireRole).
async function createInviteHandler(request, reply) {
    const { projectId } = request.params;
    const body = request.body;
    const input = {
        role: body?.role,
        maxUses: body?.maxUses,
        expiresAt: body?.expiresAt ? new Date(body.expiresAt) : undefined,
    };
    try {
        const { invite, plaintextToken } = await createInvite(projectId, request.userId, input);
        reply.code(201).send({ invite, token: plaintextToken });
    }
    catch (err) {
        if (err instanceof InvalidInviteInputError) {
            reply.code(400).send({ error: "invalid_input", details: err.details });
            return;
        }
        if (err instanceof InviteNotFoundError) {
            reply.code(404).send({ error: "project_not_found" });
            return;
        }
        throw err;
    }
}
// istInvitesHandler GET /api/projects/{project_id}/invites. Admin-only
async function listInviteHandler(request, reply) {
    const { projectId } = request.params;
    const invites = await listInvites(projectId);
    reply.code(200).send({ invites });
}
// joinInviteHandler POST /api/projects/invites/{token}/join. Requires auth Rate-limited per INVITE_JOIN_RATE_LIMIT
async function joinInviteHandler(request, reply) {
    const { token } = request.params;
    try {
        await joinInvite(token, request.userId);
        reply.code(204).send();
    }
    catch (err) {
        if (err instanceof InviteNotFoundError) {
            reply.code(404).send({ error: "invite_not_found" });
            return;
        }
        if (err instanceof InviteRevokedError || err instanceof InviteExpiredError) {
            reply.code(410).send({ error: err instanceof InviteRevokedError ? "invite_revoked" : "invite_expired" });
            return;
        }
        if (err instanceof InviteExhaustedError || err instanceof AlreadyMemberError) {
            reply.code(409).send({ error: err instanceof InviteExhaustedError ? "invite_exhausted" : "already_member" });
            return;
        }
        throw err;
    }
}
// revokeInviteHandler — DELETE /api/projects/{project_id}/invites/{invite_id}. Admin-only.
async function revokeInviteHandler(request, reply) {
    const { projectId, inviteId } = request.params;
    try {
        await revokeInvite(projectId, inviteId, request.userId);
        reply.code(204).send();
    }
    catch (err) {
        if (err instanceof InviteNotFoundError) {
            reply.code(404).send({ error: "invite_not_found" });
            return;
        }
        if (err instanceof InviteRevokedError) {
            reply.code(409).send({ error: "already_revoked" });
            return;
        }
        throw err;
    }
}
//# sourceMappingURL=invites.js.map