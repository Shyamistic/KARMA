import { getPrisma } from '../../lib/db'
import { RumbleCreatorMetrics } from './monitor'

export const TRIGGER_EVENTS = {
  subscriber_milestone: [1000, 5000, 10000, 50000, 100000],
  views_spike: { threshold: 2.5, window: '1h' },  // 2.5x normal hourly views
  livestream_started: true,                         // Tip immediately on go-live
  viral_video: { views_1h: 50000 },               // Video hitting 50k in first hour
}

export interface EventTrigger {
  type: 'milestone' | 'viral' | 'livestream'
  reasoning: string
  suggestedTip: number
}

export async function detectEvents(metrics: RumbleCreatorMetrics): Promise<EventTrigger[]> {
  const prisma = getPrisma()
  const events: EventTrigger[] = []

  // 1. Livestream Started Event
  if (metrics.isLive) {
    const recentlyTippedLive = await prisma.rumbleTip.findFirst({
      where: { 
        username: metrics.username, 
        reasoning: { contains: 'Livestream Started' },
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Only once per day
      }
    })
    
    if (!recentlyTippedLive) {
      events.push({
        type: 'livestream',
        reasoning: `Livestream Started Event! Audience engagement is currently rising.`,
        suggestedTip: 5.0
      })
    }
  }

  // 2. Subscriber Milestones
  for (const milestone of TRIGGER_EVENTS.subscriber_milestone) {
    if (metrics.subscribers >= milestone) {
      const msKey = `subscribers_${milestone}`
      const existing = await prisma.rumbleMilestone.findFirst({
        where: { username: metrics.username, milestoneKey: msKey }
      })

      if (!existing) {
        events.push({
          type: 'milestone',
          reasoning: `Subscriber Milestone Reached: ${milestone}!`,
          suggestedTip: 10.0
        })
        // Record it to prevent duplicate triggers
        await prisma.rumbleMilestone.create({
          data: { username: metrics.username, milestoneKey: msKey }
        })
      }
    }
  }

  // 3. Viral Video Detection
  if (metrics.viewVelocity > TRIGGER_EVENTS.viral_video.views_1h) {
    const msKey = `viral_${metrics.latestVideoTitle}`
    const existing = await prisma.rumbleMilestone.findFirst({
      where: { username: metrics.username, milestoneKey: msKey }
    })

    if (!existing) {
      events.push({
        type: 'viral',
        reasoning: `Viral Video Detected! '${metrics.latestVideoTitle}' is seeing massive traffic (${metrics.viewVelocity} views/hr).`,
        suggestedTip: 20.0
      })
      await prisma.rumbleMilestone.create({
        data: { username: metrics.username, milestoneKey: msKey }
      })
    }
  }

  return events
}
