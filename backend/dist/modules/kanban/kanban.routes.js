import { requireAuth } from "../permissions/permissions.middleware.js";
import { ROLES } from "../permissions/roles.service.js";
import { requireProjectRole, projectOf } from "./kanban.permissions.js";
import { createBoard, getBoard, getOrCreateBoardForProject, deleteBoard, } from "./board.service.js";
import { createList, getList, updateList, deleteList, reorderLists, } from "./list.service.js";
import { createCard, getCard, updateCard, moveCard, deleteCard } from "./card.service.js";
import { listTags, createTag, updateTag, deleteTag, setCardTags, TagConflictError } from "./tag.service.js";
import { createTagSchema, updateTagSchema, tagIdParamSchema, setCardTagsSchema, createBoardSchema, boardIdParamSchema, projectIdParamSchema, createListSchema, listIdParamSchema, updateListSchema, reorderListsSchema, createCardSchema, cardIdParamSchema, updateCardSchema, moveCardSchema, } from "./kanban.schemas.js";
// Every route runs requireAuth, then checks the caller's role in the project the entity belongs to:
// viewer to read, member to edit, admin to delete a whole board.
export async function registerKanbanRoutes(app) {
    app.post("/boards", {
        preHandler: [requireAuth, requireProjectRole(ROLES.MEMBER, projectOf.projectBody)],
        schema: createBoardSchema,
    }, createBoardHandler);
    app.get("/boards/:id", {
        preHandler: [requireAuth, requireProjectRole(ROLES.VIEWER, projectOf.boardParam)],
        schema: boardIdParamSchema,
    }, getBoardHandler);
    app.delete("/boards/:id", {
        preHandler: [requireAuth, requireProjectRole(ROLES.ADMIN, projectOf.boardParam)],
        schema: boardIdParamSchema,
    }, deleteBoardHandler);
    app.get("/projects/:projectId/board", {
        preHandler: [requireAuth, requireProjectRole(ROLES.VIEWER, projectOf.projectParam)],
        schema: projectIdParamSchema,
    }, getBoardForProjectHandler);
    app.post("/lists", {
        preHandler: [requireAuth, requireProjectRole(ROLES.MEMBER, projectOf.boardBody)],
        schema: createListSchema,
    }, createListHandler);
    app.get("/lists/:id", {
        preHandler: [requireAuth, requireProjectRole(ROLES.VIEWER, projectOf.listParam)],
        schema: listIdParamSchema,
    }, getListHandler);
    app.put("/lists/:id", {
        preHandler: [requireAuth, requireProjectRole(ROLES.MEMBER, projectOf.listParam)],
        schema: updateListSchema,
    }, updateListHandler);
    app.delete("/lists/:id", {
        preHandler: [requireAuth, requireProjectRole(ROLES.MEMBER, projectOf.listParam)],
        schema: listIdParamSchema,
    }, deleteListHandler);
    app.put("/boards/:boardId/lists/reorder", {
        preHandler: [requireAuth, requireProjectRole(ROLES.MEMBER, projectOf.boardIdParam)],
        schema: reorderListsSchema,
    }, reorderListsHandler);
    app.post("/cards", {
        preHandler: [requireAuth, requireProjectRole(ROLES.MEMBER, projectOf.listBody)],
        schema: createCardSchema,
    }, createCardHandler);
    app.get("/cards/:id", {
        preHandler: [requireAuth, requireProjectRole(ROLES.VIEWER, projectOf.cardParam)],
        schema: cardIdParamSchema,
    }, getCardHandler);
    app.put("/cards/:id", {
        preHandler: [requireAuth, requireProjectRole(ROLES.MEMBER, projectOf.cardParam)],
        schema: updateCardSchema,
    }, updateCardHandler);
    app.put("/cards/:id/move", {
        preHandler: [requireAuth, requireProjectRole(ROLES.MEMBER, projectOf.cardParam)],
        schema: moveCardSchema,
    }, moveCardHandler);
    app.delete("/cards/:id", {
        preHandler: [requireAuth, requireProjectRole(ROLES.MEMBER, projectOf.cardParam)],
        schema: cardIdParamSchema,
    }, deleteCardHandler);
    app.get("/projects/:projectId/tags", {
        preHandler: [requireAuth, requireProjectRole(ROLES.VIEWER, projectOf.projectParam)],
        schema: projectIdParamSchema,
    }, async (request, reply) => reply.send(await listTags(request.params.projectId)));
    app.post("/projects/:projectId/tags", {
        preHandler: [requireAuth, requireProjectRole(ROLES.MEMBER, projectOf.projectParam)],
        schema: createTagSchema,
    }, async (request, reply) => {
        try {
            reply.code(201).send(await createTag(request.params.projectId, request.body));
        }
        catch (err) {
            if (err instanceof TagConflictError)
                reply.code(409).send({ error: "tag_name_taken" });
            else
                throw err;
        }
    });
    app.put("/tags/:id", {
        preHandler: [requireAuth, requireProjectRole(ROLES.MEMBER, projectOf.tagParam)],
        schema: updateTagSchema,
    }, async (request, reply) => {
        try {
            const tag = await updateTag(request.params.id, request.body);
            if (!tag)
                reply.code(404).send({ error: "Tag not found" });
            else
                reply.send(tag);
        }
        catch (err) {
            if (err instanceof TagConflictError)
                reply.code(409).send({ error: "tag_name_taken" });
            else
                throw err;
        }
    });
    app.delete("/tags/:id", {
        preHandler: [requireAuth, requireProjectRole(ROLES.MEMBER, projectOf.tagParam)],
        schema: tagIdParamSchema,
    }, async (request, reply) => {
        const deleted = await deleteTag(request.params.id);
        if (!deleted)
            reply.code(404).send({ error: "Tag not found" });
        else
            reply.code(204).send();
    });
    app.put("/cards/:id/tags", {
        preHandler: [requireAuth, requireProjectRole(ROLES.MEMBER, projectOf.cardParam)],
        schema: setCardTagsSchema,
    }, async (request, reply) => {
        const card = await setCardTags(request.params.id, request.body.tagIds);
        if (card === "invalid_tags")
            reply.code(400).send({ error: "invalid_tags" });
        else if (!card)
            reply.code(404).send({ error: "Card not found" });
        else
            reply.send(card);
    });
}
// createBoardHandler creates a board within a project.
async function createBoardHandler(request, reply) {
    const board = await createBoard(request.body);
    reply.code(201).send(board);
}
// getBoardHandler fetches a board with its lists/cards for initial render.
async function getBoardHandler(request, reply) {
    const { id } = request.params;
    const board = await getBoard(id);
    if (!board) {
        reply.code(404).send({ error: "Board not found" });
        return;
    }
    reply.send(board);
}
// fetches or creates the project board, the url only carries a project id not a board id
async function getBoardForProjectHandler(request, reply) {
    const { projectId } = request.params;
    const board = await getOrCreateBoardForProject(projectId);
    if (!board) {
        reply.code(404).send({ error: "Project not found" });
        return;
    }
    reply.send(board);
}
// deleteBoardHandler deletes a board.
async function deleteBoardHandler(request, reply) {
    const { id } = request.params;
    const deleted = await deleteBoard(id);
    if (!deleted) {
        reply.code(404).send({ error: "Board not found" });
        return;
    }
    reply.code(204).send();
}
// createListHandler creates a new list/column on a board.
async function createListHandler(request, reply) {
    const list = await createList(request.body);
    reply.code(201).send(list);
}
// getListHandler fetches a list with its cards for additionnal info.
async function getListHandler(request, reply) {
    const { id } = request.params;
    const list = await getList(id);
    if (!list) {
        reply.code(404).send({ error: "List not found" });
        return;
    }
    reply.send(list);
}
// updateListHandler renames/repositions a list.
async function updateListHandler(request, reply) {
    const { id } = request.params;
    const list = await updateList(id, request.body);
    if (!list) {
        reply.code(404).send({ error: "List not found" });
        return;
    }
    reply.send(list);
}
// deleteListHandler removes a list.
async function deleteListHandler(request, reply) {
    const { id } = request.params;
    const deleted = await deleteList(id);
    if (!deleted) {
        reply.code(404).send({ error: "List not found" });
        return;
    }
    reply.code(204).send();
}
// reorderListsHandler persists a new list order after drag-and-drop.
async function reorderListsHandler(request, reply) {
    const { boardId } = request.params;
    const success = await reorderLists(boardId, request.body.orderedListIds);
    if (!success) {
        reply.code(404).send({ error: "One or more lists not found on this board" });
        return;
    }
    reply.code(204).send();
}
// createCardHandler creates a card in a list.
async function createCardHandler(request, reply) {
    const card = await createCard(request.body);
    reply.code(201).send(card);
}
// getCardHandler fetches a card for additionnal info.
async function getCardHandler(request, reply) {
    const { id } = request.params;
    const card = await getCard(id);
    if (!card) {
        reply.code(404).send({ error: "Card not found" });
        return;
    }
    reply.send(card);
}
// updateCardHandler edits a card's fields.
async function updateCardHandler(request, reply) {
    const { id } = request.params;
    const card = await updateCard(id, request.body);
    if (!card) {
        reply.code(404).send({ error: "Card not found" });
        return;
    }
    reply.send(card);
}
// moveCardHandler moves a card to a position in a list (possibly another one of the same project) after drag-and-drop.
async function moveCardHandler(request, reply) {
    const { id } = request.params;
    const { listId, position } = request.body;
    const moved = await moveCard(id, listId, position);
    if (!moved) {
        reply.code(404).send({ error: "Card or destination list not found in this project" });
        return;
    }
    reply.send(moved);
}
// deleteCardHandler removes a card.
async function deleteCardHandler(request, reply) {
    const { id } = request.params;
    const deleted = await deleteCard(id);
    if (!deleted) {
        reply.code(404).send({ error: "Card not found" });
        return;
    }
    reply.code(204).send();
}
//# sourceMappingURL=kanban.routes.js.map