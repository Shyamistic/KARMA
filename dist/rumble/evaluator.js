"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateRumbleCreator = evaluateRumbleCreator;
const groq_sdk_1 = __importDefault(require("groq-sdk"));
const generative_ai_1 = require("@google/generative-ai");
const config_1 = require("../config");
const groq = new groq_sdk_1.default({ apiKey: config_1.config.GROQ_API_KEY });
const genAI = config_1.config.GEMINI_API_KEY ? new generative_ai_1.GoogleGenerativeAI(config_1.config.GEMINI_API_KEY) : null;
const RUMBLE_EVAL_PROMPT = `You are Karma — an autonomous AI agent that rewards genuine content creators on Rumble with USD₮ tips.

Rumble is a video platform with 68 million monthly users where creators earn through viewer tips.
Your job is to evaluate whether a creator deserves an autonomous tip based on merit signals.

## Scoring Dimensions (0-25 each)

1. **Content Quality** — Measured by engagement rate (likes+comments/views)
   - 0-5: Very low engagement (<0.1%)
   - 6-12: Average engagement (0.1-0.5%)
   - 13-20: Good engagement (0.5-2%)
   - 21-25: Excellent engagement (>2%)

2. **Momentum** — View velocity (views per hour on latest content)
   - 0-5: Stagnant (<10 views/hr)
   - 6-12: Steady (10-100 views/hr)
   - 13-20: Growing (100-1000 views/hr)
   - 21-25: Viral (>1000 views/hr)

3. **Consistency** — Regular posting discipline
   - Based on consistency_score (0-100) in the data
   - Divide by 4 to get this dimension score

4. **Community Impact** — Audience size + community depth
   - 0-5: <1K subscribers
   - 6-12: 1K-10K subscribers
   - 13-20: 10K-100K subscribers
   - 21-25: >100K subscribers

## Tip Tiers

| Score | Tier | Amount |
|-------|------|--------|
| 86-100 | OUTSTANDING | 10.00 USD₮ |
| 71-85 | STRONG | 5.00 USD₮ |
| 51-70 | GROWING | 2.00 USD₮ |
| 31-50 | EMERGING | 1.00 USD₮ |
| 0-30 | NO_TIP | 0 USD₮ |

## Reasoning: EXACTLY 2 sentences
- Sentence 1: What makes this creator's performance noteworthy right now
- Sentence 2: Why they deserve this specific reward tier

## Guardrails — DO NOT tip if:
- Creator has fewer than 0 subscribers (disabled for demo)
- Latest video is more than 7 days old (inactive)
- Engagement rate is 0% (likely spam/dead channel)
- Already tipped this creator in the last 24 hours

## Output — ONLY valid JSON:
{
  "scores": {
    "contentQuality": <0-25>,
    "momentum": <0-25>,
    "consistency": <0-25>,
    "communityImpact": <0-25>
  },
  "totalScore": <0-100>,
  "tier": "<OUTSTANDING|STRONG|GROWING|EMERGING|NO_TIP>",
  "amountUsdt": <0.00|1.00|2.00|5.00|10.00>,
  "reasoning": "<exactly 2 sentences>",
  "sendTip": <true|false>,
  "skipReason": "<why no tip, or null>"
}
`;
async function evaluateRumbleCreator(metrics) {
    let responseText = '';
    // 1. Try Groq (Primary)
    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: RUMBLE_EVAL_PROMPT },
                { role: 'user', content: `Evaluate this Rumble creator:\n\n${JSON.stringify(metrics, null, 2)}` }
            ],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.1,
            response_format: { type: 'json_object' }
        });
        responseText = chatCompletion.choices[0]?.message?.content || '';
    }
    catch (err) {
        console.warn('[Rumble] Groq failed, trying Gemini fallback...', err);
        // 2. Fallback to Gemini
        if (genAI) {
            try {
                const model = genAI.getGenerativeModel({
                    model: 'gemini-1.5-flash',
                    generationConfig: { responseMimeType: 'application/json' }
                });
                const result = await model.generateContent(`${RUMBLE_EVAL_PROMPT}\n\nEvaluate this creator:\n\n${JSON.stringify(metrics, null, 2)}`);
                responseText = result.response.text();
            }
            catch (geminiErr) {
                console.error('[Rumble] Gemini fallback also failed:', geminiErr);
            }
        }
    }
    try {
        const json = responseText.trim().replace(/```json|```/g, '');
        return JSON.parse(json);
    }
    catch {
        return {
            scores: { contentQuality: 0, momentum: 0, consistency: 0, communityImpact: 0 },
            totalScore: 0, tier: 'NO_TIP', amountUsdt: 0,
            reasoning: 'Evaluation error.', sendTip: false,
            skipReason: 'Internal error'
        };
    }
}
