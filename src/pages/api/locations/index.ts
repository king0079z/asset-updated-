import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const locations = await prisma.location.findMany({
        select: {
          id: true,
          name: true,
          type: true,
          organizationId: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { name: 'asc' },
      })
      res.status(200).json({ locations })
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch locations', details: (error as Error).message })
    }
  } else {
    res.setHeader('Allow', ['GET'])
    res.status(405).end(`Method ${req.method} Not Allowed`)
  }
}