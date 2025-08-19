import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Edit } from "lucide-react";
import { useTranslation } from "@/contexts/TranslationContext";

interface EditFoodSupplyDialogProps {
  foodSupplyId: string;
  currentPrice: number;
  onUpdate: () => void;
  buttonVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  buttonSize?: "default" | "sm" | "lg" | "icon";
  buttonClassName?: string;
  showIcon?: boolean;
}

export function EditFoodSupplyDialog({
  foodSupplyId,
  currentPrice,
  onUpdate,
  buttonVariant = "ghost",
  buttonSize = "sm",
  buttonClassName = "",
  showIcon = false
}: EditFoodSupplyDialogProps) {
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState(currentPrice.toString());
  const { toast } = useToast();
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch("/api/food-supply/update-price", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: foodSupplyId,
          pricePerUnit: price,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update price");
      }

      toast({
        title: t('success'),
        description: t('price_updated_successfully'),
      });
      setOpen(false);
      onUpdate();
    } catch (error) {
      console.error("Error updating price:", error);
      toast({
        title: t('error'),
        description: t('failed_to_update_price'),
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant={buttonVariant} 
          size={buttonSize}
          className={buttonClassName}
        >
          {showIcon && <Edit className="h-4 w-4 mr-2" />}
          {showIcon ? t('edit_price') : <Edit className="h-4 w-4" />}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('edit_price_per_unit')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="price" className="text-right">
                {t('price')}
              </label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit">{t('save_changes')}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}