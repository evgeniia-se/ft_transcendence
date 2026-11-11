/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   roles.service.ts                                   :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: lulmaruy <lulmaruy@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/09/09 20:34:29 by lulmaruy          #+#    #+#             */
/*   Updated: 2026/09/26 16:23:55 by lulmaruy         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */
// Owner: Track 1 (Foundation, Auth, and API infrastructure)
// Responsible for: role definitions and role assignment for the Advanced permissions major module
import { prisma } from "../../db/prisma/client.js";
export const ROLES = {
    ADMIN: "admin",
    MEMBER: "member",
    VIEWER: "viewer",
};
// ROLE_RANK orders roles from least to most privileged, so permissions.middleware.ts's requireRole
export const ROLE_RANK = {
    viewer: 0,
    member: 1,
    admin: 2,
};
// getUserRole looks up a user's role within a project, used by requireRole and by frontend view-gating
export async function getUserRole(projectId, userId) {
    const member = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId } },
    });
    return member?.role ?? null;
}
//# sourceMappingURL=roles.service.js.map