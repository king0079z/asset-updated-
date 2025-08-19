import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { printContent } from "@/util/print";
import { useTranslation } from "@/contexts/TranslationContext";
import { format } from 'date-fns';

type KitchenTotal = {
  id: string;
  name: string;
  floorNumber: number;
  total: number;
};

type PrintAllKitchenConsumptionReportButtonProps = {
  chartData: any[];
  kitchenTotals: KitchenTotal[];
};

export function PrintAllKitchenConsumptionReportButton({
  chartData,
  kitchenTotals,
}: PrintAllKitchenConsumptionReportButtonProps) {
  const [isPrinting, setIsPrinting] = useState(false);
  const { t } = useTranslation();

  const handlePrint = async () => {
    if (isPrinting) return;
    
    setIsPrinting(true);
    try {
      const reportContent = generateReportContent(chartData, kitchenTotals);
      await printContent(reportContent, `${t('kitchen_consumption_summary')}`);
    } catch (error) {
      console.error('Error printing kitchen consumption report:', error);
    } finally {
      setIsPrinting(false);
    }
  };

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'QAR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const generateReportContent = (
    chartData: any[],
    kitchenTotals: KitchenTotal[]
  ): string => {
    const currentDate = format(new Date(), 'PPP');
    const grandTotal = kitchenTotals.reduce((sum, kitchen) => sum + kitchen.total, 0);
    
    // Sort kitchens by total consumption (highest first)
    const sortedKitchens = [...kitchenTotals].sort((a, b) => b.total - a.total);
    
    // Generate monthly consumption table
    const monthlyConsumptionTable = `
      <section>
        <h2>${t('monthly_consumption')}</h2>
        <table>
          <thead>
            <tr>
              <th>${t('month')}</th>
              ${kitchenTotals.map(kitchen => `<th>${kitchen.name} (Floor ${kitchen.floorNumber})</th>`).join('')}
              <th>${t('total')}</th>
            </tr>
          </thead>
          <tbody>
            ${chartData.map(monthData => {
              const monthTotal = kitchenTotals.reduce((sum, kitchen) => sum + (monthData[kitchen.name] || 0), 0);
              return `
                <tr>
                  <td>${monthData.month}</td>
                  ${kitchenTotals.map(kitchen => `<td>${formatCurrency(monthData[kitchen.name] || 0)}</td>`).join('')}
                  <td><strong>${formatCurrency(monthTotal)}</strong></td>
                </tr>
              `;
            }).join('')}
            <tr class="bg-gray-50">
              <td><strong>${t('total')}</strong></td>
              ${kitchenTotals.map(kitchen => {
                const kitchenTotal = chartData.reduce((sum, monthData) => sum + (monthData[kitchen.name] || 0), 0);
                return `<td><strong>${formatCurrency(kitchenTotal)}</strong></td>`;
              }).join('')}
              <td><strong>${formatCurrency(grandTotal)}</strong></td>
            </tr>
          </tbody>
        </table>
      </section>
    `;

    // Generate kitchen totals table
    const kitchenTotalsTable = `
      <section>
        <h2>${t('total_consumption_by_kitchen')}</h2>
        <table>
          <thead>
            <tr>
              <th>${t('kitchen')}</th>
              <th>${t('floor')}</th>
              <th>${t('total_consumption')}</th>
              <th>${t('percentage')}</th>
            </tr>
          </thead>
          <tbody>
            ${sortedKitchens.map(kitchen => {
              const percentage = ((kitchen.total / grandTotal) * 100).toFixed(1);
              return `
                <tr>
                  <td>${kitchen.name}</td>
                  <td>${kitchen.floorNumber}</td>
                  <td>${formatCurrency(kitchen.total)}</td>
                  <td>${percentage}%</td>
                </tr>
              `;
            }).join('')}
            <tr class="bg-gray-50">
              <td colspan="2"><strong>${t('grand_total')}</strong></td>
              <td><strong>${formatCurrency(grandTotal)}</strong></td>
              <td><strong>100%</strong></td>
            </tr>
          </tbody>
        </table>
      </section>
    `;

    // Generate statistics section
    const averagePerKitchen = grandTotal / kitchenTotals.length;
    const topKitchens = sortedKitchens.slice(0, 3);
    
    const statisticsSection = `
      <section>
        <h2>${t('statistics')}</h2>
        <div class="stats-container">
          <div class="stat-box">
            <h3>${t('general_statistics')}</h3>
            <table>
              <tr>
                <td>${t('total_kitchens')}:</td>
                <td><strong>${kitchenTotals.length}</strong></td>
              </tr>
              <tr>
                <td>${t('average_per_kitchen')}:</td>
                <td><strong>${formatCurrency(averagePerKitchen)}</strong></td>
              </tr>
              <tr>
                <td>${t('total_consumption')}:</td>
                <td><strong>${formatCurrency(grandTotal)}</strong></td>
              </tr>
            </table>
          </div>
          
          <div class="stat-box">
            <h3>${t('top_3_kitchens')}</h3>
            <table>
              ${topKitchens.map((kitchen, index) => {
                const percentage = ((kitchen.total / grandTotal) * 100).toFixed(1);
                return `
                  <tr>
                    <td>${index + 1}. ${kitchen.name} (Floor ${kitchen.floorNumber}):</td>
                    <td><strong>${formatCurrency(kitchen.total)} (${percentage}%)</strong></td>
                  </tr>
                `;
              }).join('')}
            </table>
          </div>
        </div>
      </section>
    `;

    return `
      <div class="report-container">
        <div class="report-header">
          <h1>${t('kitchen_consumption_summary')}</h1>
          <p>${t('report_generated')}: ${currentDate}</p>
          <p>${t('total_kitchens')}: <strong>${kitchenTotals.length}</strong> | ${t('total_consumption')}: <strong>${formatCurrency(grandTotal)}</strong></p>
        </div>
        
        ${kitchenTotalsTable}
        ${monthlyConsumptionTable}
        ${statisticsSection}
        
        <div class="report-footer">
          <p>${t('end_of_report')}</p>
        </div>
      </div>

      <style>
        .report-container {
          font-family: Arial, sans-serif;
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }
        .report-header {
          text-align: center;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #eaeaea;
        }
        .report-header h1 {
          color: #10b981;
          margin-bottom: 10px;
        }
        section {
          margin-bottom: 30px;
        }
        h2 {
          color: #10b981;
          border-bottom: 1px solid #eaeaea;
          padding-bottom: 10px;
          margin-bottom: 15px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        th, td {
          border: 1px solid #eaeaea;
          padding: 10px;
          text-align: left;
        }
        th {
          background-color: #f9fafb;
          font-weight: bold;
        }
        .bg-gray-50 {
          background-color: #f9fafb;
        }
        .stats-container {
          display: flex;
          gap: 20px;
          flex-wrap: wrap;
        }
        .stat-box {
          flex: 1;
          min-width: 300px;
          border: 1px solid #eaeaea;
          border-radius: 8px;
          padding: 15px;
        }
        .stat-box h3 {
          color: #10b981;
          margin-top: 0;
          margin-bottom: 15px;
          padding-bottom: 10px;
          border-bottom: 1px solid #eaeaea;
        }
        .stat-box table {
          margin-bottom: 0;
        }
        .stat-box td {
          border: none;
          padding: 5px 0;
        }
        .report-footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 2px solid #eaeaea;
          text-align: center;
          font-style: italic;
          color: #6b7280;
        }
        @media print {
          .report-container {
            padding: 0;
          }
          section {
            page-break-inside: avoid;
          }
        }
      </style>
    `;
  };

  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={handlePrint}
      disabled={isPrinting || kitchenTotals.length === 0}
      className="border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
    >
      <Printer className="h-4 w-4 mr-2" />
      {isPrinting ? t('printing') : t('print_report')}
    </Button>
  );
}