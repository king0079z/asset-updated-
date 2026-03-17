import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useTranslation } from "@/contexts/TranslationContext";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, AlertCircle, Trash2 } from "lucide-react";

interface Asset {
  id: string;
  name: string;
  status: string;
}

interface ChangeAssetStatusDialogProps {
  asset: Asset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChanged?: () => void;
}

export function ChangeAssetStatusDialog({ 
  asset, 
  open, 
  onOpenChange,
  onStatusChanged
}: ChangeAssetStatusDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [status, setStatus] = useState<string>(asset?.status || 'ACTIVE');
  const [comment, setComment] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  
  // Reset form when dialog opens with a new asset
  React.useEffect(() => {
    if (open && asset) {
      setStatus(asset.status);
      setComment('');
    }
  }, [open, asset]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!asset) return;
    
    // Validate that comment is not empty
    if (!comment.trim()) {
      toast({
        title: t('error'),
        description: status === 'DISPOSED' ? t('disposal_reason_is_required') : t('comment_is_required'),
        variant: 'destructive',
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // If status is DISPOSED, use the dispose API with reason
      if (status === 'DISPOSED') {
        const disposeResponse = await fetch(`/api/assets/${asset.id}/dispose`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reason: comment.trim()
          }),
        });
        
        if (!disposeResponse.ok) {
          throw new Error('Failed to dispose asset');
        }
      } else {
        // For other statuses, update normally
        const response = await fetch(`/api/assets/${asset.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status,
            // Include other required fields to avoid nullifying them
            name: asset.name,
          }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to update asset status');
        }
        
        // Create an audit log entry with the comment
        const auditResponse = await fetch('/api/audit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'ASSET_STATUS_COMMENT',
            resourceType: 'ASSET',
            resourceId: asset.id,
            details: {
              assetId: asset.id,
              assetName: asset.name,
              status,
              comment,
              timestamp: new Date().toISOString(),
            },
            severity: 'INFO',
          }),
        });
        
        if (!auditResponse.ok) {
          console.error('Failed to save status change comment');
        }
      }
      
      toast({
        title: t('success'),
        description: status === 'DISPOSED' ? t('asset_disposed_successfully') : t('asset_status_updated'),
      });
      
      // Call the callback if provided
      if (onStatusChanged) {
        onStatusChanged();
      }
      
      // Close the dialog
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating asset status:', error);
      toast({
        title: t('error'),
        description: status === 'DISPOSED' ? t('failed_to_dispose_asset') : t('failed_to_update_asset_status'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (!asset) return null;
  
  // Determine if we're in disposal mode
  const isDisposalMode = status === 'DISPOSED';
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isDisposalMode ? (
              <>
                <Trash2 className="h-5 w-5 text-destructive" />
                {t('dispose_asset')}
              </>
            ) : (
              t('change_asset_status')
            )}
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
            <Label htmlFor="status">{t('status')}</Label>
            <RadioGroup 
              id="status" 
              value={status} 
              onValueChange={setStatus}
              className="grid grid-cols-2 gap-2"
            >
              <div className="flex items-center space-x-2 border rounded-md p-2 hover:bg-muted/50">
                <RadioGroupItem value="LIKE_NEW" id="like_new" />
                <Label htmlFor="like_new" className="cursor-pointer">{t('like_new')}</Label>
              </div>
              <div className="flex items-center space-x-2 border rounded-md p-2 hover:bg-muted/50">
                <RadioGroupItem value="ACTIVE" id="active" />
                <Label htmlFor="active" className="cursor-pointer">{t('active')}</Label>
              </div>
              <div className="flex items-center space-x-2 border rounded-md p-2 hover:bg-muted/50">
                <RadioGroupItem value="MAINTENANCE" id="maintenance" />
                <Label htmlFor="maintenance" className="cursor-pointer">{t('maintenance')}</Label>
              </div>
              <div className="flex items-center space-x-2 border rounded-md p-2 hover:bg-muted/50">
                <RadioGroupItem value="IN_TRANSIT" id="in_transit" />
                <Label htmlFor="in_transit" className="cursor-pointer">{t('in_transit')}</Label>
              </div>
              <div className="flex items-center space-x-2 border rounded-md p-2 hover:bg-muted/50">
                <RadioGroupItem value="DAMAGED" id="damaged" />
                <Label htmlFor="damaged" className="cursor-pointer">{t('damaged')}</Label>
              </div>
              <div className="flex items-center space-x-2 border rounded-md p-2 hover:bg-muted/50">
                <RadioGroupItem value="CRITICAL" id="critical" />
                <Label htmlFor="critical" className="cursor-pointer">{t('critical')}</Label>
              </div>
              <div className="flex items-center space-x-2 border rounded-md p-2 hover:bg-muted/50 col-span-2">
                <RadioGroupItem value="DISPOSED" id="disposed" />
                <Label htmlFor="disposed" className="cursor-pointer">{t('disposed')}</Label>
              </div>
            </RadioGroup>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="comment" className="flex items-center gap-1">
                {isDisposalMode ? t('disposal_reason') : t('comment')} <span className="text-destructive">*</span>
              </Label>
              {!comment.trim() && (
                <div className="flex items-center text-xs text-destructive">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {t('required')}
                </div>
              )}
            </div>
            <Textarea
              id="comment"
              placeholder={isDisposalMode ? t('enter_reason_for_disposal') : t('enter_comment_for_status_change')}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className={`min-h-[100px] ${!comment.trim() ? 'border-destructive' : ''}`}
              required
            />
            <p className="text-xs text-muted-foreground">
              {isDisposalMode 
                ? t('reason_will_be_recorded_in_asset_history')
                : t('comment_will_be_recorded_in_asset_history')}
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
            <Button 
              type="submit" 
              disabled={isSubmitting}
              variant={isDisposalMode ? "destructive" : "default"}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isDisposalMode ? t('disposing') : t('updating')}
                </>
              ) : (
                isDisposalMode ? t('dispose_asset') : t('update_status')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}