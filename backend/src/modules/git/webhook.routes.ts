// Owner: Track 3 (Git integration)
// Responsible for: the webhook receiver endpoint for push, pull_request, and merge events — the core of the custom "Git/webhook integration" Major module. TS equivalent of backend/internal/git/webhook.go (Go skeleton, removed).
import type { FastifyInstance, FastifyRequest, FastifyReply, FastifyBaseLogger } from 'fastify';
import crypto from 'node:crypto';
import {type LogWebhookEvent, logWebhookEvent, markWebhookProcessed} from './webhookLog.service.js';
import type { WebhookEvent } from '@prisma/client';


import{
	processPushEvent,
	processPullRequestEvent,
	processMergeEvent,
	processClosedWithoutMergeEvent,
	type GitHubPullRequestPayload,
	type GitHubPushPayload
} from './eventProcessor.service.js';

interface GitHubRepo{
	full_name?: string;
}

interface BaseGitHubPayload{
	repository: GitHubRepo;
}
// registerGitWebhookRoutes mounts the webhook receiver, called from app.ts. No JWT auth — HMAC signature verification instead.

	// verifyWebhookSignature validates the provider's HMAC signature header against the configured webhook secret.
export function verifyWebhookSignature(payload: string, signature: string | undefined, secret: string): boolean {
if(!signature)
	return false;
const hmac = crypto.createHmac('sha256', secret); //create object-generator with algo sha-256
const digest = 'sha256=' + hmac.update(payload).digest('hex'); // give string to generator
const sigBuf = Buffer.from(signature); //string t array of bytes for func of secur
const digestBuf = Buffer.from(digest);
if(sigBuf.length !== digestBuf.length)
	return false;
return crypto.timingSafeEqual(sigBuf, digestBuf); //for secure of time we use func which have the same time
}

async function safeLogWebhookEvent(input: LogWebhookEvent, logger?: FastifyBaseLogger) : Promise<WebhookEvent | null>{
	try{
		return await logWebhookEvent(input);
	}
	catch(error){
		if (logger) {
			logger.error({ error, repo: input.repo }, 'Failed to persist webhook audit log');
		} else
			console.error('Failed to persist webhook audit log:', error);

		return null;
	}
}


// registerWebhook registers a webhook on the linked repository for push/pull_request/merge events.
export async function registerGitWebhookRoutes(app: FastifyInstance): Promise<void> { //  app - server
app.post('/webhooks/git', {config: { rawBody: true }}, async (request: FastifyRequest, reply: FastifyReply) => { //if post to address /api/..;
//async func(=>) run with every request; => - replace word "function"

	//secret webhook
	const WEBHOOK_SECRET = process.env.GIT_WEBHOOK_SECRET;
	if(!WEBHOOK_SECRET){
		request.log.error('GIT_WEBHOOK_SECRET is not configured in .env');
		return reply.status(500).send({error : 'Server configuration error'});
	}
	//take hash
	const signature = request.headers['x-hub-signature-256'] as string | undefined;
	const rawBody = request.rawBody?.toString() ?? '';

	if(!verifyWebhookSignature(rawBody, signature, WEBHOOK_SECRET))
		return reply.status(401).send({error: 'Invalid HMAC signature'});

	const githubEvent = request.headers['x-github-event'];// take type of event
	if(typeof githubEvent !== 'string')
		return reply.code(400).send({error: 'Github only'});
	const body = request.body as BaseGitHubPayload; // for parsing full_name
	const repoName = body?.repository?.full_name || 'unknown';

	//log start and save res for id of note of prisma
	const loggedEvent = await safeLogWebhookEvent({
		provider: 'github',
		repo: repoName,
		eventType: githubEvent,
		payload: request.body,
	}, request.log);
	try{
		if(githubEvent === 'push' ){
			await processPushEvent(request.body as GitHubPushPayload);
		}
		else if(githubEvent === 'pull_request'){
			const prPayload = request.body as GitHubPullRequestPayload;
			if(prPayload.action === 'opened' || prPayload.action === 'reopened')
				await processPullRequestEvent(prPayload);
			else if(prPayload.action === 'closed' && prPayload.pull_request.merged)
				await processMergeEvent(prPayload);
			else if(prPayload.action === 'closed')
				await processClosedWithoutMergeEvent(prPayload);
		}
		//check id and mark that carde changed position
		if (loggedEvent && 'id' in loggedEvent) {
			await markWebhookProcessed(String(loggedEvent.id));
		}
		return reply.status(200).send({status: 'ok'});
	}
	catch (error) {
	  //from eventProcessor (par ex db not worked)
	  request.log.error({ error, event: githubEvent }, 'Failed to process webhook payload');

	  // reponse 500, for GitHub can repeat later
	  return reply.status(500).send({ error: 'Internal processing error' });
	}
});

}
