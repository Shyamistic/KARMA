import { Router, Request, Response, NextFunction } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { getPrisma } from '../lib/db'

const router = Router()
const db = getPrisma()

// Secret for JWT (should be in env, fallback for testing)
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-karma-key'

export interface AuthRequest extends Request {
  userId?: string
  token?: string
  tokenExp?: number
}

// Middleware to protect routes
export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const token = authHeader.split(' ')[1]

  // Check if token is revoked
  const revoked = await db.revokedToken.findUnique({ where: { token } })
  if (revoked) {
    return res.status(401).json({ error: 'Token revoked' })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any
    req.userId = decoded.userId
    req.token = token
    req.tokenExp = decoded.exp
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

router.post('/register', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' })

  try {
    const hash = await bcrypt.hash(password, 12)
    const user = await db.user.create({ data: { email, passwordHash: hash } })
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' })
    res.json({ token, user: { id: user.id, email } })
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'Email already exists' })
    res.status(500).json({ error: 'Failed to create user' })
  }
})

router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' })

  const user = await db.user.findUnique({ where: { email } })
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' })
  res.json({ token, user: { id: user.id, email } })
})

router.post('/logout', authenticate, async (req: AuthRequest, res: Response) => {
  if (req.token && req.tokenExp) {
    await db.revokedToken.create({ 
      data: { token: req.token, expiresAt: new Date(req.tokenExp * 1000) } 
    })
  }
  res.json({ ok: true })
})

export default router
