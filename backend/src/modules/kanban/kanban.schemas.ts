// Owner: Track 2 (Person A — Kanban CRUD and UI)
// Responsible for: Fastify JSON Schema definitions used to validate boards/lists/cards route
// params and bodies (see kanban.routes.ts).
import type { FastifySchema } from "fastify";

// idParamSchema validates a single :id route param as a UUID.
const idParamSchema = {
  type: "object",
  required: ["id"],
  additionalProperties: false,
  properties: {
    id: { type: "string", format: "uuid" },
  },
} as const;

const boardTitle = { type: "string", minLength: 1, maxLength: 100, pattern: "\\S" } as const;
const listTitle = { type: "string", minLength: 1, maxLength: 100, pattern: "\\S" } as const;
const cardTitle = { type: "string", minLength: 1, maxLength: 200, pattern: "\\S" } as const;
const cardDescription = { type: "string", maxLength: 10000 } as const;

export const createBoardSchema: FastifySchema = {
  body: {
    type: "object",
    required: ["projectId", "title"],
    additionalProperties: false,
    properties: {
      projectId: { type: "string", format: "uuid" },
      title: boardTitle,
    },
  },
};

export const boardIdParamSchema: FastifySchema = { params: idParamSchema };

export const projectIdParamSchema: FastifySchema = {
  params: {
    type: "object",
    required: ["projectId"],
    additionalProperties: false,
    properties: {
      projectId: { type: "string", format: "uuid" },
    },
  },
};

export const createListSchema: FastifySchema = {
  body: {
    type: "object",
    required: ["boardId", "title", "position"],
    additionalProperties: false,
    properties: {
      boardId: { type: "string", format: "uuid" },
      title: listTitle,
      position: { type: "integer", minimum: 0, maximum: 1000 },
    },
  },
};

export const listIdParamSchema: FastifySchema = { params: idParamSchema };

export const updateListSchema: FastifySchema = {
  params: idParamSchema,
  body: {
    type: "object",
    minProperties: 1,
    additionalProperties: false,
    properties: {
      title: listTitle,
      position: { type: "integer", minimum: 0, maximum: 1000 },
    },
  },
};

export const reorderListsSchema: FastifySchema = {
  params: {
    type: "object",
    required: ["boardId"],
    additionalProperties: false,
    properties: {
      boardId: { type: "string", format: "uuid" },
    },
  },
  body: {
    type: "object",
    required: ["orderedListIds"],
    additionalProperties: false,
    properties: {
      orderedListIds: {
        type: "array",
        items: { type: "string", format: "uuid" },
        minItems: 1,
        maxItems: 50,
        uniqueItems: true,
      },
    },
  },
};

export const createCardSchema: FastifySchema = {
  body: {
    type: "object",
    required: ["listId", "title", "position"],
    additionalProperties: false,
    properties: {
      listId: { type: "string", format: "uuid" },
      title: cardTitle,
      description: cardDescription,
      position: { type: "integer", minimum: 0, maximum: 1000 },
    },
  },
};

export const cardIdParamSchema: FastifySchema = { params: idParamSchema };

// moveCardSchema: position is the index the card should end up at in the destination list
export const moveCardSchema: FastifySchema = {
  params: idParamSchema,
  body: {
    type: "object",
    required: ["listId", "position"],
    additionalProperties: false,
    properties: {
      listId: { type: "string", format: "uuid" },
      position: { type: "integer", minimum: 0, maximum: 1000 },
    },
  },
};

export const updateCardSchema: FastifySchema = {
  params: idParamSchema,
  body: {
    type: "object",
    minProperties: 1,
    additionalProperties: false,
    properties: {
      title: cardTitle,
      // looser than at creation: cards created before the limit existed must stay editable
      description: { type: "string", maxLength: 100000 },
      position: { type: "integer", minimum: 0, maximum: 1000 },
    },
  },
};

const tagName = { type: "string", minLength: 1, maxLength: 30, pattern: "\\S" } as const;
const tagColor = { type: "string", pattern: "^#[0-9a-fA-F]{6}$" } as const;

export const createTagSchema: FastifySchema = {
  params: {
    type: "object",
    required: ["projectId"],
    additionalProperties: false,
    properties: { projectId: { type: "string", format: "uuid" } },
  },
  body: {
    type: "object",
    required: ["name"],
    additionalProperties: false,
    properties: { name: tagName, color: tagColor },
  },
};

export const updateTagSchema: FastifySchema = {
  params: idParamSchema,
  body: {
    type: "object",
    minProperties: 1,
    additionalProperties: false,
    properties: { name: tagName, color: tagColor },
  },
};

export const tagIdParamSchema: FastifySchema = { params: idParamSchema };

export const setCardTagsSchema: FastifySchema = {
  params: idParamSchema,
  body: {
    type: "object",
    required: ["tagIds"],
    additionalProperties: false,
    properties: {
      tagIds: { type: "array", items: { type: "string", format: "uuid" }, maxItems: 50 },
    },
  },
};
