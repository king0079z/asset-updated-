import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { printContent } from "@/util/print";
import { useTranslation } from "@/contexts/TranslationContext";
import { format } from 'date-fns';

type ConsumptionDetail = {
  name: string;
  unit: string;
  totalQuantity: number;
  consumptions: {
    id: string;
    quantity: number;
    date: string;
    user: string;
    notes?: string;
  }[];
};

type FoodTypeMonthlyData = {
  name: string;
  unit: string;
  data: number[];
};

type PrintKitchenConsumptionReportButtonProps = {
  kitchenId: string;
  kitchenName: string;
  details: ConsumptionDetail[];
  monthlyData: {
    labels: string[];
    totalData: number[];
    byFoodType: FoodTypeMonthlyData[];
  };
};

export function PrintKitchenConsumptionReportButton({
  kitchenId,
  kitchenName,
  details,
  monthlyData,
}: PrintKitchenConsumptionReportButtonProps) {
  const [isPrinting, setIsPrinting] = useState(false);
  const { t } = useTranslation();

  const handlePrint = async () => {
    if (isPrinting) return;
    
    setIsPrinting(true);
    try {
      const reportContent = generateReportContent(kitchenName, details, monthlyData);
      await printContent(reportContent, `${kitchenName} - ${t('consumption_report')}`);
    } catch (error) {
      console.error('Error printing kitchen consumption report:', error);
    } finally {
      setIsPrinting(false);
    }
  };

  const generateReportContent = (
    kitchenName: string,
    details: ConsumptionDetail[],
    monthlyData: {
      labels: string[];
      totalData: number[];
      byFoodType: FoodTypeMonthlyData[];
    }
  ): string => {
    const currentDate = format(new Date(), 'PPP');
    
    // Generate monthly consumption table
    const monthlyConsumptionTable = `
      <section>
        <h2>${t('monthly_consumption')}</h2>
        <table>
          <thead>
            <tr>
              <th>${t('food_item')}</th>
              ${monthlyData.labels.map(month => `<th>${month}</th>`).join('')}
              <th>${t('total')}</th>
            </tr>
          </thead>
          <tbody>
            ${monthlyData.byFoodType.map(foodType => {
              const total = foodType.data.reduce((sum, val) => sum + val, 0);
              return `
                <tr>
                  <td>${foodType.name}</td>
                  ${foodType.data.map(value => `<td>${value} ${foodType.unit}</td>`).join('')}
                  <td><strong>${total} ${foodType.unit}</strong></td>
                </tr>
              `;
            }).join('')}
            <tr class="bg-gray-50">
              <td><strong>${t('total_all_items')}</strong></td>
              ${monthlyData.totalData.map(value => `<td><strong>${value}</strong></td>`).join('')}
              <td><strong>${monthlyData.totalData.reduce((sum, val) => sum + val, 0)}</strong></td>
            </tr>
          </tbody>
        </table>
      </section>
    `;

    // Generate summary table
    const summaryTable = `
      <section>
        <h2>${t('consumption_summary')}</h2>
        <table>
          <thead>
            <tr>
              <th>${t('food_item')}</th>
              <th>${t('unit')}</th>
              <th>${t('total_quantity')}</th>
            </tr>
          </thead>
          <tbody>
            ${details.map(item => `
              <tr>
                <td>${item.name}</td>
                <td>${item.unit}</td>
                <td>${item.totalQuantity}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </section>
    `;

    // Generate detailed consumption history
    const detailedHistory = `
      <section>
        <h2>${t('detailed_consumption_history')}</h2>
        ${details.map(item => `
          <div class="border mb-4 p-4 rounded-lg">
            <h3>${item.name} (${item.unit})</h3>
            <table>
              <thead>
                <tr>
                  <th>${t('quantity')}</th>
                  <th>${t('date')}</th>
                  <th>${t('user')}</th>
                  <th>${t('notes')}</th>
                </tr>
              </thead>
              <tbody>
                ${item.consumptions.map(consumption => `
                  <tr>
                    <td>${consumption.quantity} ${item.unit}</td>
                    <td>${format(new Date(consumption.date), 'PPp')}</td>
                    <td>${consumption.user}</td>
                    <td>${consumption.notes || '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `).join('')}
      </section>
    `;

    return `
      <div class="report-header">
        <h1>${t('kitchen_consumption_report')}</h1>
        <p>${t('kitchen')}: <strong>${kitchenName}</strong></p>
        <p>${t('report_generated')}: ${currentDate}</p>
      </div>
      
      ${monthlyConsumptionTable}
      ${summaryTable}
      ${detailedHistory}
      
      <div class="report-footer">
        <p>${t('end_of_report')}</p>
      </div>
    `;
  };

  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={handlePrint}
      disabled={isPrinting || details.length === 0}
    >
      <Printer className="h-4 w-4 mr-2" />
      {isPrinting ? t('printing') : t('print_report')}
    </Button>
  );
}