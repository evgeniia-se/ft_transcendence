// idParamSchema validates a single :id route param as a UUID.
const idParamSchema = {
    type: "object",
    required: ["id"],
    additionalProperties: false,
    properties: {
        id: { type: "string", format: "uuid" },
    },
};
export const createBoardSchema = {
    body: {
        type: "object",
        required: ["projectId", "title"],
        additionalProperties: false,
        properties: {
            projectId: { type: "string", format: "uuid" },
            title: { type: "string", minLength: 1 },
        },
    },
};
export const boardIdParamSchema = { params: idParamSchema };
export const projectIdParamSchema = {
    params: {
        type: "object",
        required: ["projectId"],
        additionalProperties: false,
        properties: {
            projectId: { type: "string", format: "uuid" },
        },
    },
};
export const createListSchema = {
    body: {
        type: "object",
        required: ["boardId", "title", "position"],
        additionalProperties: false,
        properties: {
            boardId: { type: "string", format: "uuid" },
            title: { type: "string", minLength: 1 },
            position: { type: "integer", minimum: 0 },
        },
    },
};
export const listIdParamSchema = { params: idParamSchema };
export const updateListSchema = {
    params: idParamSchema,
    body: {
        type: "object",
        minProperties: 1,
        additionalProperties: false,
        properties: {
            title: { type: "string", minLength: 1 },
            position: { type: "integer", minimum: 0 },
        },
    },
};
export const reorderListsSchema = {
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
            },
        },
    },
};
export const createCardSchema = {
    body: {
        type: "object",
        required: ["listId", "title", "position"],
        additionalProperties: false,
        properties: {
            listId: { type: "string", format: "uuid" },
            title: { type: "string", minLength: 1 },
            description: { type: "string" },
            position: { type: "integer", minimum: 0 },
        },
    },
};
export const cardIdParamSchema = { params: idParamSchema };
// moveCardSchema: position is the index the card should end up at in the destination list
export const moveCardSchema = {
    params: idParamSchema,
    body: {
        type: "object",
        required: ["listId", "position"],
        additionalProperties: false,
        properties: {
            listId: { type: "string", format: "uuid" },
            position: { type: "integer", minimum: 0 },
        },
    },
};
export const updateCardSchema = {
    params: idParamSchema,
    body: {
        type: "object",
        minProperties: 1,
        additionalProperties: false,
        properties: {
            title: { type: "string", minLength: 1 },
            description: { type: "string" },
            position: { type: "integer", minimum: 0 },
        },
    },
};
const tagName = { type: "string", minLength: 1, maxLength: 30, pattern: "\\S" };
const tagColor = { type: "string", pattern: "^#[0-9a-fA-F]{6}$" };
export const createTagSchema = {
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
export const updateTagSchema = {
    params: idParamSchema,
    body: {
        type: "object",
        minProperties: 1,
        additionalProperties: false,
        properties: { name: tagName, color: tagColor },
    },
};
export const tagIdParamSchema = { params: idParamSchema };
export const setCardTagsSchema = {
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
//# sourceMappingURL=kanban.schemas.js.map