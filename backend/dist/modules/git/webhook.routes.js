import crypto from 'node:crypto';
import { logWebhookEvent, markWebhookProcessed } from './webhookLog.service.js';
import { processPushEvent, processPullRequestEvent, processMergeEvent } from './eventProcessor.service.js';
// registerGitWebhookRoutes mounts the webhook receiver, called from app.ts. No JWT auth — HMAC signature verification instead.
// verifyWebhookSignature validates the provider's HMAC signature header against the configured webhook secret.
export function verifyWebhookSignature(payload, signature, secret) {
    if (!signature)
        return false;
    const hmac = crypto.createHmac('sha256', secret); //create object-generator with algo sha-256
    const digest = 'sha256=' + hmac.update(payload).digest('hex'); // give string to generator
    const sigBuf = Buffer.from(signature); //string t array of bytes for func of secur
    const digestBuf = Buffer.from(digest);
    if (sigBuf.length !== digestBuf.length)
        return false;
    return crypto.timingSafeEqual(sigBuf, digestBuf); //for secure of time we use func which have the same time
}
async function safeLogWebhookEvent(input, logger) {
    try {
        return await logWebhookEvent(input);
    }
    catch (error) {
        if (logger) {
            logger.error({ error, repo: input.repo }, 'Failed to persist webhook audit log');
        }
        else
            console.error('Failed to persist webhook audit log:', error);
        return null;
    }
}
// registerWebhook registers a webhook on the linked repository for push/pull_request/merge events.
export async function registerGitWebhookRoutes(app) {
    app.post('/webhooks/git', { config: { rawBody: true } }, async (request, reply) => {
        //async func(=>) run with every request; => - replace word "function"
        //secret webhook
        const WEBHOOK_SECRET = process.env.GIT_WEBHOOK_SECRET;
        if (!WEBHOOK_SECRET) {
            request.log.error('GIT_WEBHOOK_SECRET is not configured in .env');
            return reply.status(500).send({ error: 'Server configuration error' });
        }
        //take hash
        const signature = request.headers['x-hub-signature-256'];
        const rawBody = request.rawBody || '';
        if (!verifyWebhookSignature(rawBody, signature, WEBHOOK_SECRET))
            return reply.status(401).send({ error: 'Invalid HMAC signature' });
        const githubEvent = request.headers['x-github-event']; // take type of event
        if (typeof githubEvent !== 'string')
            return reply.code(400).send({ error: 'Github only' });
        const body = request.body; // for parsing full_name
        const repoName = body?.repository?.full_name || 'unknown';
        //log start and save res for id of note of prisma
        const loggedEvent = await safeLogWebhookEvent({
            provider: 'github',
            repo: repoName,
            eventType: githubEvent,
            payload: request.body,
        }, request.log);
        try {
            if (githubEvent === 'push') {
                await processPushEvent(request.body);
            }
            else if (githubEvent === 'pull_request') {
                const prPayload = request.body;
                if (prPayload.action === 'opened' || prPayload.action === 'reopened')
                    await processPullRequestEvent(prPayload);
                else if (prPayload.action === 'closed' && prPayload.pull_request.merged)
                    await processMergeEvent(prPayload);
            }
            //check id and mark that carde changed position
            if (loggedEvent && 'id' in loggedEvent) {
                await markWebhookProcessed(String(loggedEvent.id));
            }
            return reply.status(200).send({ status: 'ok' });
        }
        catch (error) {
            //from eventProcessor (par ex db not worked)
            request.log.error({ error, event: githubEvent }, 'Failed to process webhook payload');
            // reponse 500, for GitHub can repeat later
            return reply.status(500).send({ error: 'Internal processing error' });
        }
    });
}
//# sourceMappingURL=webhook.routes.js.map