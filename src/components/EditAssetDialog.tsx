import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Truck, Upload, X, ImageIcon, Loader2, Trash2 } from "lucide-react";
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
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [removeImage, setRemoveImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (asset && open) {
      setFormData(asset);
      setImagePreview(null);
      setImageFile(null);
      setRemoveImage(false);
    }
  }, [asset, open]);

  if (!asset || !formData) return null;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setRemoveImage(false);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setRemoveImage(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      let imageUrl: string | null | undefined = undefined; // undefined = don't change

      // Upload new image if selected
      if (imageFile) {
        setIsUploadingImage(true);
        const formDataImg = new FormData();
        formDataImg.append('image', imageFile);
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: formDataImg });
        setIsUploadingImage(false);
        if (!uploadRes.ok) {
          const err = await uploadRes.json().catch(() => ({}));
          throw new Error(err.message || 'Failed to upload image');
        }
        const { url } = await uploadRes.json();
        imageUrl = url;
      } else if (removeImage) {
        imageUrl = null; // explicitly remove
      }

      const response = await fetch(`/api/assets/${asset.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          type: formData.type,
          status: formData.status,
          floorNumber: formData.floorNumber,
          roomNumber: formData.roomNumber,
          purchaseAmount: formData.purchaseAmount ? Number(formData.purchaseAmount) : null,
          purchaseDate: formData.purchaseDate || null,
          ...(imageUrl !== undefined ? { imageUrl } : {}),
        }),
      });

      if (!response.ok) {
        throw new Error(t('failed_to_update_asset'));
      }

      toast({ title: t('success'), description: t('asset_updated_successfully') });
      onAssetUpdated();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: t('error'),
        description: error instanceof Error ? error.message : t('failed_to_update_asset'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setIsUploadingImage(false);
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
              rows={3}
              className="resize-none"
            />
          </div>

          {/* ── Image Section ─────────────────────────────────────────── */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
              Asset Image
            </label>

            {/* Current / Preview image */}
            {(imagePreview || (formData.imageUrl && !removeImage)) ? (
              <div className="relative rounded-xl overflow-hidden border border-border bg-muted/20 group" style={{ height: "180px" }}>
                <img
                  src={imagePreview || formData.imageUrl}
                  alt="Asset"
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).src = ''; }}
                />
                {/* Overlay actions */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-slate-900 text-sm font-semibold hover:bg-slate-100 transition-colors"
                  >
                    <Upload className="h-4 w-4" /> Replace
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" /> Remove
                  </button>
                </div>
                {/* "New" badge if replaced */}
                {imagePreview && (
                  <div className="absolute top-2 left-2 bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest">
                    New
                  </div>
                )}
              </div>
            ) : (
              /* No image / removed state */
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 h-36 rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/10 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/10 transition-colors"
              >
                <Upload className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">Click to upload an image</p>
                <p className="text-xs text-muted-foreground/60">JPG, PNG, WEBP, HEIC, GIF up to 10MB</p>
              </div>
            )}

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
            />

            {/* Bottom action strip when image exists */}
            {(imagePreview || (formData.imageUrl && !removeImage)) && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  <Upload className="h-3 w-3" /> Change image
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="flex items-center gap-1 text-red-500 hover:text-red-600 font-medium"
                >
                  <X className="h-3 w-3" /> Remove
                </button>
                {imageFile && <span className="ml-auto text-emerald-600 font-medium">✓ New image ready to upload</span>}
              </div>
            )}
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
            <Button type="submit" disabled={isLoading} className="gap-2">
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isUploadingImage ? 'Uploading image...' : t('updating')}
                </>
              ) : t('update_asset')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}