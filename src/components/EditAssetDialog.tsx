import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Truck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useTranslation } from "@/contexts/TranslationContext";

interface Asset {
  id: string;
  assetId: string;
  name: string;
  description?: string;
  type: string;
  status: 'ACTIVE' | 'IN_TRANSIT' | 'DISPOSED' | 'MAINTENANCE' | 'DAMAGED' | 'CRITICAL' | 'LIKE_NEW';
  imageUrl?: string;
  floorNumber?: string;
  roomNumber?: string;
  purchaseAmount?: number;
  purchaseDate?: string;
  barcode?: string;
  vendor?: {
    name: string;
  };
}

interface EditAssetDialogProps {
  asset: Asset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssetUpdated: () => void;
}

export function EditAssetDialog({ asset, open, onOpenChange, onAssetUpdated }: EditAssetDialogProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<Asset> | null>(null);

  // Update formData when asset changes
  useEffect(() => {
    if (asset) {
      setFormData(asset);
    }
  }, [asset]);

  if (!asset || !formData) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch(`/api/assets/${asset.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          type: formData.type,
          status: formData.status,
          floorNumber: formData.floorNumber,
          roomNumber: formData.roomNumber,
          purchaseAmount: formData.purchaseAmount ? Number(formData.purchaseAmount) : null,
          purchaseDate: formData.purchaseDate || null,
        }),
      });

      if (!response.ok) {
        throw new Error(t('failed_to_update_asset'));
      }

      toast({
        title: t('success'),
        description: t('asset_updated_successfully'),
      });

      onAssetUpdated();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: t('error'),
        description: t('failed_to_update_asset'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'LIKE_NEW':
        return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      case 'ACTIVE':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'IN_TRANSIT':
        return <Truck className="h-5 w-5 text-purple-500" />;
      case 'MAINTENANCE':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'DAMAGED':
        return <AlertCircle className="h-5 w-5 text-orange-500" />;
      case 'CRITICAL':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      case 'DISPOSED':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'LIKE_NEW':
        return 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/50 dark:border-emerald-800 dark:text-emerald-400';
      case 'ACTIVE':
        return 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/50 dark:border-green-800 dark:text-green-400';
      case 'IN_TRANSIT':
        return 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-900/50 dark:border-purple-800 dark:text-purple-400';
      case 'MAINTENANCE':
        return 'bg-yellow-50 border-yellow-200 text-yellow-700 dark:bg-yellow-900/50 dark:border-yellow-800 dark:text-yellow-400';
      case 'DAMAGED':
        return 'bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-900/50 dark:border-orange-800 dark:text-orange-400';
      case 'CRITICAL':
        return 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/50 dark:border-red-800 dark:text-red-400';
      case 'DISPOSED':
        return 'bg-gray-50 border-gray-200 text-gray-700 dark:bg-gray-900/50 dark:border-gray-800 dark:text-gray-400';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-700 dark:bg-gray-900/50 dark:border-gray-800 dark:text-gray-400';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('edit_asset')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Status Section */}
          <Card className={`border-2 ${getStatusColor(formData.status || 'ACTIVE')}`}>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex flex-col space-y-4 md:w-1/2">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(formData.status || 'ACTIVE')}
                    <h3 className="font-medium">{t('asset_status')}</h3>
                  </div>
                  <Badge 
                    className={`px-3 py-1.5 w-fit ${getStatusColor(formData.status || 'ACTIVE')}`}
                  >
                    {t(formData.status.toLowerCase()) || formData.status.replace('_', ' ')}
                  </Badge>
                </div>
                
                <div className="space-y-2 md:w-1/2">
                  <label htmlFor="status" className="text-sm font-medium">{t('change_status')}</label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: 'ACTIVE' | 'IN_TRANSIT' | 'DISPOSED' | 'MAINTENANCE' | 'DAMAGED' | 'CRITICAL' | 'LIKE_NEW') => 
                      setFormData({ ...formData, status: value })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t('select_status')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LIKE_NEW">{t('like_new') || 'Like New'}</SelectItem>
                      <SelectItem value="ACTIVE">{t('active')}</SelectItem>
                      <SelectItem value="IN_TRANSIT">{t('in_transit')}</SelectItem>
                      <SelectItem value="MAINTENANCE">{t('maintenance') || 'Maintenance'}</SelectItem>
                      <SelectItem value="DAMAGED">{t('damaged') || 'Damaged'}</SelectItem>
                      <SelectItem value="CRITICAL">{t('critical') || 'Critical'}</SelectItem>
                      <SelectItem value="DISPOSED">{t('disposed')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('changing_status_will_update')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* Asset Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">{t('name')}</label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="type" className="text-sm font-medium">{t('type')}</label>
              <Input
                id="type"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="purchaseAmount" className="text-sm font-medium">{t('purchase_amount')} (QAR)</label>
              <Input
                id="purchaseAmount"
                type="number"
                value={formData.purchaseAmount || ''}
                onChange={(e) => setFormData({ ...formData, purchaseAmount: e.target.value ? Number(e.target.value) : undefined })}
              />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="purchaseDate" className="text-sm font-medium">{t('purchase_date')}</label>
              <Input
                id="purchaseDate"
                type="date"
                value={formData.purchaseDate ? 
                  (() => {
                    try {
                      const date = new Date(formData.purchaseDate);
                      return !isNaN(date.getTime()) ? date.toISOString().split('T')[0] : '';
                    } catch (e) {
                      console.error('Error formatting purchase date:', e);
                      return '';
                    }
                  })() : ''
                }
                onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="floorNumber" className="text-sm font-medium">{t('floor_number')}</label>
              <Input
                id="floorNumber"
                value={formData.floorNumber || ''}
                onChange={(e) => setFormData({ ...formData, floorNumber: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="roomNumber" className="text-sm font-medium">{t('room_number')}</label>
              <Input
                id="roomNumber"
                value={formData.roomNumber || ''}
                onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-medium">{t('description')}</label>
            <Textarea
              id="description"
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="resize-none"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? t('updating') : t('update_asset')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}