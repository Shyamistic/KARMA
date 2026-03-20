import { z } from 'zod'
import dotenv from 'dotenv'
dotenv.config()

const configSchema = z.object({
  PORT: z.coerce.number().default(3000),
  BASE_URL: z.string().url().default('http://localhost:3000'),
  
  // AI Keys
  GROQ_API_KEY: z.string().min(1),
  GEMINI_API_KEY: z.string().optional(),
  
  // WDK & Wallet
  WDK_SEED_PHRASE: z.string().min(1),
  WDK_CHAIN: z.enum(['ethereum', 'sepolia', 'arbitrum', 'arbitrum_sepolia']).default('sepolia'),
  
  // GitHub
  GITHUB_TOKEN: z.string().min(1),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),
  MONITORED_REPOS: z.string().default('').transform(s => s.split(',').filter(Boolean)),
  
  // Tipping Params
  DAILY_BUDGET_USDT: z.coerce.number().default(100),
  RUMBLE_CHECK_INTERVAL_MINUTES: z.coerce.number().default(30),
  
  // Security
  ADMIN_PASSWORD: z.string().min(6).default('admin123'),
  JWT_SECRET: z.string().min(12).default('karma-oracle-super-secret-key-2026'),
})

export type Config = z.infer<typeof configSchema>

let _config: Config | null = null

try {
  _config = configSchema.parse(process.env)
} catch (err) {
  if (err instanceof z.ZodError) {
    console.error('❌ Invalid environment variables:')
    err.issues.forEach((issue) => {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`)
    })
  } else {
    console.error('❌ Configuration error:', err)
  }
  process.exit(1)
}

export const config = _config!
