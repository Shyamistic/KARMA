"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateContribution = evaluateContribution;
const groq_sdk_1 = __importDefault(require("groq-sdk"));
const generative_ai_1 = require("@google/generative-ai");
const config_1 = require("./config");
const groq = new groq_sdk_1.default({ apiKey: config_1.config.GROQ_API_KEY });
const genAI = config_1.config.GEMINI_API_KEY ? new generative_ai_1.GoogleGenerativeAI(config_1.config.GEMINI_API_KEY) : null;
const KARMA_SYSTEM_PROMPT = `You are Karma — an autonomous AI agent that evaluates open source contributions and distributes USD₮ rewards based on genuine merit.

You hold a self-custodial WDK wallet with a USD₮ pool. Your mission is to reward developers who make meaningful contributions to the open source community.

## Evaluation Framework

Score the contribution on FOUR dimensions (0-25 each):

1. **Technical Complexity** (0-25)
   - 0-5: Trivial (typo fix, comment update)
   - 6-10: Simple (small bug fix, config change)
   - 11-18: Moderate (feature addition, refactor)
   - 19-25: Complex (architecture change, new system, security fix)

2. **Impact** (0-25)
   - 0-5: Cosmetic or irrelevant
   - 6-10: Minor improvement
   - 11-18: Meaningful improvement for users
   - 19-25: Critical fix, major feature, security improvement

3. **Effort** (0-25)
   - 0-5: Minutes of work
   - 6-10: Hours of work
   - 11-18: Days of work  
   - 19-25: Weeks of sustained work

4. **Community Reception** (0-25)
   - 0-5: Controversial or no engagement
   - 6-10: Accepted but minimal discussion
   - 11-18: Well-reviewed, multiple approvals
   - 19-25: Enthusiastic approval, highly praised

## Tip Tiers

| Score | Tier | Amount |
|-------|------|--------|
| 86-100 | OUTSTANDING | 10.00 USD₮ |
| 71-85 | EXCELLENT | 5.00 USD₮ |
| 51-70 | GOOD | 2.50 USD₮ |
| 31-50 | EMERGING | 1.00 USD₮ |
| 0-30 | NO_TIP | 0 USD₮ |

## Reasoning

Write EXACTLY 2 sentences:
- Sentence 1: What the contribution achieved (specific, concrete)
- Sentence 2: Why it deserves this specific tier (direct justification)

## Guardrails — DO NOT tip if:

- Contributor is a bot (isBot=true)
- Only a typo or whitespace fix with no other value
- Repository has fewer than 5 stars (too obscure)
- PR description is empty and changes are minimal

## Output Format

Respond with ONLY valid JSON. No markdown, no explanation outside the JSON:

{
  "scores": {
    "technicalComplexity": <0-25>,
    "impact": <0-25>,
    "effort": <0-25>,
    "communityReception": <0-25>
  },
  "totalScore": <0-100>,
  "tier": "<OUTSTANDING|EXCELLENT|GOOD|EMERGING|NO_TIP>",
  "amountUsdt": <0.00|1.50|2.50|5.00|10.00>,
  "reasoning": "<2 sentences>",
  "sendTip": <true|false>,
  "skipReason": "<why no tip, or null>"
}`;
/**
 * KARMA AGENT LOOP (OpenClaw Pattern)
 * 1. Context Assembly: Gathering metadata (GitHub/Rumble)
 * 2. Model Inference: Evaluating through Groq/Gemini
 * 3. Tool Execution: Recommending WDK Tipping action
 */
async function evaluateContribution(profile) {
    // --- 1. CONTEXT ASSEMBLY ---
    const context = assembleContext(profile);
    // --- 2. MODEL INFERENCE ---
    const responseText = await runInference(context);
    // --- 3. TOOL EXECUTION (MAPPING) ---
    return mapToToolAction(responseText);
}
function assembleContext(profile) {
    return JSON.stringify({
        platform: 'github',
        contributor: profile.contributor,
        complexity: {
            files: profile.filesChanged,
            lines: profile.linesAdded + profile.linesRemoved,
            commits: profile.commits
        },
        engagement: {
            comments: profile.reviewComments,
            approvals: profile.reviewApprovals
        },
        repo: profile.repoName,
        is_bot: profile.isBot
    }, null, 2);
}
async function runInference(context) {
    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: KARMA_SYSTEM_PROMPT },
                { role: 'user', content: `EVALUATE_CONTEXT: ${context}` }
            ],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.1,
            response_format: { type: 'json_object' }
        });
        return chatCompletion.choices[0]?.message?.content || '';
    }
    catch (err) {
        console.warn('[Agent] Primary Inference failed, trying fallback...');
        if (!genAI)
            throw err;
        const model = genAI.getGenerativeModel({
            model: 'gemini-1.5-flash',
            generationConfig: { responseMimeType: 'application/json' }
        });
        const result = await model.generateContent(`${KARMA_SYSTEM_PROMPT}\n\nEVALUATE_CONTEXT: ${context}`);
        return result.response.text();
    }
}
function mapToToolAction(responseText) {
    try {
        const result = JSON.parse(responseText.trim().replace(/```json|```/g, ''));
        // Force score consistency
        result.totalScore = Object.values(result.scores).reduce((a, b) => a + b, 0);
        // Alignment: Tether USD₮ Reward Mapping
        const tierAmounts = {
            OUTSTANDING: 10.00,
            EXCELLENT: 5.00,
            GOOD: 2.50,
            EMERGING: 1.00,
            NO_TIP: 0.00,
        };
        result.amountUsdt = tierAmounts[result.tier] ?? 0;
        return result;
    }
    catch (err) {
        return {
            scores: { technicalComplexity: 0, impact: 0, effort: 0, communityReception: 0 },
            totalScore: 0, tier: 'NO_TIP', amountUsdt: 0,
            reasoning: 'Inference parsing error.', sendTip: false, skipReason: 'Logic failure'
        };
    }
}
