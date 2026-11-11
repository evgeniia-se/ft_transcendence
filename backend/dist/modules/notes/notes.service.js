import { prisma } from "../../db/prisma/client.js";
//give me a projectId, i will load the current saved note; 
export async function getLatestNote(projectId) {
    return prisma.note.findUnique({ where: { projectId } });
} //findUnique means find maximum one result
//Last save wins.
export async function autosaveNote(projectId, userId, contentJson) {
    //if note content is not a JSON object; verify what frontend send to backend 
    if (typeof contentJson !== "object" || contentJson === null || Array.isArray(contentJson)) {
        throw new Error("contentJson must be a JSON object");
    }
    //JSON object ok, now make it executable for Prisma
    const content = contentJson;
    //one statement: update the project's note if it exists, otherwise create it.
    //the database guarantees no second request can slip in between.
    return prisma.note.upsert({
        where: { projectId },
        update: { contentJson: content, updatedBy: userId },
        create: { projectId, contentJson: content, updatedBy: userId },
    });
}
//# sourceMappingURL=notes.service.js.map