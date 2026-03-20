import Groq from 'groq-sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { RumbleCreatorMetrics } from './monitor'
import { config } from '../../lib/config'

const groq = new Groq({ apiKey: config.GROQ_API_KEY })
const genAI = config.GEMINI_API_KEY ? new GoogleGenerativeAI(config.GEMINI_API_KEY) : null

export interface RumbleEvaluationResult {
  scores: {
    contentQuality: number
    momentum: number
    consistency: number
    communityImpact: number
  }
  totalScore: number
  tier: 'OUTSTANDING' | 'STRONG' | 'GROWING' | 'EMERGING' | 'NO_TIP'
  amountUsdt: number
  reasoning: string             // Detailed Chain-of-Thought
  recipientsJson?: string       // [NEW] JSON string for splits: {"address": weight}
  sendTip: boolean
  skipReason?: string
}

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

## Smart Splits (NEW Feature)
- If the video title suggests a collaboration (e.g. "feat @Username", "with @Username", "vs @Username"), suggest a Split.
- Set "recipientsJson" to a JSON string: '{"PRIMARY": 0.7, "COLLABORATOR": 0.3}'.
- If no collaborator is found, set "recipientsJson" to null.

## Reasoning (Expanded)
- Provide a 3-4 sentence detailed justification.
- Mention specific metrics (velocity, engagement) and the rationale for the assigned Tier.

## Guardrails — DO NOT tip if:
- Latest video is more than 30 days old (inactive)
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
  "reasoning": "<detailed paragraph>",
  "recipientsJson": "<JSON_STRING_OR_NULL>",
  "sendTip": <true|false>,
  "skipReason": "<why no tip, or null>"
}
`

export async function evaluateRumbleCreator(
  metrics: RumbleCreatorMetrics
): Promise<RumbleEvaluationResult> {
  let responseText = ''

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
    })
    responseText = chatCompletion.choices[0]?.message?.content || ''
  } catch (err) {
    console.warn('[Rumble] Groq failed, trying Gemini fallback...', err)
    
    // 2. Fallback to Gemini
    if (genAI) {
      try {
        const model = genAI.getGenerativeModel({ 
          model: 'gemini-1.5-flash',
          generationConfig: { responseMimeType: 'application/json' }
        })
        const result = await model.generateContent(`${RUMBLE_EVAL_PROMPT}\n\nEvaluate this creator:\n\n${JSON.stringify(metrics, null, 2)}`)
        responseText = result.response.text()
      } catch (geminiErr) {
        console.error('[Rumble] Gemini fallback also failed:', geminiErr)
      }
    }
  }

  try {
    const json = responseText.trim().replace(/```json|```/g, '')
    return JSON.parse(json) as RumbleEvaluationResult
  } catch {
    return {
      scores: { contentQuality: 0, momentum: 0, consistency: 0, communityImpact: 0 },
      totalScore: 0, tier: 'NO_TIP', amountUsdt: 0,
      reasoning: 'Evaluation error.', sendTip: false,
      skipReason: 'Internal error'
    }
  }
}
