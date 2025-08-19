import React from 'react';
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { printContent } from "@/util/print";
import { ConsumptionAnalysisReport } from './ConsumptionAnalysisReport';
import { useTranslation } from "@/contexts/TranslationContext";

type MonthlyConsumption = {
  month: string;
  year: number;
  foodConsumption: number;
  assetsPurchased: number;
  vehicleRentalCosts: number;
  total: number;
};

type CategoryForecast = {
  month: string;
  year: number;
  foodConsumption: number;
  assetsPurchased: number;
  vehicleRentalCosts: number;
  total: number;
  confidence: number;
};

interface PrintConsumptionReportButtonProps {
  monthlyData: MonthlyConsumption[];
  categoryForecasts: CategoryForecast[];
  className?: string;
}

export function PrintConsumptionReportButton({ 
  monthlyData, 
  categoryForecasts,
  className = ''
}: PrintConsumptionReportButtonProps) {
  const { t, language } = useTranslation();
  const handlePrint = async () => {
    try {
      // Create a temporary div to render the report
      const tempDiv = document.createElement('div');
      
      // Render the report component to HTML
      const reportHtml = ReactDOMServer.renderToString(
        <ConsumptionAnalysisReport 
          monthlyData={monthlyData}
          categoryForecasts={categoryForecasts}
          currentDate={new Date()}
        />
      );
      
      // Set the HTML content
      tempDiv.innerHTML = reportHtml;
      
      // Print the content
      await printContent(reportHtml, t('consumption_analysis_report'));
    } catch (error) {
      console.error('Error printing consumption report:', error);
      alert('There was an error printing the report. Please try again.');
    }
  };

  return (
    <Button 
      variant="outline" 
      size="sm" 
      className={`flex items-center ${className}`}
      onClick={handlePrint}
    >
      <Printer className="h-4 w-4 mr-2" />
      {t('print_report')}
    </Button>
  );
}

// Import ReactDOMServer for server-side rendering
import ReactDOMServer from 'react-dom/server';