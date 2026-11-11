// Owner: Track 3 (Git integration)
// Responsible for: matching incoming webhook payloads to the correct card and driving PR-lifecycle status transitions (In progress → PR pending → Done). TS equivalent of backend/internal/git/eventProcessor.go (Go skeleton, removed).
//
// A card is only ever matched through its git_links row (repo + branch), which the kanban UI creates when a
// branch is linked: nothing is guessed from commit messages or branch names.

import { prisma } from "../../db/prisma/client.js";
import { updateCard, moveCard } from "../kanban/card.service.js";
import { normalizeRepoUrl } from "./branchLink.service.js";
import { notifyProject } from "../notifications/notifications.service.js";

export const CARD_STATUS = {
    todo: "todo",
    inProgress: "In progress",
    prPending: "PR pending",
    done: "Done",
} as const;

export interface Commit {
    id: string;
    message: string;
    author: { name: string; email: string };
}

export interface GitHubPushPayload {
    ref: string;
    deleted?: boolean;
    repository: { html_url: string; full_name: string };
    commits: Commit[];
}

export interface GitHubPullRequestPayload {
    action: 'opened' | 'closed' | 'reopened' | string;
    pull_request: {
        title: string;
        body: string | null;
        html_url?: string;
        merged: boolean;
        head: {
            ref: string; // name of the branch the pull request comes from
        };
        base?: {
            ref: string; // name of the branch the pull request targets
        };
    };
    repository: {
        html_url: string;
        name?: string;
        default_branch?: string;
    };
}

// processPushEvent handles a `push` webhook payload: the first push to a linked branch starts the card.
export async function processPushEvent(payload: GitHubPushPayload): Promise<void> {
    // tags and branch deletions are pushes too, but they say nothing about the work on a card
    if (payload.deleted || !payload.ref?.startsWith('refs/heads/') || !payload.repository?.html_url)
        return;
    const cardId = await matchCardByGitLink(payload.repository.html_url, payload.ref);
    if (!cardId)
        return;
    // a push after the PR was opened must not pull the card back from "PR pending" or "Done"
    await transitionCardStatus(cardId, CARD_STATUS.inProgress, { onlyFrom: [CARD_STATUS.todo] });
}

// the whole project hears about what GitHub did to a card; the change has no acting user, so the message is the
// whole sentence and nobody is left out. `url` (the pull request) is opened in a new tab from the notification.
async function dispatchCardNotification(cardId: string, type: string, message: string, params: Record<string, string>, url?: string): Promise<void> {
    const card = await prisma.card.findUnique({
        where: { id: cardId },
        select: { list: { select: { board: { select: { projectId: true } } } } },
    });
    const projectId = card?.list?.board?.projectId;
    if (!projectId) {
        console.warn(`[Notif] Project not found for card ${cardId}`);
        return;
    }
    await notifyProject({ projectId, actorId: null, type, text: message, key: type, params, entityId: cardId, path: url ?? `/app/${projectId}` });
}

// processPullRequestEvent handles a `pull_request` webhook payload (opened or reopened).
export async function processPullRequestEvent(payload: GitHubPullRequestPayload): Promise<void> {
    const { action, pull_request, repository } = payload;
    if (action !== 'opened' && action !== 'reopened')
        return;
    const cardId = await matchCardByGitLink(repository.html_url, pull_request.head.ref);
    if (!cardId)
        return;
    const moved = await transitionCardStatus(cardId, CARD_STATUS.prPending, { prUrl: pull_request.html_url, prStatus: 'open' });
    if (moved)
        await dispatchCardNotification(cardId, "git_pr_opened", `Pull request ${action === 'reopened' ? 'rouverte' : 'ouverte'} : « ${pull_request.title} ». La carte passe en « ${CARD_STATUS.prPending} »`, { name: pull_request.title, status: CARD_STATUS.prPending, reopened: action === 'reopened' ? "1" : "" }, pull_request.html_url);
}

// processMergeEvent handles a merged pull request: the card is Done once the branch reaches the default branch.
export async function processMergeEvent(payload: GitHubPullRequestPayload): Promise<void> {
    const { action, pull_request, repository } = payload;
    if (action !== 'closed' || pull_request.merged !== true)
        return;
    // merging into another feature branch is not the end of the work
    if (pull_request.base?.ref && repository.default_branch && pull_request.base.ref !== repository.default_branch)
        return;
    const cardId = await matchCardByGitLink(repository.html_url, pull_request.head.ref);
    if (!cardId)
        return;
    const moved = await transitionCardStatus(cardId, CARD_STATUS.done, { prUrl: pull_request.html_url, prStatus: 'merged' });
    if (moved)
        await dispatchCardNotification(cardId, "git_pr_merged", `Pull request fusionnée : « ${pull_request.title} ». La carte passe en « ${CARD_STATUS.done} »`, { name: pull_request.title, status: CARD_STATUS.done }, pull_request.html_url);
}

// processClosedWithoutMergeEvent handles a pull request closed without merging: the work is not done,
// the card goes back to "In progress" until a new PR is opened.
export async function processClosedWithoutMergeEvent(payload: GitHubPullRequestPayload): Promise<void> {
    const { action, pull_request, repository } = payload;
    if (action !== 'closed' || pull_request.merged === true)
        return;
    const cardId = await matchCardByGitLink(repository.html_url, pull_request.head.ref);
    if (!cardId)
        return;
    const moved = await transitionCardStatus(cardId, CARD_STATUS.inProgress, { prStatus: 'closed', onlyFrom: [CARD_STATUS.prPending] });
    if (moved)
        await dispatchCardNotification(cardId, "git_pr_closed", `Pull request fermée sans fusion : « ${pull_request.title} ». La carte repasse en « ${CARD_STATUS.inProgress} »`, { name: pull_request.title, status: CARD_STATUS.inProgress }, pull_request.html_url);
}

// matchCardByGitLink finds the card linked to a given repo+branch, per the git_links table.
export async function matchCardByGitLink(repoUrl: string, branchName: string): Promise<string | null> {
    const cleanBranch = branchName.replace(/^refs\/heads\//, '');
    let targetUrl: string;
    try {
        targetUrl = normalizeRepoUrl(repoUrl);
    } catch {
        return null;
    }
    const link = await prisma.gitLink.findFirst({
        where: { repoUrl: targetUrl, branchName: cleanBranch },
    });
    return link ? link.cardId : null;
}

// transitionCardStatus moves a card to `targetStatus` (and records the PR on its git link), then tells the
// open boards. With `onlyFrom`, the card only moves if it currently has one of those statuses: the check is part
// of the UPDATE itself, so two webhooks arriving together cannot overwrite each other.
// Returns false when nothing moved (card gone, or status not in `onlyFrom`). Database errors propagate, so the
// receiver answers 500 and the event stays unprocessed in webhook_events.
export async function transitionCardStatus(
    cardId: string,
    targetStatus: string,
    options: { prUrl?: string; prStatus?: string; onlyFrom?: string[] } = {},
): Promise<boolean> {
    const moved = await prisma.$transaction(async (tx) => {
        const result = await tx.card.updateMany({
            where: { id: cardId, ...(options.onlyFrom ? { status: { in: options.onlyFrom } } : {}) },
            data: { status: targetStatus, ...(options.prUrl ? { linkedPrUrl: options.prUrl } : {}) },
        });
        if (result.count === 0)
            return false;
        if (options.prStatus)
            await tx.gitLink.updateMany({ where: { cardId }, data: { prStatus: options.prStatus } });
        return true;
    });
    if (moved)
        await moveCardToStatusColumn(cardId, targetStatus);
    // the webhook is not a kanban route, so nothing else broadcasts the change to the open boards
    if (moved)
        await updateCard(cardId, {});
    return moved;
}

// moveCardToStatusColumn puts the card at the top of the board column that matches its new status, when the board
// has one ("Done"/"Terminé" for done, "In progress"/"En cours" otherwise). A board without such a column is left as is.
async function moveCardToStatusColumn(cardId: string, targetStatus: string): Promise<void> {
    const card = await prisma.card.findUnique({
        where: { id: cardId },
        select: { listId: true, list: { select: { boardId: true } } },
    });
    if (!card)
        return;
    const titles = targetStatus === CARD_STATUS.done ? ['terminé', 'done'] : ['en cours', 'in progress'];
    const target = await prisma.list.findFirst({
        where: { boardId: card.list.boardId, title: { in: titles, mode: 'insensitive' } },
    });
    if (target && target.id !== card.listId)
        await moveCard(cardId, target.id, 0);
}
