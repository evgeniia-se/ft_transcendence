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
import { ROLE_RANK, getUserRole } from "./roles.service.js";
import { validateJwt, JwtExpiredError, JwtInvalidError } from "../auth/jwt.service.js";
// requireAuth rejects requests without a valid JWT before they reach a handler. Register as a preHandler on protected routes
export async function requireAuth(request, reply) {
    const header = request.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : undefined;
    if (!token) {
        reply.code(401).send({ error: "missing_token" });
        return;
    }
    try {
        const claims = validateJwt(token);
        request.userId = claims.userId;
    }
    catch (err) {
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
export function requireRole(minRole) {
    return async function (request, reply) {
        if (!request.userId) {
            reply.code(401).send({ error: "unauthenticated" });
            return;
        }
        const params = request.params;
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
//# sourceMappingURL=permissions.middleware.js.map