import { Octokit } from "octokit";
import { prisma } from '../../db/prisma/client.js';
import { getDecryptedAccessToken } from "../auth/oauth.service.js";
//autorise access to github
async function getGitHubToken(userId) {
    // the token lives in the oauth_accounts table (encrypted), not on the user row
    const token = await getDecryptedAccessToken(userId);
    if (!token) {
        throw new Error(`GitHub account is not linked for user ${userId}`);
    }
    return token;
}
//to find owner and repo
export function parseRepoUrl(repoUrl) {
    const cleaned = repoUrl.trim().replace(/\.git$/, "").replace(/^(https?:\/\/github\.com\/|git@github\.com:)/, "");
    const [owner, repo] = cleaned.split("/");
    if (!owner || !repo) {
        throw new Error(`Invalid GitHub repository URL: ${repoUrl}`);
    }
    return { owner, repo };
}
function handleOctokitError(err, context) {
    const repoInfo = context?.repo ? ` for repository ${context.repo}` : "";
    const entityInfo = context?.entity ? `'${context.entity}'` : "Resource";
    if (err?.status === 401)
        throw new Error("GitHub token expired or invalid, please re-authenticate");
    if (err?.status === 403)
        throw new Error(`Access denied: insufficient permissions to ${repoInfo}`);
    if (err?.status === 404)
        throw new Error(`Not found: remote entity or repository ${repoInfo} does not exist`);
    if (err?.status === 422)
        throw new Error(`${entityInfo} already exists or request payload is invalid on GitHub`);
    throw err;
}
// createBranch creates a new branch on the linked repository via the provider's API.
export async function createBranch(userId, repoUrl, branchName) {
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
        handleOctokitError(err, { repo: `${owner}/${repo}`, entity: branchName });
    }
}
export function normalizeRepoUrl(repoUrl) {
    const { owner, repo } = parseRepoUrl(repoUrl);
    return `https://github.com/${owner.toLowerCase()}/${repo.toLowerCase()}`;
}
// linkCardToBranch associates a Kanban card with a Git branch, creating the git_links row.
export async function linkCardToBranch(cardId, repoUrl, branchName) {
    //create or update note in gitLink
    const normalizedUrl = normalizeRepoUrl(repoUrl);
    const [link] = await prisma.$transaction([
        prisma.gitLink.upsert({
            where: { cardId },
            update: { repoUrl: normalizedUrl, branchName },
            create: { cardId, repoUrl, branchName, prStatus: 'none' },
        }),
        // Update card if exist field linkedBranch)
        prisma.card.update({
            where: { id: cardId },
            data: { linkedBranch: branchName },
        }),
    ]);
    return link;
}
export async function listBranches(userId, repoUrl) {
    const token = await getGitHubToken(userId);
    const { owner, repo } = parseRepoUrl(repoUrl);
    const octokit = new Octokit({ auth: token });
    try {
        const response = await octokit.paginate(octokit.rest.repos.listBranches, {
            owner,
            repo,
            per_page: 100,
        });
        return response.map((b) => b.name);
    }
    catch (err) {
        handleOctokitError(err, { repo: `${owner}/${repo}` });
    }
}
//# sourceMappingURL=branchLink.service.js.map