// Owner: Track 3 (Git integration)
// Responsible for: GitHub calls to create or link a branch to a card, using the OAuth token from Track 1. TS equivalent of backend/internal/git/branchLink.go (Go skeleton, removed); go-github is replaced by Octokit (GitHub)
import type { GitLink } from "@prisma/client";
import { Octokit } from "octokit";
import { prisma} from '../../db/prisma/client.js';
import { getDecryptedAccessToken } from "../auth/oauth.service.js";

//autorise access to github
async function getGitHubToken(userId: string): Promise<string> {
  // the token lives in the oauth_accounts table (encrypted), not on the user row
  const token = await getDecryptedAccessToken(userId);

  if (!token) {
    throw new Error(`GitHub account is not linked for user ${userId}`);
  }

  return token;
}
//to find owner and repo
export function parseRepoUrl(repoUrl: string): { owner: string; repo: string } {
  const cleaned = repoUrl.trim().replace(/\.git$/, "").replace(/^(https?:\/\/github\.com\/|git@github\.com:)/, "");
  const [owner, repo, ...rest] = cleaned.split("/");
  if (!owner || !repo || rest.length > 0 || !/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repo) || /^\.+$/.test(owner) || /^\.+$/.test(repo)) {
    throw new Error(`Invalid GitHub repository URL: ${repoUrl}`);
  }
  return { owner, repo };
}

function handleOctokitError(err: unknown, context?: {repo: string; entity?: string}): never {
  const repoInfo = context?.repo ? ` for repository ${context.repo}` : "";
  const entityInfo = context?.entity ? `'${context.entity}'` : "Resource";
  const status = (err as { status?: number } | null)?.status;
  if (status === 401)
    throw new Error("GitHub token expired or invalid, please re-authenticate");
  if (status === 403)
    throw new Error(`Access denied: insufficient permissions to ${repoInfo}`);
  if (status === 404)
    throw new Error(`Not found: remote entity or repository ${repoInfo} does not exist`);
  if (status === 422)
    throw new Error(`${entityInfo} already exists or request payload is invalid on GitHub`);
  throw new Error("GitHub request failed");
}

// createBranch creates a new branch on the linked repository via the provider's API.
export async function createBranch(userId: string, repoUrl: string, branchName: string): Promise<void> {
  const token = await getGitHubToken(userId);
  const { owner, repo } = parseRepoUrl(repoUrl);
  const octokit = new Octokit({ auth: token });

  // default branch
  try {
    const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
    const defaultBranch = repoData.default_branch;

    // take sha of commit
    const { data: branchData } = await octokit.rest.repos.getBranch({
      owner,
      repo,
      branch: defaultBranch,
    });
    const latestCommitSha = branchData.commit.sha;
  //branch with duplicate protecrion
    await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: latestCommitSha,
    });
  }
  catch (err) {
    handleOctokitError(err, {repo: `${owner}/${repo}`, entity: branchName});
  }
}

// ensureRepoWebhook makes sure the repository sends push / pull_request events to this backend's receiver
// (POST /api/webhooks/git), signed with GIT_WEBHOOK_SECRET. Needs WEBHOOK_PUBLIC_URL, the public https origin of
// the app: without it (local dev, GitHub cannot reach us) nothing is registered and "skipped" is returned.
export async function ensureRepoWebhook(userId: string, repoUrl: string): Promise<"created" | "exists" | "skipped"> {
  const publicUrl = process.env.WEBHOOK_PUBLIC_URL?.trim().replace(/\/+$/, "");
  const secret = process.env.GIT_WEBHOOK_SECRET;
  if (!publicUrl || !secret)
    return "skipped";
  const hookUrl = `${publicUrl}/api/webhooks/git`;
  const token = await getGitHubToken(userId);
  const { owner, repo } = parseRepoUrl(repoUrl);
  const octokit = new Octokit({ auth: token });
  try {
    const hooks = await octokit.paginate(octokit.rest.repos.listWebhooks, { owner, repo, per_page: 100 });
    if (hooks.some((hook) => hook.config?.url === hookUrl))
      return "exists";
    await octokit.rest.repos.createWebhook({
      owner,
      repo,
      events: ["push", "pull_request"],
      config: { url: hookUrl, content_type: "json", secret },
    });
    return "created";
  } catch (err) {
    handleOctokitError(err, { repo: `${owner}/${repo}`, entity: "webhook" });
  }
}

export function normalizeRepoUrl(repoUrl: string) : string{
  const { owner, repo } = parseRepoUrl(repoUrl);
  return `https://github.com/${owner.toLowerCase()}/${repo.toLowerCase()}`;
}
// linkCardToBranch associates a Kanban card with a Git branch, creating the git_links row.
export async function linkCardToBranch(
  cardId: string,
  repoUrl: string,
  branchName: string
): Promise<GitLink> {
  //create or update note in gitLink
  const normalizedUrl = normalizeRepoUrl(repoUrl);
  const [link] = await prisma.$transaction([
    prisma.gitLink.upsert({
    where: { cardId },
    update: { repoUrl: normalizedUrl, branchName, prStatus: 'none' },
    create: { cardId, repoUrl: normalizedUrl, branchName, prStatus: 'none'},
    }),

  // a new branch starts a new lifecycle: forget the previous branch's PR
  prisma.card.update({
    where: { id: cardId },
    data: { linkedBranch: branchName, linkedPrUrl: null },
    }),
  ]);
  return link;
}

// unlinkCardFromBranch removes the git_links row and the branch / PR shown on the card.
export async function unlinkCardFromBranch(cardId: string): Promise<void> {
  await prisma.$transaction([
    prisma.gitLink.deleteMany({ where: { cardId } }),
    prisma.card.update({ where: { id: cardId }, data: { linkedBranch: null, linkedPrUrl: null } }),
  ]);
}

export async function listBranches(userId: string, repoUrl: string): Promise<string[]> {
  const token = await getGitHubToken(userId);
  const { owner, repo } = parseRepoUrl(repoUrl);
  const octokit = new Octokit({ auth: token });
  try{
    const response = await octokit.paginate(octokit.rest.repos.listBranches, {
    owner,
    repo,
    per_page: 100,
  });
  return response.map((b) => b.name);
  }
  catch(err){
    handleOctokitError(err, {repo: `${owner}/${repo}`});
  }
}



