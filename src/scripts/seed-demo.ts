import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient() as any

async function main() {
  console.log('🌱 Initiating High-Volume Karma Demo Seed...')

  // 1. Wipe existing data for clean slate
  await prisma.githubTip.deleteMany({})
  await prisma.rumbleTip.deleteMany({})
  await prisma.tipRule.deleteMany({})
  await prisma.pool.deleteMany({})
  await prisma.rumbleMetric.deleteMany({})
  await prisma.rumbleMilestone.deleteMany({})
  await prisma.rumbleCreator.deleteMany({})
  await prisma.claim.deleteMany({})
  await prisma.user.deleteMany({ where: { email: 'admin@karma.local' } })
  
  // 2. Create Default Admin User
  const passwordHash = await bcrypt.hash('admin123', 10)
  const admin = await prisma.user.create({
    data: {
      email: 'admin@karma.local',
      passwordHash
    }
  })
  console.log('✅ Created Admin Authentication')

  // 3. Create Massive Liquidity Pools
  const poolsData = [
    { name: 'Rumble Dev Fund', balance: 12500.00 },
    { name: 'Open Source AI Grants', balance: 50000.00 },
    { name: 'Gaming Creators Fund', balance: 8400.00 },
    { name: 'Political & News Ecosystem', balance: 32000.00 },
    { name: 'Emerging Tech Creatives', balance: 1550.00 }
  ]

  for (const p of poolsData) {
    await prisma.pool.create({
      data: {
        name: p.name,
        ownerId: admin.id,
        balanceUsdt: p.balance,
        targetCreator: null,
        isActive: true,
        splitConfig: { creatorShare: 80, ossShare: 20 }
      }
    })
  }
  console.log(`✅ Seeded ${poolsData.length} Liquidity Pools`)

  // 4. Create Creators & Wallet Statuses
  const creators = [
    { username: 'RussellBrand', wallet: '0x1A2b3c4d5E6F7890aBcdEf1234567890abcdef12' },
    { username: 'Asmongold', wallet: '0x9F8e7D6c5b4A3928170abcdEFfedcba098765432' },
    { username: 'GlennGreenwald', wallet: '0x3344556677889900AABBCCDDEEFF112233445566' },
    { username: 'TuckerCarlson', wallet: null }, // Pending HTMX
    { username: 'DailyWire', wallet: '0x00998877665544332211AABBCCDDEEFF11223344' },
    { username: 'StevenCrowder', wallet: null }, // Pending HTMX
    { username: 'MattTaibbi', wallet: '0x11223344556677889900AABBCCDDEEFF11223344' },
    { username: 'xQcOW', wallet: '0x555566667777888899990000AAAABBBBCCCCDDDD' },
    { username: 'MKBHD', wallet: null }, // Pending
    { username: 'LexFridman', wallet: '0xAAAA1111BBBB2222CCCC3333DDDD4444EEEE5555' }
  ]

  for (const c of creators) {
    await prisma.rumbleCreator.create({
      data: { username: c.username, walletAddress: c.wallet, active: true }
    })
  }
  console.log(`✅ Hooked ${creators.length} Creators into Oracle`)

  // 5. Create Tip Rules (Milestone Triggers)
  const rules = [
    { creator: 'RussellBrand', type: 'milestone', target: 3000000 },
    { creator: 'Asmongold', type: 'viral_velocity', target: 50000 }, // views per hour
    { creator: 'TuckerCarlson', type: 'livestream', target: 1 },
    { creator: 'DailyWire', type: 'milestone', target: 2000000 },
    { creator: 'LexFridman', type: 'watch_time', target: 1000000 } // total minutes
  ]

  for (const r of rules) {
    await prisma.tipRule.create({
      data: {
        ownerId: admin.id,
        targetCreator: r.creator,
        type: r.type,
        config: { targetMetric: r.target }
      }
    })
  }
  console.log('✅ Armed AI Milestone Triggers')

  // 6. Generate Massive Tip History (Rumble & GitHub mix)
  console.log('⏳ Injecting Historical Ledger...')
  
  // GitHub Tips
  const ghTips = [
    {
      repo: 'tetherto/wdk', pr: 142, user: 'dev-crypto-ninja', amount: 500.00,
      reasoning: 'Critical cryptographic vulnerability patch in the signature verification module. High impact.',
      txHash: '0xab1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab'
    },
    {
      repo: 'tetherto/wdk', pr: 145, user: 'ui-wizard', amount: 50.00,
      reasoning: 'Minor documentation formatting and typo fixes in the README. Low impact.',
      txHash: '0xcd9876543210fedcba09876543210fedcba09876543210fedcba0987654321'
    },
    {
      repo: 'Tether/wallet-dev-kit', pr: 89, user: 'rust-optimizer', amount: 250.00,
      reasoning: 'Refactored memory allocation in core bindings, improving latency by 14%.',
      txHash: null // Pending Claim
    }
  ]

  for (const gt of ghTips) {
    const claimToken = gt.txHash ? null : `claim_gh_${Math.floor(Math.random() * 999999)}`
    
    await prisma.githubTip.create({
      data: {
        prNumber: gt.pr,
        prTitle: `Update integration logic #${gt.pr}`,
        prUrl: `https://github.com/${gt.repo}/pulls?q=${gt.pr}`,
        repoName: gt.repo,
        contributor: gt.user,
        amountUsdt: gt.amount,
        totalScore: Math.floor(Math.random() * 40 + 60),
        reasoning: gt.reasoning,
        tipped: !!gt.txHash,
        txHash: gt.txHash
      }
    })

    if (!gt.txHash && claimToken) {
      await prisma.claim.create({
        data: {
          claimToken,
          contributor: gt.user,
          amountUsdt: gt.amount,
          prUrl: `https://github.com/${gt.repo}/pulls?q=${gt.pr}`,
          prTitle: `Update integration logic #${gt.pr}`,
          repoName: gt.repo,
          tier: 'GOLD',
          reasoning: gt.reasoning,
          totalScore: 85,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
          claimed: false,
          platform: 'github'
        }
      })
    }
  }

  // Rumble Tips
  const rumbleTipData = [
    {
      user: 'RussellBrand', title: 'The Truth About Financial Systems', amount: 1500.00,
      reasoning: 'Video breached 1M views inside 24 hours. Phenomenal view velocity. Triggered [Viral_Tier_1] reward.',
      type: 'viral', tx: '0x1234abc'
    },
    {
      user: 'Asmongold', title: 'Reacting to the new Tech Layoffs', amount: 250.00,
      reasoning: 'Extremely high engagement rate (8.4%) across a 4 hour broadcast. Triggered [Engagement_Bounty].',
      type: 'watch_time', tx: '0x5678def'
    },
    {
      user: 'TuckerCarlson', title: 'Live from the Studio', amount: 5000.00,
      reasoning: 'Commenced scheduled high-profile livestream. Triggered [Livestream_Commencement_Bounty].',
      type: 'livestream', tx: null // PENDING CLAIM LINK
    },
    {
      user: 'LexFridman', title: 'Interview with AI Pioneer', amount: 800.00,
      reasoning: 'Long-form content retention metrics exceeded 65% past the 1-hour mark. Triggered [Quality_Retention].',
      type: 'watch_time', tx: '0x9999abc'
    },
    {
      user: 'xQcOW', title: 'Reacting to crazy videos', amount: 100.00,
      reasoning: 'Standard hourly watch-time distribution payout. Average engagement.',
      type: 'watch_time', tx: '0x1111def'
    },
    {
      user: 'GlennGreenwald', title: 'System Update 202', amount: 450.00,
      reasoning: 'Consistent upload schedule recognized. Triggered [Consistency_Streak_Reward].',
      type: 'milestone', tx: '0x3333aaa'
    },
    {
      user: 'StevenCrowder', title: 'Change My Mind Live!', amount: 1250.00,
      reasoning: 'Reached 2M concurrent live viewers. Crossed massive internal milestone bracket.',
      type: 'viral', tx: null // PENDING
    }
  ]

  for (const rt of rumbleTipData) {
    const claimToken = rt.tx ? null : `claim_tk_${Math.floor(Math.random() * 999999)}`

    await prisma.rumbleTip.create({
      data: {
        username: rt.user,
        displayName: rt.user,
        videoTitle: rt.title,
        videoUrl: `https://rumble.com/c/${rt.user}`,
        walletAddress: creators.find(c => c.username === rt.user)?.wallet,
        amountUsdt: rt.amount,
        tier: rt.amount > 1000 ? 'PLATINUM' : rt.amount > 500 ? 'GOLD' : 'SILVER',
        totalScore: Math.floor(Math.random() * 20 + 80),
        reasoning: rt.reasoning,
        tipType: rt.type,
        txHash: rt.tx ? rt.tx.padEnd(66, '0') : null, // fake hash
        tipped: !!rt.tx,
        claimToken: claimToken,
        recipientsJson: JSON.stringify([
          { role: 'creator', amount: rt.amount * 0.8 }, 
          { role: 'oss', amount: rt.amount * 0.2 }
        ])
      }
    })

    if (!rt.tx && claimToken) {
      await prisma.claim.create({
        data: {
          claimToken,
          contributor: rt.user,
          amountUsdt: rt.amount,
          prUrl: `https://rumble.com/c/${rt.user}`,
          prTitle: rt.title,
          repoName: `rumble.com/c/${rt.user}`,
          tier: rt.amount > 1000 ? 'PLATINUM' : 'GOLD',
          reasoning: rt.reasoning,
          totalScore: 90,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
          claimed: false,
          platform: 'rumble'
        }
      })
    }
  }
  
  console.log('✅ Generated 10 Rich AI Evaluation Ledgers')
  console.log('🚀 Seed complete! The Dashboard is now fully armed for a world-class demonstration.')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
