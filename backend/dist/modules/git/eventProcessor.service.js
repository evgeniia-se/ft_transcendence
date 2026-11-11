// Owner: Track 3 (Git integration)
// Responsible for: matching incoming webhook payloads to the correct card and driving PR-lifecycle status transitions (PR pending → Done). TS equivalent of backend/internal/git/eventProcessor.go (Go skeleton, removed).
import { prisma } from "../../db/prisma/client.js";
import { normalizeRepoUrl } from "./branchLink.service.js";
import { createNotification } from "../notifications/notifications.service.js";
//to find card-123
export function extractCardID(text) {
    if (!text)
        return null;
    const match = text.match(/(?:card|task)-(\d+)/i); //i-any registre; \d-any (0-9);+-1 or more number
    if (match && match[1])
        return match[1];
    return null;
}
// processPushEvent handles a `push` webhook payload.
export async function processPushEvent(payload) {
    let cardId = extractCardID(payload.ref);
    if (!cardId && payload.commits) {
        for (const commit of payload.commits) {
            cardId = extractCardID(commit.message);
            if (cardId)
                break;
        }
    }
    if (!cardId && payload.repository?.html_url)
        cardId = await matchCardByGitLink(payload.repository.html_url, payload.ref);
    if (cardId)
        await transitionCardStatus(cardId.toString(), 'In progress');
    /*await logWebhookEvent({
    provider: 'github',
    repo: payload.repository.full_name,
    eventType: 'push',
    payload: payload,
});*/
}
async function dispatchCardNotification(cardId, message, url) {
    try {
        //look the projectId asso with card
        const card = await prisma.card.findUnique({
            where: { id: cardId },
            select: { list: { select: { board: { select: { projectId: true } } } } },
        });
        const projectId = card?.list?.board?.projectId;
        if (!projectId) {
            console.warn(`[Notif] Project not found for card ${cardId}`);
            return;
        }
        //take members
        const members = await prisma.projectMember.findMany({
            where: { projectId },
            select: { userId: true },
        });
        //Send notif to every membres
        await Promise.all(members.map((member) => createNotification(member.userId, "card", { cardId, message, url: url ?? null, })));
    }
    catch (err) {
        console.warn(`[Notif] Failed to dispatch for card ${cardId}:`);
    }
}
// processPullRequestEvent handles a `pull_request` webhook payload (opened).
export async function processPullRequestEvent(payload) {
    // TODO: fire a notification via Track 4's notifications.service.ts once the card moves
    const { action, pull_request, repository } = payload; //desrtcurisation
    if (action !== 'opened' && action !== 'reopened')
        return;
    let cardId = await matchCardByGitLink(repository.html_url, pull_request.head.ref);
    if (cardId) {
        await transitionCardStatus(cardId, 'PR pending', { prUrl: pull_request.html_url, prStatus: 'open' });
        await dispatchCardNotification(cardId, `Pull Request opened: "${pull_request.title}"`, pull_request.html_url);
    }
}
// processMergeEvent handles a merge-to-main webhook payload.
export async function processMergeEvent(payload) {
    const { action, pull_request, repository } = payload; //desrtcurisation
    if (action == 'closed' && pull_request.merged == true) {
        let cardId = await matchCardByGitLink(repository.html_url, pull_request.head.ref);
        if (cardId) {
            await transitionCardStatus(cardId, 'Done', { prUrl: pull_request.html_url, prStatus: 'merged' });
            await dispatchCardNotification(cardId, `Pull Request merged! Card moved to Done.`, pull_request.html_url);
        }
    }
}
// matchCardByGitLink finds the card linked to a given repo+branch, per the git_links table.
export async function matchCardByGitLink(repoUrl, branchName) {
    const cleanBranch = branchName.replace(/^refs\/heads\//, '');
    let targetUrl = repoUrl;
    try {
        targetUrl = normalizeRepoUrl(repoUrl);
    }
    catch (err) {
        return null;
    }
    const link = await prisma.gitLink.findFirst({
        where: { repoUrl: targetUrl, branchName: cleanBranch
        },
    });
    return link ? link.cardId : null;
}
//change in prisma
export async function transitionCardStatus(cardId, targetStatus, extraData) {
    try {
        const operations = [prisma.card.update({
                where: { id: cardId },
                data: { status: targetStatus, ...(extraData?.prUrl ? { linkedPrUrl: extraData.prUrl } : {}),
                }
            })
        ];
        if (extraData?.prStatus) {
            operations.push(prisma.gitLink.updateMany({
                where: { cardId },
                data: { prStatus: extraData.prStatus },
            }));
        }
        await prisma.$transaction(operations);
    }
    catch (err) {
        console.warn(`Failed to transition card ${cardId} to status '${targetStatus}' : ${err?.message || err}`);
    }
}
//# sourceMappingURL=eventProcessor.service.js.map