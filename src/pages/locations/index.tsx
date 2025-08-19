import React, { useEffect, useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'

type Location = {
  id: string
  name: string | null
  type: string | null
  organizationId: string
  createdAt: string
  updatedAt: string
}

const locationTypeLabel = (type: string | null) => {
  if (!type) return 'Unknown'
  switch (type) {
    case 'CENTRAL_STORE': return 'Central Store'
    case 'CENTRAL_KITCHEN': return 'Central Kitchen'
    case 'KITCHEN': return 'Kitchen'
    default: return type
  }
}

export default function LocationsPage() {
  const [tab, setTab] = useState('locations')
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (tab === 'locations') {
      setLoading(true)
      fetch('/api/locations')
        .then(res => res.json())
        .then(data => setLocations(data.locations || []))
        .finally(() => setLoading(false))
    }
  }, [tab])

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Multi-Location Management</h1>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="locations">Locations</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="transfers">Stock Transfers</TabsTrigger>
          <TabsTrigger value="batches">Production Batches</TabsTrigger>
          <TabsTrigger value="orders">Purchase Orders</TabsTrigger>
        </TabsList>

        <TabsContent value="locations">
          <Card className="mt-6">
            <div className="flex justify-between items-center mb-4 px-4 pt-4">
              <h2 className="text-xl font-semibold">All Locations</h2>
              <Button>Add Location</Button>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5}>Loading...</TableCell>
                    </TableRow>
                  ) : locations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5}>No locations found.</TableCell>
                    </TableRow>
                  ) : (
                    locations.map(loc => (
                      <TableRow key={loc.id}>
                        <TableCell>{loc.name || '-'}</TableCell>
                        <TableCell>{locationTypeLabel(loc.type)}</TableCell>
                        <TableCell>{loc.organizationId}</TableCell>
                        <TableCell>{new Date(loc.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>{new Date(loc.updatedAt).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="inventory">
          <Card className="mt-6 p-6">
            <h2 className="text-xl font-semibold mb-2">Inventory (per Location)</h2>
            <div className="text-gray-500">Coming soon: View and manage inventory for each location.</div>
          </Card>
        </TabsContent>

        <TabsContent value="transfers">
          <Card className="mt-6 p-6">
            <h2 className="text-xl font-semibold mb-2">Stock Transfers</h2>
            <div className="text-gray-500">Coming soon: View and manage stock transfers between locations.</div>
          </Card>
        </TabsContent>

        <TabsContent value="batches">
          <Card className="mt-6 p-6">
            <h2 className="text-xl font-semibold mb-2">Production Batches</h2>
            <div className="text-gray-500">Coming soon: View and manage production batches.</div>
          </Card>
        </TabsContent>

        <TabsContent value="orders">
          <Card className="mt-6 p-6">
            <h2 className="text-xl font-semibold mb-2">Purchase Orders</h2>
            <div className="text-gray-500">Coming soon: View and manage purchase orders.</div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}