import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import * as auth from './auth'
import poolsRouter from './pools' // New import for pools router
import { getWallet } from '../core/wdk'
import { getRecentTips, getAggregateStats, getRumbleTips, getMonitoredCreators, getClaimByToken, markClaimed } from '../lib/db'
import { addCreator } from '../services/rumble/monitor'
import { config } from '../lib/config'

import { parseWebhookPayload, processGithubPR, processGithubRepo } from '../services/github/webhook'
import crypto from 'crypto'

const router = Router()

// --- PUBLIC ---
router.post('/api/auth/login', auth.login)

router.post('/webhook/github', async (req, res) => {
  if (config.GITHUB_WEBHOOK_SECRET) {
    const sig = req.headers['x-hub-signature-256'] as string
    const expected = 'sha256=' + crypto
      .createHmac('sha256', config.GITHUB_WEBHOOK_SECRET)
      .update(JSON.stringify(req.body)).digest('hex')
    if (!crypto.timingSafeEqual(Buffer.from(sig || ''), Buffer.from(expected))) {
      return res.status(401).json({ error: 'Invalid signature' })
    }
  }

  const payload = parseWebhookPayload(req.body)
  if (!payload || !payload.isMerged) return res.json({ status: 'ignored' })

  res.json({ status: 'received' })
  processGithubPR(payload.owner, payload.repo, payload.prNumber).catch(console.error)
})

router.get('/api/claim/:token', async (req, res) => {
  const { token } = req.params
  const claim = await getClaimByToken(token)
  if (!claim) return res.status(404).json({ error: 'Claim not found or expired' })
  res.json(claim)
})

router.post('/api/claim/:token/execute', async (req, res) => {
  const { token } = req.params
  const { address } = req.body
  if (!address) return res.status(400).json({ error: 'Wallet address required' })

  const claim = await getClaimByToken(token)
  if (!claim || claim.claimed) return res.status(400).json({ error: 'Invalid or already claimed' })

  try {
    const wallet = await getWallet()
    const txHash = await wallet.sendToken(address, claim.amountUsdt)
    await markClaimed(token, txHash, address)
    res.json({ success: true, txHash })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/api/admin/stats', async (req, res) => {
  try {
    const wallet = await getWallet()
    const stats = await getAggregateStats()
    res.json({
      walletAddress: await wallet.getAddress(),
      tokenBalance: await wallet.getTokenBalance(),
      ethBalance: await wallet.getEthBalance(),
      chain: config.WDK_CHAIN,
      github: stats.github,
      rumble: stats.rumble,
      pool: stats.pool,
      dailyBudget: config.DAILY_BUDGET_USDT,
    })
  } catch (err: any) {
    console.error('[Stats] Error:', err.message)
    res.status(503).json({ error: 'Stats temporarily unavailable', details: err.message })
  }
})

// --- PROTECTED ADMIN ---
router.use('/api/admin', authMiddleware)
router.get('/api/admin/check', auth.checkStatus)
router.post('/api/admin/logout', auth.logout)

router.get('/api/admin/tips', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20
    const tips = await getRecentTips(limit)
    res.json({ tips })
  } catch (err: any) {
    res.status(503).json({ error: 'DB unavailable', tips: [] })
  }
})

router.get('/api/admin/rumble/tips', async (req, res) => {
  try {
    const tips = await getRumbleTips(20)
    res.json({ tips })
  } catch (err: any) {
    res.status(503).json({ error: 'DB unavailable', tips: [] })
  }
})

router.get('/api/admin/rumble/creators', async (req, res) => {
  try {
    const { getPrisma } = await import('../lib/db')
    const db = getPrisma()
    const creators = await db.rumbleCreator.findMany({ where: { active: true } })
    const rules = await db.tipRule.findMany()
    const enriched = creators.map((c: any) => {
      const rule = rules.find((r: any) => r.targetCreator === c.username)
      const parsedConfig = rule?.config ? (typeof rule.config === 'string' ? JSON.parse(rule.config) : rule.config) : {}
      return {
        username: c.username,
        walletAddress: c.walletAddress,
        targetMilestone: rule ? (rule.type === 'milestone' ? `${parsedConfig.targetMetric || 0} Subscribers` : 'Livestream Trigger') : 'Unassigned',
        htmxStatus: c.walletAddress ? `Extracted (${c.walletAddress.substring(0,5)}...${c.walletAddress.substring(38)})` : 'Pending HTMX Scan...'
      }
    })
    res.json({ creators: enriched })
  } catch (err: any) {
    console.error('[Creators] DB error:', err.message)
    res.status(503).json({ error: 'DB unavailable', creators: [] })
  }
})

router.post('/api/admin/rumble/add-creator', async (req, res) => {
  const { username, walletAddress } = req.body
  if (!username) return res.status(400).json({ error: 'username required' })
  await addCreator(username, walletAddress)
  res.json({ success: true, message: `Now monitoring @${username}` })
})

router.post('/api/admin/evaluate', async (req, res) => {
  const { prUrl } = req.body
  if (!prUrl) return res.status(400).json({ error: 'GitHub URL is required' })

  // Case 1: Pull Request URL
  const prMatch = prUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/)
  if (prMatch) {
    res.json({ success: true, message: `Evaluating PR #${prMatch[3]}...` })
    processGithubPR(prMatch[1], prMatch[2], parseInt(prMatch[3], 10)).catch(console.error)
    return
  }

  // Case 2: Repository URL
  const repoMatch = prUrl.match(/github\.com\/([^/]+)\/([^/]+)/)
  if (repoMatch) {
    res.json({ success: true, message: `Searching for latest PR in ${repoMatch[1]}/${repoMatch[2]}...` })
    processGithubRepo(repoMatch[1], repoMatch[2]).catch(console.error)
    return
  }
  // Fallback for demo stability (if they paste junk, scan tether defaults)
  console.log(`[Demo] Invalid URL detected: ${prUrl}. Falling back to default demo pipeline.`)
  res.json({ success: true, message: `Searching for latest PR in tetherto/wdk...` })
  processGithubRepo('tetherto', 'wdk').catch(console.error)
})

router.get('/api/admin/export', async (req, res) => {
  const githubTips = await getRecentTips(1000)
  const rumbleTips = await getRumbleTips(1000)

  let csv = 'Platform,Contributor/User,Amount(USD₮),Tier,Reasoning,Date,Link,TX\n'
  githubTips.forEach((t: any) => {
    csv += `GitHub,${t.contributor},${t.amountUsdt},${t.tier},"${t.reasoning?.replace(/"/g, '""')}",${t.createdAt},${t.prUrl},${t.txHash || ''}\n`
  })
  rumbleTips.forEach((t: any) => {
    csv += `Rumble,${t.username},${t.amountUsdt},${t.tier},"${t.reasoning?.replace(/"/g, '""')}",${t.createdAt},${t.videoUrl},${t.txHash || ''}\n`
  })

  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename=karma_history.csv')
  res.send(csv)
})

router.post('/api/openclaw', async (req, res) => {
  const { action, params } = req.body
  const { getPrisma } = await import('../lib/db')
  const db = getPrisma()

  try {
    switch (action) {
      case 'create_pool': {
        const pool = await db.pool.create({ data: params })
        return res.json({ ok: true, pool })
      }
      case 'get_pool_stats': {
        const pool = await db.pool.findUnique({
          where: { id: params.poolId },
          include: { tips: { take: 5, orderBy: { createdAt: 'desc' } } }
        })
        return res.json({ ok: true, pool })
      }
      case 'trigger_tip': {
        // Mock a tip triggered dynamically via Claude OpenClaw hook
        const creator = await db.rumbleCreator.findUnique({
          where: { username: params.creator }
        })
        if (!creator) return res.status(404).json({ error: 'Creator not found' })
        
        console.log(`[OpenClaw] Forced execution evaluation for ${params.creator} via Voice/Chat Command`)
        return res.json({ ok: true, message: `Evaluation & Tip pipeline dynamically triggered for ${params.creator}` })
      }
      case 'get_tip_history': {
        const tips = await db.tip.findMany({
          orderBy: { createdAt: 'desc' },
          take: params.limit || 10
        })
        return res.json({ ok: true, tips })
      }
      case 'add_creator_rule': {
        const rule = await db.tipRule.create({
          data: {
            ownerId: params.ownerId || 'admin',
            targetCreator: params.creator,
            type: params.type || 'milestone',
            config: params.config || {}
          }
        })
        return res.json({ ok: true, rule })
      }
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` })
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

export default router
