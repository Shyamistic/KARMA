import { Router } from 'express'
import { getTippingPools, createTippingPool, getPrisma } from '../lib/db'
import { z } from 'zod'

const router = Router()

// GET /api/pools
router.get('/', async (req, res) => {
  try {
    const pools = await getTippingPools()
    res.json(pools)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pools' })
  }
})

// POST /api/pools
const CreatePoolSchema = z.object({
  name: z.string().min(3),
  description: z.string().optional(),
  initialUsdt: z.number().optional()
})

router.post('/', async (req, res) => {
  try {
    const data = CreatePoolSchema.parse(req.body)
    const pool = await createTippingPool(data)
    res.json(pool)
  } catch (err) {
    res.status(400).json({ error: 'Invalid pool data' })
  }
})

// POST /api/pools/:id/contribute (Simulated)
router.post('/:id/contribute', async (req, res) => {
  try {
    const { amount } = req.body
    const prisma = getPrisma()
    const pool = await prisma.tippingPool.update({
      where: { id: req.params.id },
      data: { totalUsdt: { increment: amount || 10 } }
    })
    res.json(pool)
  } catch (err) {
    res.status(404).json({ error: 'Pool not found' })
  }
})

export default router
