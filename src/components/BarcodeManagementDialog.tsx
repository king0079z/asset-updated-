import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/components/ui/use-toast'
import { Package, Printer } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'

interface Kitchen {
  id: string
  name: string
}

interface FoodSupply {
  id: string
  name: string
}

interface Barcode {
  id: string
  barcode: string
  kitchen: Kitchen
  foodSupply: FoodSupply
  createdAt: string
}

export function BarcodeManagementDialog() {
  const { toast } = useToast()
  const [kitchens, setKitchens] = useState<Kitchen[]>([])
  const [foodSupplies, setFoodSupplies] = useState<FoodSupply[]>([])
  const [barcodes, setBarcodes] = useState<Barcode[]>([])
  const [selectedKitchen, setSelectedKitchen] = useState<string>('')
  const [selectedFoodSupply, setSelectedFoodSupply] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [selectedBarcodes, setSelectedBarcodes] = useState<string[]>([])
  const [filteredBarcodes, setFilteredBarcodes] = useState<Barcode[]>([])
  const [availableFoodSupplies, setAvailableFoodSupplies] = useState<FoodSupply[]>([])

  useEffect(() => {
    fetchKitchens()
    fetchFoodSupplies()
    fetchBarcodes()
  }, [])

  useEffect(() => {
    if (selectedKitchen) {
      setFilteredBarcodes(barcodes.filter(b => b.kitchen.id === selectedKitchen))
    } else {
      setFilteredBarcodes(barcodes)
    }
  }, [selectedKitchen, barcodes])

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
      setFilteredBarcodes(data)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch barcodes',
        variant: 'destructive',
      })
    }
  }

  const generateBarcode = async () => {
    if (!selectedKitchen) {
      toast({
        title: 'Error',
        description: 'Please select a kitchen',
        variant: 'destructive',
      })
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/kitchens/barcodes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          kitchenId: selectedKitchen,
          foodSupplyId: selectedFoodSupply === 'all' ? null : selectedFoodSupply,
          generateAll: selectedFoodSupply === 'all',
        }),
      })

      if (!response.ok) throw new Error('Failed to generate barcode')

      const newBarcodes = await response.json()
      setBarcodes(prev => [...prev, ...(Array.isArray(newBarcodes) ? newBarcodes : [newBarcodes])])
      toast({
        title: 'Success',
        description: 'Barcode(s) generated successfully',
      })
      
      // Reset selections
      setSelectedFoodSupply('')
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate barcode',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const printBarcodes = (selectedOnly: boolean = false) => {
    const barcodesToPrint = selectedOnly 
      ? filteredBarcodes.filter(b => selectedBarcodes.includes(b.id))
      : filteredBarcodes

    if (barcodesToPrint.length === 0) {
      toast({
        title: 'Error',
        description: 'No barcodes selected for printing',
        variant: 'destructive',
      })
      return
    }

    // For multiple barcodes, we need to create a custom print window
    // Use a unique name to avoid conflicts with other print windows
    const uniqueWindowName = `kitchen_barcodes_${Date.now()}`
    const printWindow = window.open('', uniqueWindowName, 'width=800,height=600')
    
    if (printWindow) {
      // Create the HTML content for the print window
      const printContent = barcodesToPrint.map(barcode => `
        <div style="text-align: center; margin: 20px; padding: 10px; border: 1px solid #ccc; page-break-after: always;">
          <div style="font-size: 14px; margin-bottom: 5px;">
            ${barcode.kitchen.name} - ${barcode.foodSupply.name}
          </div>
          <div style="font-family: monospace; font-size: 16px; margin: 10px 0;">
            ${barcode.barcode}
          </div>
          <svg id="${barcode.id}" style="max-width: 200px;"></svg>
        </div>
      `).join('')

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
              .no-print {
                display: none;
              }
              @media print {
                .no-print {
                  display: none;
                }
              }
            </style>
          </head>
          <body>
            <div class="no-print" style="text-align: center; margin-bottom: 20px;">
              <h1>Kitchen Barcodes</h1>
              <p>Click the button below if printing doesn't start automatically:</p>
              <button onclick="window.print()" style="padding: 10px 20px; background: #4F46E5; color: white; border: none; border-radius: 4px; cursor: pointer;">
                Print Barcodes
              </button>
            </div>
            ${printContent}
            <script>
              // Generate barcodes for each element
              ${barcodesToPrint
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
                // Make sure all barcodes are rendered before printing
                const svgElements = document.querySelectorAll('svg');
                let allRendered = true;
                
                for (let svg of svgElements) {
                  if (!svg.innerHTML) {
                    allRendered = false;
                    break;
                  }
                }
                
                if (allRendered) {
                  setTimeout(() => {
                    window.print();
                    window.onafterprint = () => window.close();
                  }, 1000);
                } else {
                  // If not all rendered, wait a bit longer
                  setTimeout(() => {
                    window.print();
                    window.onafterprint = () => window.close();
                  }, 2000);
                }
              }
            </script>
          </body>
        </html>
      `)
      
      // Close the document to finish writing
      printWindow.document.close();
      
      toast({
        title: 'Success',
        description: 'Barcodes sent to printer',
      });
    } else {
      toast({
        title: 'Error',
        description: 'Failed to open print window. Please check your popup blocker settings.',
        variant: 'destructive',
      });
    }
  }

  const toggleBarcodeSelection = (barcodeId: string) => {
    setSelectedBarcodes(prev => 
      prev.includes(barcodeId)
        ? prev.filter(id => id !== barcodeId)
        : [...prev, barcodeId]
    )
  }

  const toggleAllBarcodes = () => {
    if (selectedBarcodes.length === filteredBarcodes.length) {
      setSelectedBarcodes([])
    } else {
      setSelectedBarcodes(filteredBarcodes.map(b => b.id))
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Package className="mr-2 h-4 w-4" />
          Manage Barcodes
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Kitchen Barcodes Management</DialogTitle>
          <DialogDescription>Generate and manage barcodes that link food supplies to kitchens for quick consumption scanning.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap gap-4">
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
                <SelectItem value="all">All Food Supplies</SelectItem>
                {foodSupplies.map((supply) => (
                  <SelectItem key={supply.id} value={supply.id}>
                    {supply.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={generateBarcode} disabled={isLoading || !selectedKitchen}>
              {isLoading ? 'Generating...' : 'Generate Barcode'}
            </Button>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => printBarcodes(false)} 
                disabled={filteredBarcodes.length === 0}
              >
                <Printer className="mr-2 h-4 w-4" />
                Print All
              </Button>
              <Button 
                variant="outline" 
                onClick={() => printBarcodes(true)} 
                disabled={selectedBarcodes.length === 0}
              >
                <Printer className="mr-2 h-4 w-4" />
                Print Selected
              </Button>
            </div>
          </div>

          <ScrollArea className="h-[400px] rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={selectedBarcodes.length === filteredBarcodes.length && filteredBarcodes.length > 0}
                      onCheckedChange={toggleAllBarcodes}
                    />
                  </TableHead>
                  <TableHead>Kitchen</TableHead>
                  <TableHead>Food Supply</TableHead>
                  <TableHead>Barcode</TableHead>
                  <TableHead>Created At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBarcodes.map((barcode) => (
                  <TableRow key={barcode.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedBarcodes.includes(barcode.id)}
                        onCheckedChange={() => toggleBarcodeSelection(barcode.id)}
                      />
                    </TableCell>
                    <TableCell>{barcode.kitchen.name}</TableCell>
                    <TableCell>{barcode.foodSupply.name}</TableCell>
                    <TableCell className="font-mono">{barcode.barcode}</TableCell>
                    <TableCell>{new Date(barcode.createdAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}