import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";

interface RefillFoodSupplyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: {
    id: string;
    name: string;
    quantity: number;
    unit: string;
    expirationDate: Date;
    isExpired: boolean;
  };
  onRefill: (data: {
    id: string;
    newQuantity: number;
    newExpirationDate: Date;
    disposedQuantity: number;
  }) => Promise<void>;
}

export function RefillFoodSupplyDialog({
  open,
  onOpenChange,
  item,
  onRefill,
}: RefillFoodSupplyDialogProps) {
  const [newQuantity, setNewQuantity] = useState<number>(item.quantity);
  const [newExpirationDate, setNewExpirationDate] = useState<Date>(
    new Date(new Date().setDate(new Date().getDate() + 30))
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newQuantity <= 0) {
      toast({
        title: "Invalid quantity",
        description: "Please enter a quantity greater than zero.",
        variant: "destructive",
      });
      return;
    }

    if (newExpirationDate < new Date()) {
      toast({
        title: "Invalid expiration date",
        description: "Expiration date must be in the future.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      // If the item is expired, the entire quantity is considered waste
      // Otherwise, we're just adding to the existing quantity
      const disposedQuantity = item.isExpired ? item.quantity : 0;
      
      await onRefill({
        id: item.id,
        newQuantity,
        newExpirationDate,
        disposedQuantity,
      });
      
      onOpenChange(false);
      toast({
        title: "Food supply refilled",
        description: `Successfully refilled ${item.name} with new quantity.`,
      });
    } catch (error) {
      console.error("Error refilling food supply:", error);
      toast({
        title: "Error",
        description: "Failed to refill food supply. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Refill Food Supply: {item.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 flex-1 overflow-hidden flex flex-col">
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4 pb-2">
          <div className="space-y-2">
            <Label htmlFor="current-quantity">Current Quantity</Label>
            <div className="flex items-center gap-2">
              <Input
                id="current-quantity"
                value={item.quantity}
                disabled
                className="bg-muted"
              />
              <span className="text-sm text-muted-foreground">{item.unit}</span>
            </div>
            {item.isExpired && (
              <p className="text-sm text-destructive">
                This item is expired and will be marked as waste when refilled.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-quantity">New Quantity to Add</Label>
            <div className="flex items-center gap-2">
              <Input
                id="new-quantity"
                type="number"
                min="0.01"
                step="0.01"
                value={newQuantity}
                onChange={(e) => setNewQuantity(parseFloat(e.target.value))}
                required
              />
              <span className="text-sm text-muted-foreground">{item.unit}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>New Expiration Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !newExpirationDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {newExpirationDate ? (
                    format(newExpirationDate, "PPP")
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={newExpirationDate}
                  onSelect={(date) => date && setNewExpirationDate(date)}
                  initialFocus
                  disabled={(date) => date < new Date()}
                />
              </PopoverContent>
            </Popover>
          </div>
            </div>
          </ScrollArea>
          
          <DialogFooter className="pt-4 border-t mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Refilling..." : "Refill"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}