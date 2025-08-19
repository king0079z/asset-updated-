import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useTranslation } from "@/contexts/TranslationContext";
import { Printer } from "lucide-react";

interface Ingredient {
  name: string;
  quantity: number;
  unit?: string;
  wastePercentage?: number;
  type: string;
  subRecipeName?: string;
}

interface KitchenBreakdownEntry {
  kitchenId: string;
  kitchenName: string;
  usageCount: number;
  totalCost: number;
  totalWaste: number;
  totalSellingPrice: number;
  totalProfit: number;
  ingredientWaste?: number;
}

interface PrintRecipeReportButtonProps {
  recipe: {
    id: string;
    name: string;
    description: string;
    servings: number;
    prepTime: number;
    ingredients: Ingredient[];
    instructions: string;
    totalCost: number;
    costPerServing: number;
    sellingPrice?: number;
    isSubrecipe?: boolean;
    totalWasteAmount?: number;
    kitchenBreakdown?: KitchenBreakdownEntry[];
  };
}

export function PrintRecipeReportButton({ recipe }: PrintRecipeReportButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (!printRef.current) return;
    const printContents = printRef.current.innerHTML;
    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${recipe.name} - ${t("recipe_summary_report")}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 24px; }
              h2 { color: #b45309; }
              table { width: 100%; border-collapse: collapse; margin-top: 12px; }
              th, td { border: 1px solid #ddd; padding: 8px; }
              th { background: #f3f4f6; }
              .section { margin-bottom: 18px; }
            </style>
          </head>
          <body>
            ${printContents}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      setTimeout(() => printWindow.close(), 500);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="text-orange-700 border-orange-300 hover:bg-orange-50"
        onClick={e => { e.stopPropagation(); setOpen(true); }}
        title={t("print_summary_report") || "Print Summary Report"}
      >
        <Printer className="h-4 w-4 mr-1" />
        {t("print")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t("recipe_summary_report") || "Recipe Summary Report"}
            </DialogTitle>
          </DialogHeader>
          <div ref={printRef}>
            <h2>{recipe.name}</h2>
            <p><strong>{t("description") || "Description"}:</strong> {recipe.description}</p>
            <div className="section">
              <strong>{t("type") || "Type"}:</strong> {recipe.isSubrecipe ? (t("subrecipe") || "Subrecipe") : (t("main_recipe") || "Main Recipe")}
            </div>
            <div className="section">
              <strong>{t("servings") || "Servings"}:</strong> {recipe.servings}
              <br />
              <strong>{t("prep_time") || "Prep Time"}:</strong> {recipe.prepTime} {t("min") || "min"}
            </div>
            <div className="section">
              <strong>{t("ingredients") || "Ingredients"}:</strong>
              <table>
                <thead>
                  <tr>
                    <th>{t("name") || "Name"}</th>
                    <th>{t("quantity") || "Quantity"}</th>
                    <th>{t("unit") || "Unit"}</th>
                    <th>{t("waste_percentage") || "Waste %"}</th>
                    <th>{t("type") || "Type"}</th>
                  </tr>
                </thead>
                <tbody>
                  {recipe.ingredients.map((ing, idx) => (
                    <tr key={idx}>
                      <td>{ing.name || ing.subRecipeName}</td>
                      <td>{ing.quantity}</td>
                      <td>{ing.unit || "-"}</td>
                      <td>{ing.wastePercentage !== undefined ? `${ing.wastePercentage}%` : "-"}</td>
                      <td>{ing.type === "food" ? (t("ingredient") || "Ingredient") : (t("subrecipe") || "Subrecipe")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="section">
              <strong>{t("instructions") || "Instructions"}:</strong>
              <div style={{ whiteSpace: "pre-line" }}>{recipe.instructions}</div>
            </div>
            <div className="section">
              <strong>{t("total_cost") || "Total Cost"}:</strong> QAR {recipe.totalCost.toFixed(2)}<br />
              <strong>{t("cost_per_serving") || "Cost/Serving"}:</strong> QAR {recipe.costPerServing.toFixed(2)}<br />
              {recipe.sellingPrice !== undefined && (
                <>
                  <strong>{t("selling_price") || "Selling Price"}:</strong> QAR {recipe.sellingPrice.toFixed(2)}<br />
                </>
              )}
              {recipe.totalWasteAmount !== undefined && (
                <>
                  <strong>{t("total_waste_amount") || "Total Waste Amount"}:</strong> QAR {recipe.totalWasteAmount.toFixed(2)}
                </>
              )}
            </div>
            {/* Kitchen Breakdown Print */}
            {recipe.kitchenBreakdown && recipe.kitchenBreakdown.length > 0 && (
              <div className="section">
                <strong>{t("kitchen_breakdown") || "Kitchen Breakdown"}:</strong>
                <table>
                  <thead>
                    <tr>
                      <th>{t('kitchen') || 'Kitchen'}</th>
                      <th>{t('times_used') || 'Times Used'}</th>
                      <th>{t('total_cost') || 'Total Cost'}</th>
                      <th>{t('total_waste') || 'Total Waste'}</th>
                      <th>{t('total_selling_price') || 'Total Selling Price'}</th>
                      <th>{t('total_profit') || 'Total Profit'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipe.kitchenBreakdown.map((entry) => (
                      <tr key={entry.kitchenId}>
                        <td>{entry.kitchenName}</td>
                        <td>{entry.usageCount}</td>
                        <td>QAR {entry.totalCost?.toFixed(2) ?? '0.00'}</td>
                        <td>QAR {entry.totalWaste?.toFixed(2) ?? '0.00'}</td>
                        <td>QAR {entry.totalSellingPrice?.toFixed(2) ?? '0.00'}</td>
                        <td style={{ color: entry.totalProfit >= 0 ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
                          {entry.totalProfit >= 0 ? "▲" : "▼"} QAR {entry.totalProfit.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                    {/* Summary row */}
                    <tr style={{ background: "#fef3c7", fontWeight: 700 }}>
                      <td>{t('total') || 'Total'}</td>
                      <td>
                        {recipe.kitchenBreakdown.reduce((sum, k) => sum + (k.usageCount || 0), 0)}
                      </td>
                      <td>
                        QAR {recipe.kitchenBreakdown.reduce((sum, k) => sum + (k.totalCost || 0), 0).toFixed(2)}
                      </td>
                      <td>
                        QAR {recipe.kitchenBreakdown.reduce((sum, k) => sum + (k.totalWaste || 0), 0).toFixed(2)}
                      </td>
                      <td>
                        QAR {recipe.kitchenBreakdown.reduce((sum, k) => sum + (k.totalSellingPrice || 0), 0).toFixed(2)}
                      </td>
                      <td style={{
                        color: recipe.kitchenBreakdown.reduce((sum, k) => sum + (k.totalProfit || 0), 0) >= 0 ? "#16a34a" : "#dc2626",
                        fontWeight: 700
                      }}>
                        {recipe.kitchenBreakdown.reduce((sum, k) => sum + (k.totalProfit || 0), 0) >= 0 ? "▲" : "▼"} QAR {recipe.kitchenBreakdown.reduce((sum, k) => sum + (k.totalProfit || 0), 0).toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("close") || "Close"}
            </Button>
            <Button onClick={handlePrint} className="bg-orange-600 hover:bg-orange-700 text-white">
              <Printer className="h-4 w-4 mr-2" />
              {t("print")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}