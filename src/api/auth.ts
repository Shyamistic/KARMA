import { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../lib/config'

export async function login(req: Request, res: Response) {
  const { password } = req.body

  if (password === config.ADMIN_PASSWORD) {
    const token = jwt.sign({ admin: true }, config.JWT_SECRET, { expiresIn: '24h' })
    
    // Set cookie for browser-based dashboard
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    })

    return res.json({ success: true, token })
  }

  return res.status(401).json({ error: 'Invalid password' })
}

export function logout(req: Request, res: Response) {
  res.clearCookie('auth_token')
  res.json({ success: true })
}

export function checkStatus(req: any, res: Response) {
  res.json({ authenticated: true, admin: req.admin })
}
