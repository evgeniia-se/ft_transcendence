import { prisma } from '../../db/prisma/client.js';
// logWebhookEvent records a received webhook event in webhook_events, regardless of whether processing succeeded.
export async function logWebhookEvent(input) {
    // TODO: prisma.webhookEvent.create with provider, repo, eventType, raw payload, and processedAt left null until processing completes
    //throw new Error("not implemented");
    return await prisma.webhookEvent.create({
        data: {
            provider: input.provider,
            repo: input.repo,
            eventType: input.eventType,
            // В Prisma тип поля Json требует приведения к Prisma.InputJsonValue
            payload: input.payload ?? {},
            processedAt: null,
        },
    });
}
export async function markWebhookProcessed(eventId) {
    await prisma.webhookEvent.update({
        where: { id: eventId },
        data: {
            processedAt: new Date(), // time succes
        },
    });
}
// listWebhookEvents returns the audit log for a repo, for a debugging/admin view.
export async function listWebhookEvents(repoUrl) {
    // TODO: prisma.webhookEvent.findMany({ where: { repo: repoUrl }, orderBy: { createdAt: "desc" } })
    try {
        return await prisma.webhookEvent.findMany({
            where: { repo: repoUrl },
            orderBy: { createdAt: 'desc' },
        });
    }
    catch (error) {
        console.error('Error of base', error);
        return [];
    }
}
//# sourceMappingURL=webhookLog.service.js.map