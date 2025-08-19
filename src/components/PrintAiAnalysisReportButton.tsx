import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { printContent } from '@/util/print';
import AiAnalysisReport from './AiAnalysisReport';

interface PrintAiAnalysisReportButtonProps {
  data: any;
  mlData?: any;
}

const PrintAiAnalysisReportButton: React.FC<PrintAiAnalysisReportButtonProps> = ({ data, mlData }) => {
  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrint = async () => {
    try {
      setIsPrinting(true);
      
      // Create a container for the report
      const reportContainer = document.createElement('div');
      
      // Render the report component to a string
      const reportContent = <AiAnalysisReport data={data} mlData={mlData} />;
      
      // Convert React component to HTML string
      // We need to use ReactDOMServer.renderToString, but since we're in the browser,
      // we'll use a workaround by rendering to a hidden div and getting its innerHTML
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      document.body.appendChild(tempDiv);
      
      // Use React's createRoot API to render the component
      const { createRoot } = await import('react-dom/client');
      const root = createRoot(tempDiv);
      
      // Render the component
      root.render(reportContent);
      
      // Wait for rendering to complete
      setTimeout(async () => {
        try {
          // Get the HTML content
          const htmlContent = tempDiv.innerHTML;
          
          // Clean up the temporary div
          root.unmount();
          document.body.removeChild(tempDiv);
          
          // Add custom print styles to enhance the report appearance
          const enhancedHtmlContent = `
            <style>
              /* Enhanced print styles */
              @page {
                size: A4;
                margin: 1.5cm;
              }
              
              body {
                font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                line-height: 1.5;
                color: #111827;
                background-color: white;
              }
              
              .ai-analysis-report {
                max-width: 100%;
              }
              
              .report-header {
                text-align: center;
                margin-bottom: 2rem;
                padding-bottom: 1rem;
                border-bottom: 2px solid #e5e7eb;
              }
              
              h1 {
                font-size: 2rem;
                color: #111827;
                margin-bottom: 0.5rem;
              }
              
              h2 {
                font-size: 1.5rem;
                color: #1f2937;
                margin-top: 2rem;
                margin-bottom: 1rem;
                padding-bottom: 0.5rem;
                border-bottom: 1px solid #e5e7eb;
              }
              
              h3 {
                font-size: 1.25rem;
                color: #374151;
                margin-bottom: 0.75rem;
              }
              
              section {
                margin-bottom: 2rem;
                page-break-inside: avoid;
              }
              
              .grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 1rem;
              }
              
              .grid-cols-2 {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 1rem;
              }
              
              .grid-cols-3 {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 1rem;
              }
              
              .grid-cols-6 {
                display: grid;
                grid-template-columns: 1fr 5fr;
                gap: 1rem;
              }
              
              .border {
                border: 1px solid #e5e7eb;
                border-radius: 0.5rem;
                padding: 1rem;
                margin-bottom: 1rem;
              }
              
              .rounded-lg {
                border-radius: 0.5rem;
              }
              
              .p-3, .p-4 {
                padding: 1rem;
              }
              
              .mb-2, .mb-3, .mb-4, .mb-6, .mb-8 {
                margin-bottom: 1rem;
              }
              
              .mt-1, .mt-2, .mt-4, .mt-6, .mt-8 {
                margin-top: 0.5rem;
              }
              
              .space-y-2, .space-y-3, .space-y-4 {
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
              }
              
              .flex {
                display: flex;
              }
              
              .justify-between {
                justify-content: space-between;
              }
              
              .items-center {
                align-items: center;
              }
              
              .font-medium, .font-semibold, .font-bold {
                font-weight: 600;
              }
              
              .text-sm {
                font-size: 0.875rem;
              }
              
              .text-xs {
                font-size: 0.75rem;
              }
              
              .text-gray-500 {
                color: #6b7280;
              }
              
              .text-red-600 {
                color: #dc2626;
              }
              
              .text-green-600 {
                color: #059669;
              }
              
              .bg-red-50 {
                background-color: #fef2f2;
              }
              
              .bg-yellow-50 {
                background-color: #fffbeb;
              }
              
              .bg-blue-50 {
                background-color: #eff6ff;
              }
              
              .bg-green-50 {
                background-color: #ecfdf5;
              }
              
              .border-t {
                border-top: 1px solid #e5e7eb;
                padding-top: 0.5rem;
              }
              
              table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 1rem;
              }
              
              th, td {
                border: 1px solid #e5e7eb;
                padding: 0.5rem;
                text-align: left;
              }
              
              th {
                background-color: #f9fafb;
                font-weight: 600;
              }
              
              /* Progress bar styling for print */
              .h-2, .h-3, .h-4 {
                height: 0.5rem;
              }
              
              .bg-gray-200, .bg-muted {
                background-color: #e5e7eb;
              }
              
              .bg-blue-600, .bg-primary {
                background-color: #2563eb;
              }
              
              .rounded-full {
                border-radius: 9999px;
              }
              
              .w-full {
                width: 100%;
              }
              
              .overflow-hidden {
                overflow: hidden;
              }
              
              /* Report footer */
              .report-footer {
                margin-top: 2rem;
                padding-top: 1rem;
                border-top: 2px solid #e5e7eb;
                text-align: center;
                font-size: 0.875rem;
                color: #6b7280;
              }
              
              /* Ensure page breaks don't occur in the middle of important content */
              tr, .border, section {
                page-break-inside: avoid;
              }
              
              h2, h3 {
                page-break-after: avoid;
              }
            </style>
            ${htmlContent}
          `;
          
          // Print the content with enhanced styling
          await printContent(enhancedHtmlContent, 'AI Analysis Report');
          
          setIsPrinting(false);
        } catch (error) {
          console.error('Error during print process:', error);
          setIsPrinting(false);
        }
      }, 500);
    } catch (error) {
      console.error('Error preparing report for printing:', error);
      setIsPrinting(false);
    }
  };

  return (
    <Button 
      onClick={handlePrint} 
      disabled={isPrinting || !data} 
      variant="outline"
      className="flex items-center gap-2"
    >
      <Printer className="h-4 w-4" />
      {isPrinting ? 'Preparing Report...' : 'Print Report'}
    </Button>
  );
};

export default PrintAiAnalysisReportButton;