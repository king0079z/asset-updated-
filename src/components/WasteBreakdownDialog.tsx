import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface IngredientWasteItem {
  ingredientName: string;
  wasteCost: number;
  wastePercentage: number;
  recipeName: string;
}

interface ExpirationWasteItem {
  supplyName: string;
  quantity: number;
  pricePerUnit: number;
  totalCost: number;
  disposalDate: string;
}

interface WasteBreakdownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ingredientWaste: IngredientWasteItem[];
  expirationWaste: ExpirationWasteItem[];
}

export const WasteBreakdownDialog: React.FC<WasteBreakdownDialogProps> = ({
  open,
  onOpenChange,
  ingredientWaste,
  expirationWaste,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw]">
        <DialogHeader>
          <DialogTitle>Waste Breakdown</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <Card className="p-4">
            <h3 className="font-semibold mb-2 text-primary">Ingredient Waste</h3>
            {ingredientWaste.length === 0 ? (
              <div className="text-muted-foreground text-sm">No ingredient waste recorded.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-1 px-2">Ingredient</th>
                      <th className="text-left py-1 px-2">Recipe</th>
                      <th className="text-right py-1 px-2">Waste Cost (QAR)</th>
                      <th className="text-right py-1 px-2">Waste %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ingredientWaste.map((item, idx) => (
                      <tr key={idx} className="border-b last:border-0">
                        <td className="py-1 px-2">{item.ingredientName}</td>
                        <td className="py-1 px-2">{item.recipeName}</td>
                        <td className="py-1 px-2 text-right">{item.wasteCost.toFixed(2)}</td>
                        <td className="py-1 px-2 text-right">{item.wastePercentage.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <Card className="p-4">
            <h3 className="font-semibold mb-2 text-destructive">Expiration Waste</h3>
            {expirationWaste.length === 0 ? (
              <div className="text-muted-foreground text-sm">No expiration waste recorded.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-1 px-2">Supply</th>
                      <th className="text-right py-1 px-2">Quantity</th>
                      <th className="text-right py-1 px-2">Price/Unit (QAR)</th>
                      <th className="text-right py-1 px-2">Total Cost (QAR)</th>
                      <th className="text-right py-1 px-2">Disposal Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expirationWaste.map((item, idx) => (
                      <tr key={idx} className="border-b last:border-0">
                        <td className="py-1 px-2">{item.supplyName}</td>
                        <td className="py-1 px-2 text-right">{item.quantity}</td>
                        <td className="py-1 px-2 text-right">{item.pricePerUnit.toFixed(2)}</td>
                        <td className="py-1 px-2 text-right">{item.totalCost.toFixed(2)}</td>
                        <td className="py-1 px-2 text-right">
                          {item.disposalDate ? new Date(item.disposalDate).toLocaleDateString() : "--"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};