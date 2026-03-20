"use strict";
/**
 * GitHub Integration
 * Handles webhooks, PR analysis, and posting claim comments
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPrDetails = getPrDetails;
exports.postClaimComment = postClaimComment;
exports.parseWebhookPayload = parseWebhookPayload;
exports.processGithubPR = processGithubPR;
exports.processGithubRepo = processGithubRepo;
const rest_1 = require("@octokit/rest");
const config_1 = require("../../lib/config");
const agent_1 = require("../../core/agent");
const db_1 = require("../../lib/db");
const claims_1 = require("./claims");
const octokit = new rest_1.Octokit({ auth: config_1.config.GITHUB_TOKEN });
async function getPrDetails(owner, repo, prNumber) {
    try {
        // Fetch PR data
        const { data: pr } = await octokit.pulls.get({
            owner, repo, pull_number: prNumber
        });
        // Fetch reviews
        const { data: reviews } = await octokit.pulls.listReviews({
            owner, repo, pull_number: prNumber
        });
        const approvals = reviews.filter((r) => r.state === 'APPROVED').length;
        const rejections = reviews.filter((r) => r.state === 'CHANGES_REQUESTED').length;
        const reviewComments = reviews.length;
        // Fetch repo info
        const { data: repoData } = await octokit.repos.get({ owner, repo });
        // Get contributor's PR history
        const { data: contributorPrs } = await octokit.pulls.list({
            owner, repo,
            state: 'closed',
            per_page: 100
        });
        const contributorPrCount = contributorPrs.filter((p) => p.user?.login === pr.user?.login && p.merged_at).length;
        // Calculate days open
        const created = new Date(pr.created_at);
        const merged = pr.merged_at ? new Date(pr.merged_at) : new Date();
        const daysOpen = Math.max(1, Math.floor((merged.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)));
        // Extract linked issues from PR body
        const linkedIssues = extractLinkedIssues(pr.body || '');
        const username = pr.user?.login || 'unknown';
        const isBot = username.includes('[bot]') ||
            username.endsWith('-bot') ||
            pr.user?.type === 'Bot';
        return {
            prTitle: pr.title,
            prDescription: pr.body || 'No description provided',
            prUrl: pr.html_url,
            linesAdded: pr.additions,
            linesRemoved: pr.deletions,
            filesChanged: pr.changed_files,
            commits: pr.commits,
            reviewApprovals: approvals,
            reviewRejections: rejections,
            reviewComments,
            daysOpen,
            linkedIssues,
            labels: pr.labels.map((l) => typeof l === 'string' ? l : l.name),
            contributor: username,
            contributorPrCount,
            repoStars: repoData.stargazers_count,
            repoName: `${owner}/${repo}`,
            isBot,
        };
    }
    catch (err) {
        console.error('[GitHub] PR details fetch failed:', err);
        return null;
    }
}
async function postClaimComment(params) {
    const tierEmojis = {
        EXCEPTIONAL: '🏆',
        SIGNIFICANT: '⭐',
        SOLID: '✅',
        MINOR: '💡',
    };
    const emoji = tierEmojis[params.tier] || '✅';
    const expiryDate = new Date(params.expiresAt).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric'
    });
    const comment = `## ${emoji} Karma Reward — ${params.amountUsdt} USDT

Hey @${params.contributor}! 👋

Your contribution has been evaluated by **Karma**, an autonomous AI agent that rewards meaningful open source work.

---

**Evaluation:** ${params.reasoning}

**Impact Score:** ${params.score}/100 · Tier: **${params.tier}**

---

### 🎁 Claim Your ${params.amountUsdt} USDT

**[→ Click here to claim your reward](${params.claimUrl})**

Connect any EVM wallet to receive your USDT on Arbitrum. No crypto experience needed.

⏱️ This link expires on **${expiryDate}** (7 days)

---

<sub>Powered by [Karma](https://github.com/Shyamistic/karma-wdk) · Built on [Tether WDK](https://wdk.tether.io) · Gasless transfers via ERC-4337</sub>`;
    try {
        await octokit.issues.createComment({
            owner: params.owner,
            repo: params.repo,
            issue_number: params.prNumber,
            body: comment,
        });
        console.log(`[GitHub] Posted claim comment on PR #${params.prNumber}`);
    }
    catch (err) {
        console.error('[GitHub] Failed to post comment:', err);
    }
}
function parseWebhookPayload(body) {
    try {
        const pr = body.pull_request;
        const repository = body.repository;
        if (!pr || !repository)
            return null;
        return {
            owner: repository.owner.login,
            repo: repository.name,
            prNumber: pr.number,
            contributor: pr.user?.login || 'unknown',
            isMerged: body.action === 'closed' && pr.merged === true,
        };
    }
    catch {
        return null;
    }
}
function extractLinkedIssues(body) {
    const pattern = /(?:closes|fixes|resolves)\s+#(\d+)/gi;
    const matches = [...body.matchAll(pattern)];
    return matches.map((m) => m[1]);
}
async function processGithubPR(owner, repo, prNumber) {
    const profile = await getPrDetails(owner, repo, prNumber);
    if (!profile)
        return;
    const evaluation = await (0, agent_1.evaluateContribution)(profile);
    if (!evaluation.sendTip || evaluation.amountUsdt === 0) {
        await (0, db_1.saveTip)({
            prNumber, prTitle: profile.prTitle, prUrl: profile.prUrl,
            repoName: profile.repoName, contributor: profile.contributor,
            scores: evaluation.scores, totalScore: evaluation.totalScore,
            tier: evaluation.tier, amountUsdt: 0, reasoning: evaluation.reasoning,
            claimToken: ''
        });
        return;
    }
    const claim = await (0, claims_1.createClaim)({
        contributor: profile.contributor, amountUsdt: evaluation.amountUsdt,
        prUrl: profile.prUrl, prTitle: profile.prTitle, repoName: profile.repoName,
        tier: evaluation.tier, reasoning: evaluation.reasoning, totalScore: evaluation.totalScore
    });
    console.log(`[Claims] Created USD₮ claim for @${profile.contributor}: ${evaluation.amountUsdt} USD₮`);
    await (0, db_1.saveTip)({
        prNumber, prTitle: profile.prTitle, prUrl: profile.prUrl,
        repoName: profile.repoName, contributor: profile.contributor,
        scores: evaluation.scores, totalScore: evaluation.totalScore,
        tier: evaluation.tier, amountUsdt: evaluation.amountUsdt,
        reasoning: evaluation.reasoning, claimToken: claim.claimToken
    });
    await postClaimComment({
        owner, repo, prNumber,
        contributor: profile.contributor,
        amountUsdt: evaluation.amountUsdt,
        tier: evaluation.tier, reasoning: evaluation.reasoning,
        score: evaluation.totalScore,
        claimUrl: (0, claims_1.getClaimUrl)(claim.claimToken),
        expiresAt: claim.expiresAt
    });
}
async function processGithubRepo(owner, repo) {
    try {
        const { data: pullRequests } = await octokit.pulls.list({
            owner,
            repo,
            state: 'closed',
            per_page: 1,
            sort: 'updated',
            direction: 'desc'
        });
        const mergedPr = pullRequests.find(pr => pr.merged_at);
        if (!mergedPr) {
            console.warn(`[GitHub] No merged PRs found for ${owner}/${repo}`);
            return;
        }
        console.log(`[GitHub] Found latest merged PR #${mergedPr.number} for ${owner}/${repo}`);
        return processGithubPR(owner, repo, mergedPr.number);
    }
    catch (err) {
        console.error(`[GitHub] Failed to process repo ${owner}/${repo}:`, err);
    }
}
