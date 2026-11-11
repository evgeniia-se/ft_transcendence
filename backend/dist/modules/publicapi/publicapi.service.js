// Owner: Track 1 (Foundation, Auth, and API infrastructure)
// Responsible for: the read/scoping queries and response serializers behind the public endpoints in publicapi.routes.ts
// Mutations are not done in here -> go kanban/card.service.ts
import { prisma } from "../../db/prisma/client.js";
import { listProjectsForUser } from "../projects/projects.service.js";
export function toPublicCard(card, projectId) {
    return {
        id: card.id,
        projectId,
        listId: card.listId,
        title: card.title,
        description: card.description,
        status: card.status,
        position: card.position,
        linkedBranch: card.linkedBranch,
        linkedPrUrl: card.linkedPrUrl,
        createdAt: card.createdAt,
        updatedAt: card.updatedAt,
    };
}
export function toPublicProject(project) {
    return {
        id: project.id,
        name: project.name,
        ownerId: project.ownerId,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
    };
}
// listProjectsForKey returns the projects visible to the key
export async function listProjectsForKey(userId, keyProjectId) {
    const projects = await listProjectsForUser(userId);
    return projects.filter((p) => keyProjectId === null || p.id === keyProjectId).map(toPublicProject);
}
// listProjectCards lists a project's cards, ordered board → list → card position. Kanban's cards.service
// has no list function (its routes load cards through getBoard), so this read lives here.
export async function listProjectCards(projectId, query) {
    const where = {
        list: { board: { projectId } },
        ...(query.listId !== undefined ? { listId: query.listId } : {}),
        ...(query.status !== undefined ? { status: query.status } : {}),
    };
    const [cards, total] = await prisma.$transaction([
        prisma.card.findMany({
            where,
            orderBy: [{ list: { board: { createdAt: "asc" } } }, { list: { position: "asc" } }, { position: "asc" }],
            take: query.limit,
            skip: query.offset,
        }),
        prisma.card.count({ where }),
    ]);
    return { cards: cards.map((c) => toPublicCard(c, projectId)), total };
}
// listBelongsToProject is the guard that stops a key for project A creating cards in project B's list
export async function listBelongsToProject(listId, projectId) {
    const list = await prisma.list.findFirst({
        where: { id: listId, board: { projectId } },
        select: { id: true },
    });
    return list !== null;
}
// cardBelongsToProject is the same guard for update/delete
export async function cardBelongsToProject(cardId, projectId) {
    const card = await prisma.card.findFirst({
        where: { id: cardId, list: { board: { projectId } } },
        select: { id: true },
    });
    return card !== null;
}
//# sourceMappingURL=publicapi.service.js.map