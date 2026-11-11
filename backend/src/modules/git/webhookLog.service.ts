// Owner: Track 3 (Git integration)
// Responsible for: audit logging every webhook event received, so the automation chain is debuggable if a card doesn't move correctly. TS equivalent of backend/internal/git/webhookLog.go (Go skeleton, removed).
import { Prisma, type WebhookEvent } from "@prisma/client";
import { prisma } from '../../db/prisma/client.js';

export interface LogWebhookEvent {
  provider: string;
  repo: string;
  eventType: string;
  payload: unknown;
}

// the audit view lists events without their payload (it can be large): id, type, repo and timing are enough
export type WebhookEventSummary = Pick<WebhookEvent, "id" | "provider" | "repo" | "eventType" | "processedAt" | "createdAt">;

const DEFAULT_EVENTS_LIMIT = 50;
const MAX_EVENTS_LIMIT = 200;

// logWebhookEvent records a received webhook event in webhook_events, regardless of whether processing succeeded.
// processedAt stays null until markWebhookProcessed is called.
export async function logWebhookEvent(input: LogWebhookEvent): Promise<WebhookEvent> {
  return await prisma.webhookEvent.create({
    data: {
      provider: input.provider,
      repo: input.repo,
      eventType: input.eventType,
      payload: (input.payload as Prisma.InputJsonValue) ?? {},
      processedAt: null,
    },
  });
}

// markWebhookProcessed stamps the event once its payload has been handled without error.
export async function markWebhookProcessed(eventId: string): Promise<void> {
  await prisma.webhookEvent.update({
    where: { id: eventId },
    data: { processedAt: new Date() },
  });
}

// listProjectWebhookEvents returns the latest webhook events of the repositories linked to the project's cards,
// newest first, for the project admins' debugging view. webhook_events stores the repo as GitHub's
// "owner/name", git_links as a normalized URL: both are compared case-insensitively.
export async function listProjectWebhookEvents(projectId: string, limit = DEFAULT_EVENTS_LIMIT): Promise<WebhookEventSummary[]> {
  const links = await prisma.gitLink.findMany({
    where: { card: { list: { board: { projectId } } } },
    select: { repoUrl: true },
    distinct: ["repoUrl"],
  });
  const repos = links.map((link) => link.repoUrl.replace(/^https:\/\/github\.com\//, ""));
  if (repos.length === 0)
    return [];
  return prisma.webhookEvent.findMany({
    where: { OR: repos.map((repo) => ({ repo: { equals: repo, mode: "insensitive" as const } })) },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), MAX_EVENTS_LIMIT),
    select: { id: true, provider: true, repo: true, eventType: true, processedAt: true, createdAt: true },
  });
}
