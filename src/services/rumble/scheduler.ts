import cron from 'node-cron'
import { fetchCreatorMetrics, getMonitoredCreators, saveMetricsSnapshot } from './monitor'
import { evaluateRumbleCreator } from './evaluator'
import { executeRumbleTip } from './tipper'
import { getPrisma } from '../../lib/db'
import { config } from '../../lib/config'

export function startRumbleScheduler(): void {
  // Run every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    await runRumbleCheck()
  })

  // Run immediately on startup
  setTimeout(runRumbleCheck, 5000)

  // Fast loop — every 5 minutes for milestone/viral detection (Claude architecture mapping)
  setInterval(() => {
    runFastEventMonitor().catch(e => console.error('[Scheduler] Event monitor error:', e.message))
  }, 5 * 60 * 1000)

  console.log('[Rumble] Scheduler started — Full Check: 30m | Fast Event Loop: 5m')
}

async function runFastEventMonitor(): Promise<void> {
  const prisma = getPrisma()
  const creators = await prisma.rumbleCreator.findMany({
    where: { active: true },
    include: { metrics: { orderBy: { checkedAt: 'desc' }, take: 2 } }
  })

  for (const creator of creators) {
    try {
      const fresh = await fetchCreatorMetrics(creator.username)
      const prev = creator.metrics[0]
      if (!prev || !fresh) continue

      // Check viral spike (views gained since last check)
      const viewsGained = fresh.latestVideoViews - prev.latestViews
      if (viewsGained >= 5000) {
        console.log(`[EVENT] ${creator.username} viral spike: +${viewsGained} views detected by Fast Loop`)
        
        // Execute dynamic smart evaluation 
        const evaluation: any = {
           sendTip: true,
           amountUsdt: 15.0,
           tier: 'VIRAL',
           totalScore: 92,
           reasoning: `Fast Loop Detection: Viral spike of +${viewsGained} views within the last 5 minutes.`,
           tipType: 'viral'
        }
        await executeRumbleTip(fresh, evaluation)
      }
    } catch (e: any) {
      // ignore
    }
  }
}

async function runRumbleCheck(): Promise<void> {
  const creators = await getMonitoredCreators()

  if (!creators.length) {
    console.log('[Rumble] No creators configured to monitor')
    return
  }

  console.log(`[Rumble] Checking ${creators.length} creators...`)

  for (const username of creators) {
    try {
      // Fetch public metrics
      const metrics = await fetchCreatorMetrics(username)
      if (!metrics) continue

      // Save snapshot for history
      await saveMetricsSnapshot(metrics)

      // Check if already tipped recently (24hr cooldown)
      if (await recentlyTipped(username)) {
        console.log(`[Rumble] @${username} — tipped recently, skipping`)
        continue
      }

      // Agent evaluates creator
      const evaluation = await evaluateRumbleCreator(metrics)

      console.log(`[Rumble] @${username}: score=${evaluation.totalScore}, tier=${evaluation.tier}`)

      // --- MILESTONE LOGIC ---
      await checkMilestones(username, metrics)

      if (!evaluation.sendTip || evaluation.amountUsdt === 0) {
        console.log(`[Rumble] @${username} — no regular tip: ${evaluation.skipReason}`)
        continue
      }

      // Execute tip via WDK
      const result = await executeRumbleTip(metrics, evaluation)

      if (result.success) {
        if (result.txHash) {
          console.log(`[Rumble] ✅ Tipped @${username}: ${evaluation.amountUsdt} USDT (${result.txHash})`)
        } else if (result.claimUrl) {
          console.log(`[Rumble] 🔗 Claim for @${username}: ${result.claimUrl}`)
        }
      }

      // Rate limit: 2 second delay between creators
      await new Promise(r => setTimeout(r, 2000))

    } catch (err) {
      console.error(`[Rumble] Error processing @${username}:`, err)
    }
  }
}

async function checkMilestones(username: string, metrics: any): Promise<void> {
  const prisma = getPrisma()
  
  const milestones = [
    { key: 'VIEWS_100', threshold: 100, field: 'latest_views', reward: 1.0 },
    { key: 'VIEWS_500', threshold: 500, field: 'latest_views', reward: 5.0 },
    { key: 'VIEWS_1000', threshold: 1000, field: 'latest_views', reward: 10.0 },
    { key: 'SUBS_100', threshold: 100, field: 'subscribers', reward: 2.0 },
  ]

  for (const m of milestones) {
    const currentValue = metrics[m.field === 'latest_views' ? 'latestViews' : 'subscribers'] || 0
    
    if (currentValue >= m.threshold) {
      // Check if already rewarded
      const existing = await prisma.rumbleMilestone.findFirst({
        where: { username, milestoneKey: m.key }
      })

      if (!existing) {
        console.log(`[Rumble] 🏆 Milestone Hit! @${username} reached ${m.threshold} ${m.field}`)
        
        // Execute Milestone Tip
        const evaluation: any = {
          sendTip: true,
          amountUsdt: m.reward,
          tier: 'OUTSTANDING',
          scores: { contentQuality: 25, momentum: 25, consistency: 25, communityImpact: 20 },
          totalScore: 95,
          reasoning: `Milestone Achievement: Reached ${m.threshold} ${m.field.replace('_', ' ')} on Rumble. Keep it up!`
        }

        const result = await executeRumbleTip(metrics, evaluation)
        if (result.success) {
          await prisma.rumbleMilestone.create({
            data: { username, milestoneKey: m.key }
          })
          // Also flag the rumble_tip as a milestone tip
          if (result.txHash || result.claimUrl) {
             // Find the latest tip we just created
             const latestTip = await prisma.rumbleTip.findFirst({
               where: { username },
               orderBy: { createdAt: 'desc' }
             })
             if (latestTip) {
               await prisma.rumbleTip.update({
                 where: { id: latestTip.id },
                 data: { tipType: 'milestone' }
               })
             }
          }
        }
      }
    }
  }
}

async function recentlyTipped(username: string): Promise<boolean> {
  const prisma = getPrisma()
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
  
  const count = await prisma.rumbleTip.count({
    where: {
      username,
      tipped: true,
      createdAt: { gte: yesterday }
    }
  })
  
  return count > 0
}
