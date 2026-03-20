import axios from 'axios'

export async function extractCreatorWallet(channelSlug: string): Promise<string | null> {
  // Rumble uses HTMX to load wallet info — we hit their internal endpoint
  // Pattern discovered from frontend: /service/User/GetInfo and /service/Rumble/WalletInfo
  
  const endpoints = [
    `https://rumble.com/service/Payments/tip_modal?recipient_username=${channelSlug}`,
    `https://rumble.com/service/Rumble/WalletInfo?username=${channelSlug}`,
    `https://rumble.com/c/${channelSlug}?tipped=1`, 
    `https://rumble.com/user/${channelSlug}?tipped=1`,
    `https://rumble.com/@${channelSlug}?tipped=1`
  ]
  
  for (const url of endpoints) {
    try {
      const res = await axios.get(url, {
        headers: {
          'HX-Request': 'true',
          'HX-Target': 'tip-modal',
          'Accept': 'text/html',
          'Referer': `https://rumble.com/c/${channelSlug}`,
          'User-Agent': 'Mozilla/5.0 (compatible; KarmaBot/1.0)'
        },
        timeout: 10000
      })
      const html = res.data
      
      // Expanded EVM Extraction Patterns
      const match = html.match(/data-wallet[_-]?address=["'](0x[a-fA-F0-9]{40})["']/i)?.[1]
        || html.match(/data-recipient[_-]?address=["'](0x[a-fA-F0-9]{40})["']/i)?.[1]
        || html.match(/wallet[_\-\s'":]+['"]?(0x[a-fA-F0-9]{40})/i)?.[1]
        || html.match(/"address"\s*:\s*"(0x[a-fA-F0-9]{40})"/i)?.[1]
        || html.match(/value=["'](0x[a-fA-F0-9]{40})["']/i)?.[1]
        || html.match(/(0x[a-fA-F0-9]{40})/i)?.[1]
      
      if (match) {
        console.log(`[HTMX] Successfully extracted wallet for ${channelSlug}: ${match}`)
        return match.toLowerCase()
      }
    } catch (err: any) {
      // Ignore network errors or 404s for specific endpoints, just try the next one
    }
  }
  return null
}
