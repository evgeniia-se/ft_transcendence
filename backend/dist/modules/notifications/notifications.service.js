import { prisma } from "../../db/prisma/client.js";
//create a notification for a user with prisma.notification.create
export async function createNotification(userId, //the notification to whom
notifType, //card, note, file, etc.
payload) {
    if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
        throw new Error("payload must be a JSON object");
    }
    return prisma.notification.create({
        data: {
            userId,
            type: notifType,
            payload: payload
        },
    });
}
//returns all notifications with prisma.notification.findMany
export async function listNotifications(userId) {
    return prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
    });
}
//marks a notification as read, only if it belongs to this user
//returns false if no such notification exists for this user
export async function markNotificationRead(id, userId) {
    const result = await prisma.notification.updateMany({
        where: { id, userId },
        data: { readAt: new Date() },
    });
    return result.count > 0;
}
//# sourceMappingURL=notifications.service.js.map