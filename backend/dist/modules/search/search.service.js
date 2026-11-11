//Owner: Track 4 (Whiteboard, notes, and supporting modules)
//user can search a word in notes, cards, and attachments within a project; this service returns the results to the frontend
import { prisma } from "../../db/prisma/client.js";
const MAX_RESULTS_PER_TYPE = 20; //max number for each type of search result (card, note, attachment)
const SNIPPET_RADIUS = 60; //before and after the match, how many charaters to show in the snippet
//intern helper function, make a snippet/query=word to search for, text=the content to search in
function makeSnippet(text, query) {
    const at = text.toLowerCase().indexOf(query.toLowerCase()); //first index of the query in the text
    if (at === -1)
        return text.slice(0, SNIPPET_RADIUS * 2); //show the first 120 charaters if the query is not found
    const start = Math.max(0, at - SNIPPET_RADIUS); //start index of the snippet, 60 charaters before the match
    const end = Math.min(text.length, at + query.length + SNIPPET_RADIUS); //end index of the snippet, 60 charaters after the match
    return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
} //return a snippet with the query highlighted, and ellipses if the snippet is not at the start or end of the text
// extractPlainText walks a Tiptap JSON document and returns only the text it contains,
// so search never matches or displays structural keys like "type" or "content".
function extractPlainText(node) {
    if (node === null || typeof node !== "object")
        return "";
    if (Array.isArray(node)) {
        return node.map(extractPlainText).join("");
    }
    const record = node;
    if (record.type === "text" && typeof record.text === "string") {
        return record.text;
    }
    const inner = extractPlainText(record.content);
    // paragraphs and headings are separate blocks: add a space so words don't run together
    return record.type === "paragraph" || record.type === "heading" ? `${inner} ` : inner;
}
//searches card titles/descriptions within a project.
export async function searchCards(projectId, query) {
    if (query.trim() === "")
        return []; //return empty if user searches for empty
    //search for cards in the project in database
    const cards = await prisma.card.findMany({
        where: {
            list: { board: { projectId } }, //search for cards which is this projectId
            OR: [
                { title: { contains: query, mode: "insensitive" } }, //insenttive to case for title
                { description: { contains: query, mode: "insensitive" } }, //intensitive to case for description
            ],
        },
        take: MAX_RESULTS_PER_TYPE, //take only the first 20 results from database
        orderBy: { updatedAt: "desc" },
    });
    return cards.map((card) => ({
        entityType: "card",
        entityId: card.id,
        title: card.title, //if description is null, use title as snippet
        snippet: makeSnippet(card.description ?? card.title, query),
    }));
}
//search note content within a project.
export async function searchNotes(projectId, query) {
    if (query.trim() === "")
        return []; //return empty if user searches for empty
    //search for notes in the project in database
    const note = await prisma.note.findUnique({ where: { projectId } });
    if (!note)
        return [];
    //take the content of this note, convert it to string, give it to const text
    const text = extractPlainText(note.contentJson).trim();
    if (text === "" || !text.toLowerCase().includes(query.toLowerCase()))
        return [];
    return [
        {
            entityType: "note",
            entityId: note.id,
            title: "Project note",
            snippet: makeSnippet(text, query),
        },
    ];
}
//search attachment file names within a project.
export async function searchAttachments(projectId, query) {
    if (query.trim() === "")
        return []; //return empty if user searches for empty
    const attachments = await prisma.attachment.findMany({
        where: {
            projectId,
            fileName: { contains: query, mode: "insensitive" },
        },
        take: MAX_RESULTS_PER_TYPE,
        orderBy: { uploadedAt: "desc" },
    });
    return attachments.map((attachment) => ({
        entityType: "attachment",
        entityId: attachment.id, //with his id at the end
        title: attachment.fileName,
        snippet: attachment.fileType, //with his type at the end
    }));
}
//search cards/notes/attachments results once time, and return them to the frontend
export async function searchAll(projectId, query) {
    if (query.trim() === "")
        return []; //return empty if user searches for empty
    const [cards, notes, attachments] = await Promise.all([
        searchCards(projectId, query),
        searchNotes(projectId, query),
        searchAttachments(projectId, query),
    ]);
    return [...cards, ...notes, ...attachments];
}
//# sourceMappingURL=search.service.js.map