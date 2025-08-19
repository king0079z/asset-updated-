import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Building2, Package, AlertTriangle, TrendingDown, Search, ArrowUpDown, MapPin, Warehouse, ChefHat } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

type LocationInventory = {
  id: string
  quantity: number
  minStockLevel: number | null
  maxStockLevel: number | null
  lastUpdated: string
  foodSupply: {
    id: string
    name: string
    category: string
    unit: string
    pricePerUnit: number
    expirationDate: string
  } | null
}

type Location = {
  id: string
  name: string | null
  type: string | null
  locationInventories: LocationInventory[]
  stats: {
    totalItems: number
    totalValue: number
    lowStockItems: number
    expiringItems: number
  }
}

const getLocationTypeIcon = (type: string | null) => {
  switch (type) {
    case 'CENTRAL_STORE': return <Warehouse className="h-5 w-5" />
    case 'CENTRAL_KITCHEN': return <ChefHat className="h-5 w-5" />
    case 'KITCHEN': return <ChefHat className="h-5 w-5" />
    default: return <Building2 className="h-5 w-5" />
  }
}

const getLocationTypeLabel = (type: string | null) => {
  switch (type) {
    case 'CENTRAL_STORE': return 'Central Store'
    case 'CENTRAL_KITCHEN': return 'Central Kitchen'
    case 'KITCHEN': return 'Kitchen'
    default: return 'Unknown'
  }
}

const getLocationTypeColor = (type: string | null) => {
  switch (type) {
    case 'CENTRAL_STORE': return 'from-blue-500 to-blue-600'
    case 'CENTRAL_KITCHEN': return 'from-purple-500 to-purple-600'
    case 'KITCHEN': return 'from-green-500 to-green-600'
    default: return 'from-gray-500 to-gray-600'
  }
}

export function MultiLocationInventoryTab() {
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLocation, setSelectedLocation] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'quantity' | 'value'>('name')
  const { toast } = useToast()

  useEffect(() => {
    loadLocationInventory()
  }, [])

  const loadLocationInventory = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/locations/inventory')
      if (!response.ok) throw new Error('Failed to fetch location inventory')
      const data = await response.json()
      setLocations(data.locations || [])
    } catch (error) {
      console.error('Error loading location inventory:', error)
      toast({
        title: "Error",
        description: "Failed to load location inventory",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const filteredLocations = locations.filter(location => 
    selectedLocation === 'all' || location.id === selectedLocation
  )

  const allInventoryItems = filteredLocations.flatMap(location => 
    location.locationInventories
      .filter(item => 
        item.foodSupply?.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .map(item => ({
        ...item,
        locationName: location.name,
        locationType: location.type,
        locationId: location.id
      }))
  )

  const sortedItems = [...allInventoryItems].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return (a.foodSupply?.name || '').localeCompare(b.foodSupply?.name || '')
      case 'quantity':
        return b.quantity - a.quantity
      case 'value':
        return (b.quantity * (b.foodSupply?.pricePerUnit || 0)) - (a.quantity * (a.foodSupply?.pricePerUnit || 0))
      default:
        return 0
    }
  })

  const totalStats = {
    totalItems: allInventoryItems.length,
    totalValue: allInventoryItems.reduce((sum, item) => 
      sum + (item.quantity * (item.foodSupply?.pricePerUnit || 0)), 0
    ),
    lowStockItems: allInventoryItems.filter(item => 
      item.minStockLevel && item.quantity <= item.minStockLevel
    ).length,
    expiringItems: allInventoryItems.filter(item => {
      if (!item.foodSupply?.expirationDate) return false
      const daysUntilExpiration = Math.ceil(
        (new Date(item.foodSupply.expirationDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      )
      return daysUntilExpiration <= 30
    }).length
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Overview Stats */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-slate-900 dark:via-blue-900/20 dark:to-purple-900/20 rounded-2xl p-6 border border-slate-200 dark:border-slate-700">
        <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-transparent dark:from-white/5"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
              <MapPin className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                Multi-Location Inventory
              </h2>
              <p className="text-slate-600 dark:text-slate-400">Track inventory across all your locations</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-lg p-4 border border-white/20">
              <div className="flex items-center gap-2 mb-2">
                <Package className="h-4 w-4 text-blue-600" />
                <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Total Items</p>
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalStats.totalItems}</p>
            </div>
            <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-lg p-4 border border-white/20">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="h-4 w-4 text-emerald-600" />
                <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Total Value</p>
              </div>
              <p className="text-2xl font-bold text-emerald-600">QAR {totalStats.totalValue.toFixed(0)}</p>
            </div>
            <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-lg p-4 border border-white/20">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Low Stock</p>
              </div>
              <p className="text-2xl font-bold text-amber-600">{totalStats.lowStockItems}</p>
            </div>
            <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-lg p-4 border border-white/20">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Expiring Soon</p>
              </div>
              <p className="text-2xl font-bold text-red-600">{totalStats.expiringItems}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Location Overview Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {locations.map((location) => (
          <Card
            key={location.id}
            className={`relative overflow-hidden bg-gradient-to-br ${getLocationTypeColor(location.type)} text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 cursor-pointer`}
            onClick={() => setSelectedLocation(location.id)}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
            <CardHeader className="relative z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    {getLocationTypeIcon(location.type)}
                  </div>
                  <div>
                    <CardTitle className="text-white">{location.name || 'Unnamed Location'}</CardTitle>
                    <p className="text-white/80 text-sm">{getLocationTypeLabel(location.type)}</p>
                  </div>
                </div>
                <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                  {location.locationInventories.length} items
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-white/80 text-xs">Total Value</p>
                  <p className="text-lg font-bold text-white">QAR {location.stats.totalValue.toFixed(0)}</p>
                </div>
                <div>
                  <p className="text-white/80 text-xs">Low Stock</p>
                  <p className="text-lg font-bold text-white">{location.stats.lowStockItems}</p>
                </div>
              </div>
              <div className="mt-3 h-1 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white/60 rounded-full" style={{ width: '75%' }}></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters and Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Inventory Details</CardTitle>
          <CardDescription>View and manage inventory across all locations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search inventory items..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <Select value={selectedLocation} onValueChange={setSelectedLocation}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name || 'Unnamed Location'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(value: 'name' | 'quantity' | 'value') => setSortBy(value)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="quantity">Quantity</SelectItem>
                <SelectItem value="value">Value</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Inventory Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Unit Price</TableHead>
                  <TableHead>Total Value</TableHead>
                  <TableHead>Stock Level</TableHead>
                  <TableHead>Expiration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-6">
                      <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No inventory items found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedItems.map((item) => {
                    const daysUntilExpiration = item.foodSupply?.expirationDate 
                      ? Math.ceil((new Date(item.foodSupply.expirationDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                      : null
                    const isLowStock = item.minStockLevel && item.quantity <= item.minStockLevel
                    const isExpiringSoon = daysUntilExpiration !== null && daysUntilExpiration <= 30

                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {item.foodSupply?.name || 'Unknown Item'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getLocationTypeIcon(item.locationType)}
                            <span>{item.locationName}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {item.foodSupply?.category || 'Unknown'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{item.quantity} {item.foodSupply?.unit}</span>
                            {isLowStock && (
                              <Badge variant="destructive" className="text-xs">
                                Low Stock
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>QAR {item.foodSupply?.pricePerUnit || 0}</TableCell>
                        <TableCell className="font-medium">
                          QAR {((item.quantity * (item.foodSupply?.pricePerUnit || 0))).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {item.minStockLevel && (
                            <div className="text-xs text-muted-foreground">
                              Min: {item.minStockLevel}
                              {item.maxStockLevel && ` / Max: ${item.maxStockLevel}`}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {item.foodSupply?.expirationDate && (
                            <div className="flex items-center gap-2">
                              <span className="text-sm">
                                {new Date(item.foodSupply.expirationDate).toLocaleDateString()}
                              </span>
                              {isExpiringSoon && (
                                <Badge variant={daysUntilExpiration! <= 7 ? "destructive" : "secondary"} className="text-xs">
                                  {daysUntilExpiration} days
                                </Badge>
                              )}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}