// Owner: Track 2 (Person A — Kanban CRUD and UI)
// Responsible for: Fastify route handlers for boards/lists/cards CRUD. The broadcasts to connected
// clients (Socket.IO) are done by the services themselves, so every caller of a mutation gets them.
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { requireAuth } from "../permissions/permissions.middleware.js";
import { ROLES } from "../permissions/roles.service.js";
import { requireProjectRole, projectOf } from "./kanban.permissions.js";
import { notifyProject, type ProjectEvent } from "../notifications/notifications.service.js";
import {
  createBoard,
  getBoard,
  getOrCreateBoardForProject,
  deleteBoard,
  getProjectIdForBoard,
} from "./board.service.js";
import {
  createList,
  getList,
  updateList,
  deleteList,
  reorderLists,
  getProjectIdForList,
} from "./list.service.js";
import { QuotaError } from "./quota.js";
import { createCard, getCard, updateCard, moveCard, deleteCard } from "./card.service.js";
import { listTags, createTag, updateTag, deleteTag, setCardTags, TagConflictError } from "./tag.service.js";
import {
  createTagSchema,
  updateTagSchema,
  tagIdParamSchema,
  setCardTagsSchema,
  createBoardSchema,
  boardIdParamSchema,
  projectIdParamSchema,
  createListSchema,
  listIdParamSchema,
  updateListSchema,
  reorderListsSchema,
  createCardSchema,
  cardIdParamSchema,
  updateCardSchema,
  moveCardSchema,
} from "./kanban.schemas.js";

// Every route runs requireAuth, then checks the caller's role in the project the entity belongs to:
// viewer to read, member to edit, admin to delete a whole board.
export async function registerKanbanRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: { projectId: string; title: string } }>(
    "/boards",
    {
      preHandler: [requireAuth, requireProjectRole(ROLES.MEMBER, projectOf.projectBody)],
      schema: createBoardSchema,
    },
    createBoardHandler
  );
  app.get<{ Params: { id: string } }>(
    "/boards/:id",
    {
      preHandler: [requireAuth, requireProjectRole(ROLES.VIEWER, projectOf.boardParam)],
      schema: boardIdParamSchema,
    },
    getBoardHandler
  );
  app.delete<{ Params: { id: string } }>(
    "/boards/:id",
    {
      preHandler: [requireAuth, requireProjectRole(ROLES.ADMIN, projectOf.boardParam)],
      schema: boardIdParamSchema,
    },
    deleteBoardHandler
  );
  app.get<{ Params: { projectId: string } }>(
    "/projects/:projectId/board",
    {
      preHandler: [requireAuth, requireProjectRole(ROLES.VIEWER, projectOf.projectParam)],
      schema: projectIdParamSchema,
    },
    getBoardForProjectHandler
  );

  app.post<{ Body: { boardId: string; title: string; position: number } }>(
    "/lists",
    {
      preHandler: [requireAuth, requireProjectRole(ROLES.MEMBER, projectOf.boardBody)],
      schema: createListSchema,
    },
    createListHandler
  );
  app.get<{ Params: { id: string } }>(
    "/lists/:id",
    {
      preHandler: [requireAuth, requireProjectRole(ROLES.VIEWER, projectOf.listParam)],
      schema: listIdParamSchema,
    },
    getListHandler
  );
  app.put<{ Params: { id: string }; Body: { title?: string; position?: number } }>(
    "/lists/:id",
    {
      preHandler: [requireAuth, requireProjectRole(ROLES.MEMBER, projectOf.listParam)],
      schema: updateListSchema,
    },
    updateListHandler
  );
  app.delete<{ Params: { id: string } }>(
    "/lists/:id",
    {
      preHandler: [requireAuth, requireProjectRole(ROLES.MEMBER, projectOf.listParam)],
      schema: listIdParamSchema,
    },
    deleteListHandler
  );
  app.put<{ Params: { boardId: string }; Body: { orderedListIds: string[] } }>(
    "/boards/:boardId/lists/reorder",
    {
      preHandler: [requireAuth, requireProjectRole(ROLES.MEMBER, projectOf.boardIdParam)],
      schema: reorderListsSchema,
    },
    reorderListsHandler
  );

  app.post<{ Body: { listId: string; title: string; description?: string; position: number } }>(
    "/cards",
    {
      preHandler: [requireAuth, requireProjectRole(ROLES.MEMBER, projectOf.listBody)],
      schema: createCardSchema,
    },
    createCardHandler
  );
  app.get<{ Params: { id: string } }>(
    "/cards/:id",
    {
      preHandler: [requireAuth, requireProjectRole(ROLES.VIEWER, projectOf.cardParam)],
      schema: cardIdParamSchema,
    },
    getCardHandler
  );
  app.put<{
    Params: { id: string };
    Body: { title?: string; description?: string; position?: number };
  }>(
    "/cards/:id",
    {
      preHandler: [requireAuth, requireProjectRole(ROLES.MEMBER, projectOf.cardParam)],
      schema: updateCardSchema,
    },
    updateCardHandler
  );
  app.put<{ Params: { id: string }; Body: { listId: string; position: number } }>(
    "/cards/:id/move",
    {
      preHandler: [requireAuth, requireProjectRole(ROLES.MEMBER, projectOf.cardParam)],
      schema: moveCardSchema,
    },
    moveCardHandler
  );
  app.delete<{ Params: { id: string } }>(
    "/cards/:id",
    {
      preHandler: [requireAuth, requireProjectRole(ROLES.MEMBER, projectOf.cardParam)],
      schema: cardIdParamSchema,
    },
    deleteCardHandler
  );

  app.get<{ Params: { projectId: string } }>(
    "/projects/:projectId/tags",
    {
      preHandler: [requireAuth, requireProjectRole(ROLES.VIEWER, projectOf.projectParam)],
      schema: projectIdParamSchema,
    },
    async (request, reply) => reply.send(await listTags(request.params.projectId))
  );
  app.post<{ Params: { projectId: string }; Body: { name: string; color?: string } }>(
    "/projects/:projectId/tags",
    {
      preHandler: [requireAuth, requireProjectRole(ROLES.MEMBER, projectOf.projectParam)],
      schema: createTagSchema,
    },
    async (request, reply) => {
      try {
        const tag = await createTag(request.params.projectId, request.body);
        reply.code(201).send(tag);
        void tell(request, tag.projectId, { type: "tag_created", text: `a créé l'étiquette « ${tag.name} »`, key: "tag_created", params: { name: tag.name }, entityId: tag.id });
      } catch (err) {
        if (err instanceof TagConflictError) reply.code(409).send({ error: "tag_name_taken" });
        else throw err;
      }
    }
  );
  app.put<{ Params: { id: string }; Body: { name?: string; color?: string } }>(
    "/tags/:id",
    {
      preHandler: [requireAuth, requireProjectRole(ROLES.MEMBER, projectOf.tagParam)],
      schema: updateTagSchema,
    },
    async (request, reply) => {
      try {
        const tag = await updateTag(request.params.id, request.body);
        if (!tag) reply.code(404).send({ error: "Tag not found" });
        else {
          reply.send(tag);
          void tell(request, tag.projectId, { type: "tag_updated", text: `a modifié l'étiquette « ${tag.name} »`, key: "tag_updated", params: { name: tag.name }, entityId: tag.id, coalesce: true });
        }
      } catch (err) {
        if (err instanceof TagConflictError) reply.code(409).send({ error: "tag_name_taken" });
        else throw err;
      }
    }
  );
  app.delete<{ Params: { id: string } }>(
    "/tags/:id",
    {
      preHandler: [requireAuth, requireProjectRole(ROLES.MEMBER, projectOf.tagParam)],
      schema: tagIdParamSchema,
    },
    async (request, reply) => {
      const deleted = await deleteTag(request.params.id);
      if (!deleted) reply.code(404).send({ error: "Tag not found" });
      else {
        reply.code(204).send();
        void tell(request, deleted.projectId, { type: "tag_deleted", text: `a supprimé l'étiquette « ${deleted.name} »`, key: "tag_deleted", params: { name: deleted.name }, entityId: deleted.id });
      }
    }
  );
  app.put<{ Params: { id: string }; Body: { tagIds: string[] } }>(
    "/cards/:id/tags",
    {
      preHandler: [requireAuth, requireProjectRole(ROLES.MEMBER, projectOf.cardParam)],
      schema: setCardTagsSchema,
    },
    async (request, reply) => {
      const card = await setCardTags(request.params.id, request.body.tagIds);
      if (card === "invalid_tags") reply.code(400).send({ error: "invalid_tags" });
      else if (!card) reply.code(404).send({ error: "Card not found" });
      else {
        reply.send(card);
        void tell(request, getProjectIdForList(card.listId), { type: "card_tags_updated", text: `a modifié les étiquettes de la carte « ${card.title} »`, key: "card_tags_updated", params: { name: card.title }, entityId: card.id, coalesce: true });
      }
    }
  );
}


// The project's members are told about a change once it has succeeded, after the reply: a notification that
// fails must not fail the change (notifyProject never throws; the project lookup is guarded here).
type CardEvent = Omit<ProjectEvent, "projectId" | "actorId">;
async function tell(request: FastifyRequest, projectId: string | null | Promise<string | null>, event: CardEvent): Promise<void> {
  try {
    const id = await projectId;
    if (id) await notifyProject({ ...event, projectId: id, actorId: request.userId ?? null, path: `/app/${id}` });
  } catch (err) {
    request.log.warn({ err }, "could not notify the project members");
  }
}

// createBoardHandler creates a board within a project.
async function createBoardHandler(
  request: FastifyRequest<{ Body: { projectId: string; title: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const board = await createBoard(request.body);
    reply.code(201).send(board);
  } catch (err) {
    if (err instanceof QuotaError) reply.code(409).send({ error: "quota_exceeded" });
    else throw err;
  }
}

// getBoardHandler fetches a board with its lists/cards for initial render.
async function getBoardHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<void> {
  const { id } = request.params;
  const board = await getBoard(id);

  if (!board) {
    reply.code(404).send({ error: "Board not found" });
    return;
  }
  reply.send(board);
}

// fetches or creates the project board, the url only carries a project id not a board id
async function getBoardForProjectHandler(
  request: FastifyRequest<{ Params: { projectId: string } }>,
  reply: FastifyReply
): Promise<void> {
  const { projectId } = request.params;
  const board = await getOrCreateBoardForProject(projectId);

  if (!board) {
    reply.code(404).send({ error: "Project not found" });
    return;
  }
  reply.send(board);
}

// deleteBoardHandler deletes a board.
async function deleteBoardHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<void> {
  const { id } = request.params;
  const deleted = await deleteBoard(id);

  if (!deleted) {
    reply.code(404).send({ error: "Board not found" });
    return;
  }
  reply.code(204).send();
  void tell(request, deleted.projectId, { type: "board_deleted", text: `a supprimé le tableau « ${deleted.title} »`, key: "board_deleted", params: { name: deleted.title }, entityId: deleted.id });
}

// createListHandler creates a new list/column on a board.
async function createListHandler(
  request: FastifyRequest<{ Body: { boardId: string; title: string; position: number } }>,
  reply: FastifyReply
): Promise<void> {
  let list;
  try {
    list = await createList(request.body);
  } catch (err) {
    if (err instanceof QuotaError) reply.code(409).send({ error: "quota_exceeded" });
    else throw err;
    return;
  }
  reply.code(201).send(list);
  void tell(request, getProjectIdForBoard(list.boardId), { type: "list_created", text: `a ajouté la liste « ${list.title} »`, key: "list_created", params: { name: list.title }, entityId: list.id });
}

// getListHandler fetches a list with its cards for additionnal info.
async function getListHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<void> {
  const { id } = request.params;
  const list = await getList(id);

  if (!list) {
    reply.code(404).send({ error: "List not found" });
    return;
  }
  reply.send(list);
}

// updateListHandler renames/repositions a list.
async function updateListHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: { title?: string; position?: number } }>,
  reply: FastifyReply
): Promise<void> {
  const { id } = request.params;

  const list = await updateList(id, request.body);
  if (!list)
  {
    reply.code(404).send({ error: "List not found" });
    return;
  }
  reply.send(list);
  // moving a list around is not worth a notification, renaming it is
  if (request.body.title !== undefined) {
    void tell(request, getProjectIdForBoard(list.boardId), { type: "list_updated", text: `a renommé la liste « ${list.title} »`, key: "list_renamed", params: { name: list.title }, entityId: list.id, coalesce: true });
  }
}

// deleteListHandler removes a list.
async function deleteListHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<void> {
  const { id } = request.params;
  const deleted = await deleteList(id);

  if (!deleted) {
    reply.code(404).send({ error: "List not found" });
    return;
  }
  reply.code(204).send();
  void tell(request, getProjectIdForBoard(deleted.boardId), { type: "list_deleted", text: `a supprimé la liste « ${deleted.title} »`, key: "list_deleted", params: { name: deleted.title }, entityId: deleted.id });
}

// reorderListsHandler persists a new list order after drag-and-drop.
async function reorderListsHandler(
  request: FastifyRequest<{ Params: { boardId: string }; Body: { orderedListIds: string[] } }>,
  reply: FastifyReply
): Promise<void> {
  const { boardId } = request.params;

  const success = await reorderLists(boardId, request.body.orderedListIds);

  if (!success) {
    reply.code(404).send({ error: "One or more lists not found on this board" });
    return;
  }
  reply.code(204).send();
}

// createCardHandler creates a card in a list.
async function createCardHandler(
  request: FastifyRequest<{
    Body: { listId: string; title: string; description?: string; position: number };
  }>,
  reply: FastifyReply
): Promise<void> {
  let card;
  try {
    card = await createCard({ ...request.body, createdBy: request.userId });
  } catch (err) {
    if (err instanceof QuotaError) reply.code(409).send({ error: "quota_exceeded" });
    else throw err;
    return;
  }
  reply.code(201).send(card);
  void tell(request, getProjectIdForList(card.listId), { type: "card_created", text: `a créé la carte « ${card.title} »`, key: "card_created", params: { name: card.title }, entityId: card.id });
}

// getCardHandler fetches a card for additionnal info.
async function getCardHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<void> {
  const { id } = request.params;
  const card = await getCard(id);

  if (!card) {
    reply.code(404).send({ error: "Card not found" });
    return;
  }
  reply.send(card);
}

// updateCardHandler edits a card's fields.
async function updateCardHandler(
  request: FastifyRequest<{
    Params: { id: string };
    Body: { title?: string; description?: string; position?: number };
  }>,
  reply: FastifyReply
): Promise<void> {
  const { id } = request.params;

  const card = await updateCard(id, request.body);
  if (!card) {
    reply.code(404).send({ error: "Card not found" });
    return;
  }
  reply.send(card);
  // a pure reorder (position only) is not a content change
  if (request.body.title !== undefined || request.body.description !== undefined) {
    void tell(request, getProjectIdForList(card.listId), { type: "card_updated", text: `a modifié la carte « ${card.title} »`, key: "card_updated", params: { name: card.title }, entityId: card.id, coalesce: true });
  }
}

// moveCardHandler moves a card to a position in a list (possibly another one of the same project) after drag-and-drop.
async function moveCardHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: { listId: string; position: number } }>,
  reply: FastifyReply
): Promise<void> {
  const { id } = request.params;
  const { listId, position } = request.body;

  let moved;
  try {
    moved = await moveCard(id, listId, position);
  } catch (err) {
    if (err instanceof QuotaError) {
      reply.code(409).send({ error: "quota_exceeded" });
      return;
    }
    throw err;
  }
  if (!moved) {
    reply.code(404).send({ error: "Card or destination list not found in this project" });
    return;
  }
  reply.send(moved);
  // reordering inside a list says nothing: only a change of list is told
  if (moved.fromListId !== moved.toListId) {
    void (async () => {
      const [card, list] = await Promise.all([getCard(id), getList(moved.toListId)]);
      if (card && list) {
        await tell(request, getProjectIdForList(moved.toListId), { type: "card_moved", text: `a déplacé la carte « ${card.title} » vers « ${list.title} »`, key: "card_moved", params: { name: card.title, list: list.title }, entityId: id, coalesce: true });
      }
    })().catch((err) => request.log.warn({ err }, "could not notify the project members"));
  }
}

// deleteCardHandler removes a card.
async function deleteCardHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<void> {
  const { id } = request.params;
  const deleted = await deleteCard(id);

  if (!deleted) {
    reply.code(404).send({ error: "Card not found" });
    return;
  }
  reply.code(204).send();
  void tell(request, getProjectIdForList(deleted.listId), { type: "card_deleted", text: `a supprimé la carte « ${deleted.title} »`, key: "card_deleted", params: { name: deleted.title }, entityId: deleted.id });
}
