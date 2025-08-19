import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'

interface Kitchen {
  id: string
  name: string
}

interface FoodSupply {
  id: string
  name: string
  quantity: number
  unit: string
}

interface KitchenBarcode {
  id: string
  barcode: string
  kitchen: Kitchen
  foodSupply: FoodSupply
  createdAt: string
}

export default function BarcodesPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [kitchens, setKitchens] = useState<Kitchen[]>([])
  const [foodSupplies, setFoodSupplies] = useState<FoodSupply[]>([])
  const [barcodes, setBarcodes] = useState<KitchenBarcode[]>([])
  const [selectedKitchen, setSelectedKitchen] = useState<string>('')
  const [selectedFoodSupply, setSelectedFoodSupply] = useState<string>('')

  useEffect(() => {
    fetchKitchens()
    fetchFoodSupplies()
    fetchBarcodes()
  }, [])

  const fetchKitchens = async () => {
    try {
      const response = await fetch('/api/kitchens')
      const data = await response.json()
      setKitchens(data)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch kitchens',
        variant: 'destructive',
      })
    }
  }

  const fetchFoodSupplies = async () => {
    try {
      const response = await fetch('/api/food-supply')
      const data = await response.json()
      setFoodSupplies(data)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch food supplies',
        variant: 'destructive',
      })
    }
  }

  const fetchBarcodes = async () => {
    try {
      const response = await fetch('/api/kitchens/barcodes')
      const data = await response.json()
      setBarcodes(data)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch barcodes',
        variant: 'destructive',
      })
    }
  }

  const generateBarcode = async () => {
    if (!selectedKitchen || !selectedFoodSupply) {
      toast({
        title: 'Error',
        description: 'Please select both kitchen and food supply',
        variant: 'destructive',
      })
      return
    }

    try {
      const response = await fetch('/api/kitchens/barcodes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          kitchenId: selectedKitchen,
          foodSupplyId: selectedFoodSupply,
        }),
      })

      if (!response.ok) throw new Error('Failed to generate barcode')

      const newBarcode = await response.json()
      setBarcodes([...barcodes, newBarcode])
      toast({
        title: 'Success',
        description: 'Barcode generated successfully',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate barcode',
        variant: 'destructive',
      })
    }
  }

  const printBarcodes = () => {
    const printContent = barcodes.map(barcode => `
      <div style="text-align: center; margin: 20px; padding: 10px; border: 1px solid #ccc;">
        <div style="font-size: 14px; margin-bottom: 5px;">
          ${barcode.kitchen.name} - ${barcode.foodSupply.name}
        </div>
        <div style="font-family: monospace; font-size: 16px; margin: 10px 0;">
          ${barcode.barcode}
        </div>
        <svg id="${barcode.id}" style="max-width: 200px;"></svg>
      </div>
    `).join('')

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Kitchen Barcodes</title>
            <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
            <style>
              @media print {
                @page { margin: 0; }
                body { margin: 1cm; }
              }
            </style>
          </head>
          <body>
            ${printContent}
            <script>
              // Generate barcodes for each element
              ${barcodes
                .map(
                  barcode => `
                    JsBarcode("#${barcode.id}", "${barcode.barcode}", {
                      format: "CODE128",
                      width: 2,
                      height: 100,
                      displayValue: true
                    });
                  `
                )
                .join('')}
              // Print and close
              window.onload = () => {
                window.print();
                window.onafterprint = () => window.close();
              }
            </script>
          </body>
        </html>
      `)
    }
  }

  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle>Kitchen Barcodes Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <Select value={selectedKitchen} onValueChange={setSelectedKitchen}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select Kitchen" />
              </SelectTrigger>
              <SelectContent>
                {kitchens.map((kitchen) => (
                  <SelectItem key={kitchen.id} value={kitchen.id}>
                    {kitchen.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedFoodSupply} onValueChange={setSelectedFoodSupply}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select Food Supply" />
              </SelectTrigger>
              <SelectContent>
                {foodSupplies.map((supply) => (
                  <SelectItem key={supply.id} value={supply.id}>
                    {supply.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={generateBarcode}>Generate Barcode</Button>
            <Button variant="outline" onClick={printBarcodes}>Print All Barcodes</Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kitchen</TableHead>
                <TableHead>Food Supply</TableHead>
                <TableHead>Barcode</TableHead>
                <TableHead>Created At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {barcodes.map((barcode) => (
                <TableRow key={barcode.id}>
                  <TableCell>{barcode.kitchen.name}</TableCell>
                  <TableCell>{barcode.foodSupply.name}</TableCell>
                  <TableCell className="font-mono">{barcode.barcode}</TableCell>
                  <TableCell>{new Date(barcode.createdAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}