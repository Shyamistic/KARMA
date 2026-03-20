import axios from 'axios'
import * as cheerio from 'cheerio'
import { extractCreatorWallet } from './htmx-extractor'
import { 
  addCreator as dbAddCreator, 
  getMonitoredCreators as dbGetMonitoredCreators, 
  saveMetricsSnapshot as dbSaveMetricsSnapshot 
} from '../../lib/db'
import { config } from '../../lib/config'

export interface RumbleCreatorMetrics {
  username: string
  displayName: string
  walletAddress?: string
  subscribers: number
  latestVideoViews: number
  latestVideoTitle: string
  latestVideoUrl: string
  latestVideoAge: string
  viewVelocity: number
  isLive: boolean
  totalVideos: number
  engagementRate: number
  consistencyScore: number
  lastChecked: string
}

export async function fetchCreatorMetrics(
  username: string
): Promise<RumbleCreatorMetrics | null> {
  try {
    const url = `https://rumble.com/c/${username}`
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; KarmaBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      timeout: 30000
    })

    const $ = cheerio.load(response.data)

    const displayName = $('h1.channel-header--title').first().text().trim()
      || $('[class*="channel-name"]').first().text().trim()
      || username

    const subscriberText = $('[class*="subscriber"]').first().text().trim()
    const subscribers = parseCount(subscriberText)

    const firstVideo = $('[class*="video-item"], .videostream, article.video').first()
    const latestVideoTitle = firstVideo.find('[class*="title"], h3, h2').first().text().trim()
    const latestVideoUrl = 'https://rumble.com' + (firstVideo.find('a').first().attr('href') || '')
    const latestVideoAgeText = firstVideo.find('[class*="time"], time, [datetime]').first().text().trim()
    const latestVideoViewsText = firstVideo.find('[class*="views"], [class*="count"]').first().text().trim()
    const latestVideoViews = parseCount(latestVideoViewsText)

    const hoursOld = parseHoursOld(latestVideoAgeText)
    const viewVelocity = hoursOld > 0 ? Math.round(latestVideoViews / hoursOld) : 0

    const isLive = $('[class*="live"], .livestream-badge').length > 0
    const totalVideosText = $('[class*="video-count"]').first().text().trim()
    const totalVideos = parseCount(totalVideosText) || 0

    const recentVideos = $('[class*="video-item"]').length
    const consistencyScore = Math.min(100, recentVideos * 10)

    const likesText = firstVideo.find('[class*="like"], [class*="vote"]').first().text().trim()
    const likes = parseCount(likesText)
    const commentsText = firstVideo.find('[class*="comment"]').first().text().trim()
    const comments = parseCount(commentsText)
    const engagementRate = latestVideoViews > 0
      ? ((likes + comments) / latestVideoViews) * 100
      : 0

    const metrics: RumbleCreatorMetrics = {
      username,
      displayName: displayName || username,
      subscribers,
      latestVideoViews,
      latestVideoTitle,
      latestVideoUrl,
      latestVideoAge: latestVideoAgeText,
      viewVelocity,
      isLive,
      totalVideos,
      engagementRate: parseFloat(engagementRate.toFixed(2)),
      consistencyScore,
      lastChecked: new Date().toISOString()
    }

    // Try to extract native wallet via HTMX to prevent needing claim links
    const walletAddress = await extractCreatorWallet(username) || undefined
    if (walletAddress) {
      metrics.walletAddress = walletAddress
      // Persist the discovered wallet to the registry immediately
      try {
        await dbAddCreator(username, walletAddress)
      } catch (e) {
        console.error(`[Rumble] Failed to save extracted wallet for ${username}`, e)
      }
    }

    return metrics

  } catch (err: any) {
    console.error(`[Rumble] Failed to fetch metrics for @${username}: ${err.message || 'Unknown Error'}`)
    return null
  }
}

export async function getMonitoredCreators(): Promise<string[]> {
  return dbGetMonitoredCreators()
}

export async function addCreator(
  username: string,
  walletAddress?: string
): Promise<void> {
  await dbAddCreator(username, walletAddress)
}

export async function saveMetricsSnapshot(metrics: RumbleCreatorMetrics): Promise<void> {
  await dbSaveMetricsSnapshot(metrics)
}

function parseCount(text: string): number {
  if (!text) return 0
  const clean = text.replace(/[^0-9.KMBkmb]/g, '').trim()
  if (clean.toLowerCase().endsWith('k')) return Math.round(parseFloat(clean) * 1000)
  if (clean.toLowerCase().endsWith('m')) return Math.round(parseFloat(clean) * 1000000)
  if (clean.toLowerCase().endsWith('b')) return Math.round(parseFloat(clean) * 1000000000)
  return parseInt(clean.replace(/,/g, '')) || 0
}

function parseHoursOld(text: string): number {
  if (!text) return 24
  const t = text.toLowerCase()
  if (t.includes('minute')) return 1
  if (t.includes('hour')) {
    const n = parseInt(t.match(/(\d+)/)?.[1] || '1')
    return n
  }
  if (t.includes('day')) {
    const n = parseInt(t.match(/(\d+)/)?.[1] || '1')
    return n * 24
  }
  if (t.includes('week')) return 168
  return 24
}
