import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "@/contexts/TranslationContext";
import { AlertCircle, Loader2, Trash2 } from "lucide-react";

interface Asset {
  id: string;
  name: string;
  status: string;
}

interface AssetDisposalDialogProps {
  asset: Asset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssetDisposed?: () => void;
}

export function AssetDisposalDialog({ 
  asset, 
  open, 
  onOpenChange,
  onAssetDisposed
}: AssetDisposalDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  
  // Reset form when dialog opens with a new asset
  React.useEffect(() => {
    if (open && asset) {
      setReason('');
    }
  }, [open, asset]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!asset) return;
    
    // Validate that reason is not empty
    if (!reason.trim()) {
      toast({
        title: t('error'),
        description: t('disposal_reason_is_required'),
        variant: 'destructive',
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Prepare the request payload
      const payload = {
        reason: reason.trim()
      };
      
      console.log('Disposing asset with payload:', payload);
      
      // Call the dispose API with the reason
      const response = await fetch(`/api/assets/${asset.id}/dispose`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error('Asset disposal failed:', response.status, errorData);
        throw new Error(errorData?.error || 'Failed to dispose asset');
      }
      
      toast({
        title: t('success'),
        description: t('asset_disposed_successfully'),
      });
      
      // Call the callback if provided
      if (onAssetDisposed) {
        onAssetDisposed();
      }
      
      // Close the dialog
      onOpenChange(false);
    } catch (error) {
      console.error('Error disposing asset:', error);
      toast({
        title: t('error'),
        description: t('failed_to_dispose_asset'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (!asset) return null;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            {t('dispose_asset')}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>{t('asset')}</Label>
            <div className="p-2 bg-muted rounded-md">
              <p className="font-medium">{asset.name}</p>
              <p className="text-sm text-muted-foreground">ID: {asset.id}</p>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="reason" className="flex items-center gap-1">
                {t('disposal_reason')} <span className="text-destructive">*</span>
              </Label>
              {!reason.trim() && (
                <div className="flex items-center text-xs text-destructive">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {t('required')}
                </div>
              )}
            </div>
            <Textarea
              id="reason"
              placeholder={t('enter_reason_for_disposal')}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={`min-h-[100px] ${!reason.trim() ? 'border-destructive' : ''}`}
              required
            />
            <p className="text-xs text-muted-foreground">
              {t('reason_will_be_recorded_in_asset_history')}
            </p>
          </div>
          
          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {t('cancel')}
            </Button>
            <Button type="submit" variant="destructive" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('disposing')}
                </>
              ) : (
                t('dispose_asset')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}