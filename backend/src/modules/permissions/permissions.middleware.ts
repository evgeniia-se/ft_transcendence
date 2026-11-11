/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   permissions.middleware.ts                          :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: lulmaruy <lulmaruy@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/09/09 21:47:39 by lulmaruy          #+#    #+#             */
/*   Updated: 2026/09/11 20:53:22 by lulmaruy         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

// Owner: Track 1 (Foundation, Auth, and API infrastructure)
// Responsible for: Fastify preHandler hooks enforcing authentication and role-based access for the Advanced permissions module
import type { FastifyRequest, FastifyReply } from "fastify";
import { ROLE_RANK, getUserRole, type Role } from "./roles.service.js";
import { validateJwt, JwtExpiredError, JwtInvalidError } from "../auth/jwt.service.js";

// Every module that reads request.userId relies on this rather than each file redeclairing it
declare module "fastify" {
	interface FastifyRequest {
		userId?: string;
	}
}

// requireAuth rejects requests without a valid JWT before they reach a handler. Register as a preHandler on protected routes
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	const header = request.headers.authorization;
	const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : undefined;

	if (!token) {
		reply.code(401).send({ error: "missing_token" });
		return;
	}

	try {
		const claims = validateJwt(token);
		request.userId = claims.userId;
	} catch (err) {
		if (err instanceof JwtExpiredError) {
			reply.code(401).send({ error: "token_expired" });
			return;
		}
		if (err instanceof JwtInvalidError) {
			reply.code(401).send({ error: "invalid_token" });
			return;
		}
		throw err;
	}
}

// requireRole returns a preHandler that rejects requests from users whose project role doesn't meet the minimum required role
export function requireRole(minRole: Role) {
	return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
		if (!request.userId) {
			reply.code(401).send({ error: "unauthenticated" });
			return;
		}

		const params = request.params as Record<string, string | undefined> | undefined;
		const projectId = params?.projectId;
		if (!projectId) {
			reply.code(400).send({ error: "missing_project_id" });
			return;
		}

		const role = await getUserRole(projectId, request.userId);
		if (!role || ROLE_RANK[role] < ROLE_RANK[minRole]) {
			reply.code(403).send({ error: "insufficient_role" });
			return;
		}
	};
}
