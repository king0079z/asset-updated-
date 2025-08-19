import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState } from "react"
import { useToast } from "./ui/use-toast"
import { useRouter } from "next/router"

interface RegisterVehicleDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function RegisterVehicleDialog({ open: externalOpen, onOpenChange }: RegisterVehicleDialogProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const router = useRouter()
  const [image, setImage] = useState<File | null>(null)
  
  // Use external state if provided, otherwise use internal state
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = (value: boolean) => {
    if (onOpenChange) {
      onOpenChange(value);
    } else {
      setInternalOpen(value);
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const formData = new FormData(e.currentTarget)
      
      // First, upload the image if it exists
      let imageUrl = null
      if (image) {
        const imageFormData = new FormData()
        imageFormData.append('image', image)
        
        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: imageFormData,
        })
        
        if (!uploadResponse.ok) {
          throw new Error('Failed to upload image')
        }
        
        const uploadData = await uploadResponse.json()
        imageUrl = uploadData.url
      }

      // Then create the vehicle
      const response = await fetch('/api/vehicles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          make: formData.get('make'),
          model: formData.get('model'),
          year: parseInt(formData.get('year') as string),
          licensePlate: formData.get('licensePlate'),
          rentalAmount: parseFloat(formData.get('rentalAmount') as string),
          imageUrl: imageUrl,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create vehicle')
      }

      toast({
        title: "Success",
        description: "Vehicle registered successfully",
      })
      
      setOpen(false)
      window.location.reload()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to register vehicle",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImage(e.target.files[0])
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Only render the button if this component is not being controlled externally */}
      {externalOpen === undefined && (
        <DialogTrigger asChild>
          <Button className="w-full">Register New Vehicle</Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Register New Vehicle</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="make">Make</Label>
            <Input required type="text" id="make" name="make" placeholder="Vehicle make" />
          </div>
          
          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="model">Model</Label>
            <Input required type="text" id="model" name="model" placeholder="Vehicle model" />
          </div>
          
          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="year">Year</Label>
            <Input 
              required 
              type="number" 
              id="year" 
              name="year" 
              placeholder="Vehicle year"
              min="1900"
              max="2025"
            />
          </div>
          
          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="licensePlate">License Plate</Label>
            <Input required type="text" id="licensePlate" name="licensePlate" placeholder="License plate number" />
          </div>
          

          
          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="rentalAmount">Monthly Rental Amount</Label>
            <Input 
              required 
              type="number" 
              id="rentalAmount" 
              name="rentalAmount" 
              placeholder="Monthly rental amount"
              min="0"
              step="0.01"
            />
          </div>

          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="image">Vehicle Image</Label>
            <Input 
              type="file" 
              id="image" 
              name="image" 
              accept="image/*"
              onChange={handleImageChange}
            />
          </div>

          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Registering..." : "Register Vehicle"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}