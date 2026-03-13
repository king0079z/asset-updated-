import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { AlertCircle, CheckCircle2, Wrench, XCircle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Vehicle {
  id: string;
  name: string;
  status: 'AVAILABLE' | 'RENTED' | 'MAINTENANCE' | 'RETIRED';
  [key: string]: any;
}

interface EditVehicleStatusDialogProps {
  vehicle: Vehicle | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusUpdated: () => void;
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'AVAILABLE':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'RENTED':
      return <AlertCircle className="h-4 w-4 text-blue-500" />;
    case 'MAINTENANCE':
      return <Wrench className="h-4 w-4 text-yellow-500" />;
    case 'RETIRED':
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return null;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'AVAILABLE':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    case 'RENTED':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    case 'MAINTENANCE':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    case 'RETIRED':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  }
};

import { useRef } from "react";

export function EditVehicleStatusDialog({ vehicle, open, onOpenChange, onStatusUpdated }: EditVehicleStatusDialogProps) {
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [maintenanceCost, setMaintenanceCost] = useState('');
  const [maintenanceReceipt, setMaintenanceReceipt] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [maintenanceError, setMaintenanceError] = useState<string | null>(null);
  const { toast } = useToast();

  // Reset selected status when dialog opens
  const handleOpenChange = (open: boolean) => {
    if (open && vehicle) {
      setSelectedStatus(vehicle.status);
    }
    onOpenChange(open);
  };

  const handleSubmit = async () => {
    if (!vehicle || !selectedStatus) return;

    // If changing from MAINTENANCE to AVAILABLE, validate and send maintenanceCost and maintenanceReceipt
    if (vehicle.status === "MAINTENANCE" && selectedStatus === "AVAILABLE") {
      setMaintenanceError(null);

      // Validate maintenanceCost
      if (!maintenanceCost || isNaN(Number(maintenanceCost)) || Number(maintenanceCost) < 0) {
        setMaintenanceError("Maintenance cost is required and must be a valid number.");
        return;
      }
      // Validate maintenanceReceipt
      if (!maintenanceReceipt) {
        setMaintenanceError("Maintenance receipt is required.");
        return;
      }

      try {
        setIsSubmitting(true);

        // Upload the receipt file
        let receiptUrl = "";
        const formData = new FormData();
        formData.append("file", maintenanceReceipt);

        const uploadRes = await fetch("/api/upload-document", {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) {
          setMaintenanceError("Failed to upload maintenance receipt.");
          setIsSubmitting(false);
          return;
        }

        const uploadData = await uploadRes.json();
        receiptUrl = uploadData.url || uploadData.path || "";

        if (!receiptUrl) {
          setMaintenanceError("Failed to get uploaded receipt URL.");
          setIsSubmitting(false);
          return;
        }

        // Send status update with maintenanceCost and maintenanceReceipt
        const response = await fetch(`/api/vehicles/${vehicle.id}/update-status`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: selectedStatus,
            maintenanceCost: Number(maintenanceCost),
            maintenanceReceipt: receiptUrl,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Failed to update vehicle status');
        }

        toast({
          title: "Status Updated",
          description: data.message || "Vehicle status has been updated successfully",
        });

        onOpenChange(false);
        onStatusUpdated();
      } catch (error) {
        console.error('Error updating vehicle status:', error);
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to update vehicle status",
          variant: "destructive",
        });
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Default: just update status
    try {
      setIsSubmitting(true);
      const response = await fetch(`/api/vehicles/${vehicle.id}/update-status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: selectedStatus }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update vehicle status');
      }

      toast({
        title: "Status Updated",
        description: data.message || "Vehicle status has been updated successfully",
      });

      onOpenChange(false);
      onStatusUpdated();
    } catch (error) {
      console.error('Error updating vehicle status:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update vehicle status",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!vehicle) return null;

  const showCancelWarning = vehicle.status === 'RENTED' && selectedStatus !== 'RENTED';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Vehicle Status</DialogTitle>
          <DialogDescription>
            Update the status of {vehicle.name}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="mb-4">
            <p className="text-sm text-muted-foreground mb-2">Current Status:</p>
            <Badge className={getStatusColor(vehicle.status)}>
              <span className="flex items-center gap-1">
                {getStatusIcon(vehicle.status)}
                {vehicle.status}
              </span>
            </Badge>
          </div>

          <RadioGroup value={selectedStatus} onValueChange={setSelectedStatus} className="space-y-3">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="AVAILABLE" id="available" />
              <Label htmlFor="available" className="flex items-center gap-2 cursor-pointer">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Available
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="RENTED" id="rented" />
              <Label htmlFor="rented" className="flex items-center gap-2 cursor-pointer">
                <AlertCircle className="h-4 w-4 text-blue-500" />
                Rented
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="MAINTENANCE" id="maintenance" />
              <Label htmlFor="maintenance" className="flex items-center gap-2 cursor-pointer">
                <Wrench className="h-4 w-4 text-yellow-500" />
                In Maintenance
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="RETIRED" id="retired" />
              <Label htmlFor="retired" className="flex items-center gap-2 cursor-pointer">
                <XCircle className="h-4 w-4 text-red-500" />
                Retired
              </Label>
            </div>
          </RadioGroup>

          {/* Show maintenance fields if changing from MAINTENANCE to AVAILABLE */}
          {vehicle.status === "MAINTENANCE" && selectedStatus === "AVAILABLE" && (
            <div className="mb-4 space-y-3">
              <div>
                <Label htmlFor="maintenanceCost" className="block mb-1">
                  Maintenance Cost <span className="text-red-500">*</span>
                </Label>
                <input
                  id="maintenanceCost"
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full border rounded px-3 py-2"
                  value={maintenanceCost}
                  onChange={e => setMaintenanceCost(e.target.value)}
                  placeholder="Enter maintenance cost"
                  required
                />
              </div>
              <div>
                <Label htmlFor="maintenanceReceipt" className="block mb-1">
                  Maintenance Receipt <span className="text-red-500">*</span>
                </Label>
                <input
                  id="maintenanceReceipt"
                  type="file"
                  accept="image/*,application/pdf"
                  ref={fileInputRef}
                  className="w-full"
                  onChange={e => setMaintenanceReceipt(e.target.files?.[0] || null)}
                  required
                />
                {maintenanceReceipt && (
                  <div className="text-xs mt-1 text-muted-foreground">
                    Selected: {maintenanceReceipt.name}
                  </div>
                )}
              </div>
              {maintenanceError && (
                <div className="text-red-500 text-xs">{maintenanceError}</div>
              )}
            </div>
          )}

          {showCancelWarning && (
            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-md text-yellow-800 dark:text-yellow-300 text-sm">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-500 dark:text-yellow-400 mt-0.5" />
                <div>
                  <p className="font-medium">Warning: Rental will be canceled</p>
                  <p className="mt-1">Changing the status from RENTED will cancel the active rental for this vehicle. This will stop the monthly rental calculation for this vehicle.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || selectedStatus === vehicle.status}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              'Update Status'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}