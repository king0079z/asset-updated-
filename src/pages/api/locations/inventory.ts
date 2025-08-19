import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      // Fetch all locations with their inventory
      const locations = await prisma.location.findMany({
        select: {
          id: true,
          name: true,
          type: true,
          inventories: {
            select: {
              id: true,
              quantity: true,
              lastUpdated: true,
              foodSupply: {
                select: {
                  id: true,
                  name: true,
                  category: true,
                  unit: true,
                  pricePerUnit: true,
                  expirationDate: true,
                }
              }
            }
          }
        },
        orderBy: { name: 'asc' },
      })

      // Transform the data to include calculated values
      const locationsWithStats = locations.map(location => {
        const totalItems = location.inventories.length
        const totalValue = location.inventories.reduce((sum, inv) => 
          sum + (inv.quantity * (inv.foodSupply?.pricePerUnit || 0)), 0
        )
        // minStockLevel is not available, so lowStockItems cannot be calculated
        const lowStockItems = 0
        const expiringItems = location.inventories.filter(inv => {
          if (!inv.foodSupply?.expirationDate) return false
          const daysUntilExpiration = Math.ceil(
            (new Date(inv.foodSupply.expirationDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
          )
          return daysUntilExpiration <= 30
        }).length

        return {
          ...location,
          stats: {
            totalItems,
            totalValue,
            lowStockItems,
            expiringItems
          }
        }
      })

      res.status(200).json({ locations: locationsWithStats })
    } catch (error) {
      console.error('Error fetching location inventory:', error)
      res.status(500).json({ error: 'Failed to fetch location inventory', details: (error as Error).message })
    }
  } else {
    res.setHeader('Allow', ['GET'])
    res.status(405).end(`Method ${req.method} Not Allowed`)
  }
}