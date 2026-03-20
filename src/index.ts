import express from 'express'
import { createServer } from 'http'
import { Server as SocketIO } from 'socket.io'
import cors from 'cors'
import path from 'path'
import cookieParser from 'cookie-parser'
import { config } from './lib/config'
import router from './api/routes'
import authRouter from './routes/auth'
import poolsRouter from './routes/pools'
import { getWallet } from './core/wdk'
import { startRumbleScheduler } from './services/rumble/scheduler'

const app = express()
export const httpServer = createServer(app)
export const io = new SocketIO(httpServer, {
  cors: { 
    origin: "*",
    methods: ["GET", "POST"]
  }
})

io.on('connection', (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`)
  socket.on('disconnect', () => console.log(`[WS] Disconnected: ${socket.id}`))
})

const PORT = Number(process.env.PORT) || 3000;

// Middleware (once each)
app.use(cors({ origin: '*' }))
app.use(express.json())
app.use(cookieParser())

// API Routes (MUST come before static/SPA catch-all)
app.use(router)
app.use('/api/auth', authRouter)
app.use('/api/pools', poolsRouter)

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }))

// Serve React Frontend
const distPath = path.join(process.cwd(), 'frontend/dist')
app.use(express.static(distPath))

// SPA fallback - catches all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

async function bootstrap() {
  // 1. Start Web Server IMMEDIATELY to avoid 502 Bad Gateway
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Karma Web Service LIVE on 0.0.0.0:${PORT}`)
    console.log(`🌐 Public URL: ${process.env.BASE_URL || 'Not Set'}`)
  })

  // 2. Initialize background services asynchronously
  try {
    const wallet = await getWallet()
    const ethBalance = await wallet.getEthBalance()
    const tokenBalance = await wallet.getTokenBalance()
    
    console.log(`[Karma] Oracle Address: ${await wallet.getAddress()}`)
    console.log(`[Karma] Balance: ${tokenBalance} USD₮ | Gas: ${ethBalance} ETH`)

    if (parseFloat(tokenBalance) === 0) {
      console.warn(`[Karma] ⚠️ Warning: 0 USD₮ balance. Funding required!`)
    }

    startRumbleScheduler()
  } catch (err) {
    console.error('⚠️ Background Initialization delayed:', err instanceof Error ? err.message : String(err))
    console.log('Re-attempting background services in 30 seconds...')
    setTimeout(startRumbleScheduler, 30000)
  }
}

bootstrap().catch((err: any) => {
  console.error('⚠️ Critical Bootstrap Warning (Server remains active):', err.message || err)
})
