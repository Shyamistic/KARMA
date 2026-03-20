import { getWallet } from '../../core/wdk'
import { getPrisma, saveRumbleTip, createClaimRecord } from '../../lib/db'
import { RumbleCreatorMetrics } from './monitor'
import { RumbleEvaluationResult } from './evaluator'
import { config } from '../../lib/config'
import { v4 as uuidv4 } from 'uuid'

export interface RumbleTipResult {
  success: boolean
  txHash?: string
  claimToken?: string
  claimUrl?: string
  error?: string
}

export async function executeRumbleTip(
  creator: RumbleCreatorMetrics,
  evaluation: RumbleEvaluationResult
): Promise<RumbleTipResult> {
  const prisma = getPrisma()

  // Get creator's wallet address from registry
  const creatorData = await prisma.rumbleCreator.findUnique({
    where: { username: creator.username },
    select: { walletAddress: true }
  })

  const walletAddress = creatorData?.walletAddress

  if (walletAddress) {
    // Direct tip — creator has a wallet address registered
    try {
       const wallet = await getWallet()
      const txHash = await wallet.sendToken(walletAddress, evaluation.amountUsdt)

      // Log the tip
      await saveRumbleTip({
        username: creator.username,
        displayName: creator.displayName,
        videoTitle: creator.latestVideoTitle,
        videoUrl: creator.latestVideoUrl,
        walletAddress,
        amountUsdt: evaluation.amountUsdt,
        tier: evaluation.tier,
        totalScore: evaluation.totalScore,
        reasoning: evaluation.reasoning,
        txHash,
        tipped: true,
        tipType: 'direct'
      })

      console.log(`[Karma] Tipped @${creator.username}: ${evaluation.amountUsdt} USD₮ → ${walletAddress} (${txHash})`)
      return { success: true, txHash }

    } catch (err: any) {
      return { success: false, error: err.message }
    }
  } else {
    // No wallet — create claimable link
    const claimToken = generateToken()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    // Create claim record
    await createClaimRecord({
      id: uuidv4(),
      claimToken,
      contributor: creator.username,
      amountUsdt: evaluation.amountUsdt,
      prUrl: creator.latestVideoUrl,
      prTitle: creator.latestVideoTitle,
      repoName: `rumble.com/c/${creator.username}`,
      tier: evaluation.tier,
      reasoning: evaluation.reasoning,
      totalScore: evaluation.totalScore,
      createdAt: now.toISOString(),
      expiresAt: expiresAt,
      claimed: false,
      platform: 'rumble'
    })

    // Log the tip as claimable
    await saveRumbleTip({
      username: creator.username,
      displayName: creator.displayName,
      videoTitle: creator.latestVideoTitle,
      videoUrl: creator.latestVideoUrl,
      amountUsdt: evaluation.amountUsdt,
      tier: evaluation.tier,
      totalScore: evaluation.totalScore,
      reasoning: evaluation.reasoning,
      claimToken,
      tipped: false,
      tipType: 'claimable'
    })

    const claimUrl = `${config.BASE_URL}/claim/${claimToken}`
    console.log(`[Karma] Claim created for @${creator.username}: ${claimUrl}`)

    return { success: true, claimToken, claimUrl }
  }
}

function generateToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}
