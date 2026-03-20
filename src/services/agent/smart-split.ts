import { getWallet } from '../../core/wdk'

export async function executeSplit(pool: any, tip: any) {
  const config = pool.splitConfig || { creator: 1.0 }
  const creatorAmount = tip.amountUsdt * (config.creator || 1.0)
  
  const wallet = await getWallet()
  
  console.log(`[SmartSplit] Executing tip of ${tip.amountUsdt} from Pool ${pool.id}`)

  // Primary: send to Rumble creator wallet
  if (tip.creatorWallet) {
    console.log(`[SmartSplit] Sending ${creatorAmount} USDT to creator ${tip.creatorWallet}`)
    await wallet.sendToken(tip.creatorWallet, creatorAmount)
  }
  
  // Optional: if pool has GitHub integration, split remainder to OSS contributors
  if (config.contributors && pool.githubRepo) {
    console.log(`[SmartSplit] OSS splitting not fully implemented yet for ${pool.githubRepo}`)
    // const contribs = await getTopContributors(pool.githubRepo);
    // for (const c of contribs) {
    //   if (c.walletAddress) await wallet.sendToken(c.walletAddress, perContrib);
    // }
  }

  // Broadcast the Tip to all connected Dashboards instantly
  try {
    const { io } = require('../../index')
    if (io) {
      io.emit('tip_fired', {
        id: tip.id,
        creator: tip.username || tip.creatorSlug || 'Unknown',
        amount: tip.amountUsdt,
        triggerType: tip.tipType || tip.triggerType || 'smart_split',
        txHash: tip.txHash,
        timestamp: new Date().toISOString()
      })
      console.log(`[WS] Emitted tip_fired event for ${tip.username}`)
    }
  } catch (e: any) {
    console.error(`[WS] Failed to broadcast event: ${e.message}`)
  }
}
