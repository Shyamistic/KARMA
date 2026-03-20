import { v4 as uuidv4 } from 'uuid'
import { 
  getPrisma, 
  createClaimRecord, 
  getClaimByToken as dbGetClaimByToken, 
  markClaimed as dbMarkClaimed 
} from '../../lib/db'
import { getWallet } from '../../core/wdk'
import { config } from '../../lib/config'

export interface Claim {
  id: string
  claimToken: string
  contributor: string
  amountUsdt: number
  prUrl: string
  prTitle: string
  repoName: string
  tier: string
  reasoning: string
  totalScore: number
  createdAt: string
  expiresAt: string
  claimed: boolean
  claimedBy?: string
  txHash?: string
  claimedAt?: string
  platform: string
}

export async function createClaim(params: {
  contributor: string
  amountUsdt: number
  prUrl: string
  prTitle: string
  repoName: string
  tier: string
  reasoning: string
  totalScore: number
  platform?: string
}): Promise<Claim> {
  const claimToken = generateSecureToken()
  const now = new Date()
  const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const claim: Claim = {
    id: uuidv4(),
    claimToken,
    contributor: params.contributor,
    amountUsdt: params.amountUsdt,
    prUrl: params.prUrl,
    prTitle: params.prTitle,
    repoName: params.repoName,
    tier: params.tier,
    reasoning: params.reasoning,
    totalScore: params.totalScore,
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    claimed: false,
    platform: params.platform || 'github'
  }

  await createClaimRecord(claim)

  console.log(`[Claims] Created claim ${claimToken} for @${params.contributor} — ${params.amountUsdt} USDT`)
  return claim
}

export async function getClaimByToken(token: string): Promise<Claim | null> {
  const claim = await dbGetClaimByToken(token)
  return (claim as any) || null
}

export async function redeemClaim(
  token: string,
  walletAddress: string
): Promise<{ success: boolean; txHash?: string; error?: string }> {

  const claim = await getClaimByToken(token)

  if (!claim) {
    return { success: false, error: 'Claim not found' }
  }

  if (claim.claimed) {
    return { success: false, error: 'This reward has already been claimed' }
  }

  const now = new Date()
  if (now > new Date(claim.expiresAt)) {
    return { success: false, error: 'This claim link has expired (7-day limit)' }
  }

  if (!isValidEvmAddress(walletAddress)) {
    return { success: false, error: 'Invalid wallet address' }
  }

  try {
    const wallet = await getWallet()
    const txHash = await wallet.sendToken(walletAddress, claim.amountUsdt)

    await dbMarkClaimed(token, txHash, walletAddress)

    const prisma = getPrisma()
    await prisma.githubTip.updateMany({
      where: { claimToken: token },
      data: { txHash, tipped: true }
    })

    console.log(`[Claims] Redeemed: ${claim.amountUsdt} USDT → ${walletAddress} | tx: ${txHash}`)

    return { success: true, txHash }

  } catch (err: any) {
    console.error('[Claims] Redemption failed:', err)
    return { success: false, error: err.message || 'Transfer failed' }
  }
}

export function getClaimUrl(token: string): string {
  return `${config.BASE_URL}/claim/${token}`
}

function generateSecureToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let token = ''
  for (let i = 0; i < 32; i++) {
    token += chars[Math.floor(Math.random() * chars.length)]
  }
  return token
}

function isValidEvmAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}
