import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Trash2, AlertTriangle, Info } from "lucide-react";
import { useTranslation } from "@/contexts/TranslationContext";

interface WasteTrackingDialogProps {
  foodSupplyId: string;
  foodSupplyName: string;
  unit: string;
  kitchenId?: string; // Add kitchenId prop
  onWasteRecorded: () => void;
}

type WasteReason = 
  | 'expired'
  | 'damaged'
  | 'quality_issues'
  | 'overproduction'
  | 'other';

export function WasteTrackingDialog({
  foodSupplyId,
  foodSupplyName,
  unit,
  kitchenId,
  onWasteRecorded
}: WasteTrackingDialogProps) {
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState<WasteReason>('expired');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableQuantity, setAvailableQuantity] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  // Fetch the current available quantity when the dialog opens
  useEffect(() => {
    if (open && foodSupplyId) {
      setIsLoading(true);
      fetch(`/api/food-supply?id=${foodSupplyId}`)
        .then(response => {
          if (!response.ok) throw new Error('Failed to fetch food supply details');
          return response.json();
        })
        .then(data => {
          // If the response is an array, find the item with matching ID
          const supply = Array.isArray(data) 
            ? data.find(item => item.id === foodSupplyId)
            : data;
          
          if (supply) {
            setAvailableQuantity(supply.quantity);
          }
        })
        .catch(error => {
          console.error('Error fetching food supply details:', error);
          toast({
            title: t('error'),
            description: t('failed_to_fetch_supply_details'),
            variant: "destructive",
          });
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [open, foodSupplyId, t, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const quantityValue = parseFloat(quantity);
    
    if (!quantity || quantityValue <= 0) {
      toast({
        title: t('error'),
        description: t('please_enter_valid_quantity'),
        variant: "destructive",
      });
      return;
    }

    if (availableQuantity !== null && quantityValue > availableQuantity) {
      toast({
        title: t('error'),
        description: t('quantity_exceeds_available_amount'),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Call the actual API endpoint
      const response = await fetch('/api/food-supply/dispose', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          foodSupplyId,
          quantity: quantityValue,
          reason,
          notes,
          kitchenId, // Include the kitchenId in the request
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to record waste');
      }
      
      toast({
        title: t('waste_recorded'),
        description: t('waste_recorded_successfully'),
      });
      
      setOpen(false);
      setQuantity('');
      setReason('expired');
      setNotes('');
      onWasteRecorded();
    } catch (error) {
      console.error('Error recording waste:', error);
      toast({
        title: t('error'),
        description: error instanceof Error ? error.message : t('failed_to_record_waste'),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const reasonOptions: { value: WasteReason; label: string }[] = [
    { value: 'expired', label: t('expired') },
    { value: 'damaged', label: t('damaged_during_storage') },
    { value: 'quality_issues', label: t('quality_issues') },
    { value: 'overproduction', label: t('overproduction') },
    { value: 'other', label: t('other') },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="bg-red-50 text-red-700 hover:bg-red-100 border-red-200">
          <Trash2 className="h-4 w-4 mr-2" />
          {t('record_waste')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('record_waste')}</DialogTitle>
          <DialogDescription>
            {t('record_waste_for')} {foodSupplyName}
          </DialogDescription>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              {availableQuantity !== null && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-blue-800 text-sm flex items-start gap-2">
                  <Info className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">{t('available_quantity')}</p>
                    <p className="mt-1">{availableQuantity} {unit}</p>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="quantity" className="text-right">
                  {t('quantity')}
                </Label>
                <div className="col-span-3 flex items-center gap-2">
                  <Input
                    id="quantity"
                    type="number"
                    step="0.01"
                    min="0"
                    max={availableQuantity !== null ? availableQuantity.toString() : undefined}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="flex-1"
                    required
                  />
                  <span className="text-sm text-muted-foreground">{unit}</span>
                </div>
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="reason" className="text-right">
                  {t('reason')}
                </Label>
                <Select
                  value={reason}
                  onValueChange={(value) => setReason(value as WasteReason)}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder={t('select_reason')} />
                  </SelectTrigger>
                  <SelectContent>
                    {reasonOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="notes" className="text-right">
                  {t('notes')}
                </Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('additional_details')}
                  className="col-span-3"
                />
              </div>
              
              <div className="col-span-4">
                <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-amber-800 text-sm flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">{t('waste_tracking_important')}</p>
                    <p className="mt-1">{t('waste_tracking_description')}</p>
                  </div>
                </div>
              </div>
            </div>
            
            <DialogFooter className="mt-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? t('recording') : t('record_waste')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}