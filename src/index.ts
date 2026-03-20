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
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:5173' }
})

io.on('connection', (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`)
  socket.on('disconnect', () => console.log(`[WS] Disconnected: ${socket.id}`))
})

const PORT = config.PORT || 3000

// Middleware
app.use(cors())
app.use(express.json())
app.use(cookieParser())
app.use(express.json())
app.use(cors())

// Serve React Frontend
const distPath = path.join(process.cwd(), 'frontend/dist')
app.use(express.static(distPath))

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/webhook')) {
    return next()
  }
  res.sendFile(path.join(distPath, 'index.html'))
})

// API Routes
app.use(router)
app.use('/api/auth', authRouter)
app.use('/api/pools', poolsRouter)

// Fallback for SPA (if claim or dashboard routes are handled by client)
app.get('/claim/:token', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/claim.html'))
})

async function bootstrap() {
  const wallet = await getWallet()
  const ethBalance = await wallet.getEthBalance()
  const tokenBalance = await wallet.getTokenBalance()
  
  console.log(`[Karma] Oracle Address: ${await wallet.getAddress()}`)
  console.log(`[Karma] Balance: ${tokenBalance} USD₮ | Gas: ${ethBalance} ETH`)

  if (parseFloat(tokenBalance) === 0) {
    console.warn(`[Karma] ⚠️ Warning: 0 USD₮ balance. Funding required!`)
  }

  // Start background services
  startRumbleScheduler()

  httpServer.listen(PORT, async () => {
  console.log(`✅ Karma Oracle v3.0 (${process.env.NODE_ENV || 'Production'}) running on port ${PORT}`)
  console.log(`🔗 Dashboard: http://localhost:${PORT}`)
  })
}

bootstrap().catch(err => {
  console.error('💥 Core system failure:', err)
  process.exit(1)
})
