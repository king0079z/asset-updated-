/**
 * Utility functions for printing reports and other content
 */

/**
 * Creates a print window with the provided HTML content and prints it
 * 
 * @param content HTML content to print
 * @param title Title for the print window
 * @returns Promise that resolves when printing is complete or rejects on error
 */
export const printContent = (content: string, title: string = 'Print'): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      console.log("Print content called with content length:", content?.length || 0);
      
      // Create a blob with the HTML content
      const blob = new Blob([`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${title}</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              @page { 
                size: A4;
                margin: 1.5cm; 
              }
              
              body { 
                font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                margin: 0;
                padding: 20px;
                color: #000;
                background-color: #fff;
                visibility: visible !important;
                display: block !important;
                width: 100%;
                max-width: 100%;
                line-height: 1.5;
              }
              
              /* Base styles for all elements */
              h1, h2, h3, h4, h5, h6 {
                margin-top: 0;
                color: #111827;
                page-break-after: avoid;
              }
              
              h1 {
                font-size: 2rem;
                margin-bottom: 0.5rem;
                text-align: center;
              }
              
              h2 {
                font-size: 1.5rem;
                margin-top: 2rem;
                margin-bottom: 1rem;
                padding-bottom: 0.5rem;
                border-bottom: 1px solid #e5e7eb;
              }
              
              h3 {
                font-size: 1.25rem;
                margin-bottom: 0.75rem;
              }
              
              p {
                margin-bottom: 1em;
              }
              
              section {
                margin-bottom: 2rem;
                page-break-inside: avoid;
              }
              
              table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 1.5rem;
              }
              
              th, td {
                border: 1px solid #e5e7eb;
                padding: 8px;
                text-align: left;
              }
              
              th {
                background-color: #f9fafb;
                font-weight: 600;
              }
              
              .bg-gray-50, .bg-gray-100 {
                background-color: #f9fafb !important;
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
              
              .p-4, .p-5, .p-6, .p-8, .p-3 {
                padding: 1rem;
              }
              
              .mb-4, .mb-6, .mb-8, .mb-2, .mb-3 {
                margin-bottom: 1rem;
              }
              
              .mt-1, .mt-2, .mt-4, .mt-6, .mt-8 {
                margin-top: 0.5rem;
              }
              
              .font-bold, .font-semibold, .font-medium {
                font-weight: 600;
              }
              
              .text-gray-500 {
                color: #6b7280;
              }
              
              .text-gray-900 {
                color: #111827;
              }
              
              .text-sm {
                font-size: 0.875rem;
              }
              
              .text-xs {
                font-size: 0.75rem;
              }
              
              .text-red-600 {
                color: #dc2626;
              }
              
              .text-green-600 {
                color: #059669;
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
              
              /* Specific color classes */
              .bg-blue-50 { background-color: #eff6ff !important; }
              .bg-green-50 { background-color: #ecfdf5 !important; }
              .bg-red-50 { background-color: #fef2f2 !important; }
              .bg-yellow-50 { background-color: #fffbeb !important; }
              .bg-purple-50 { background-color: #f5f3ff !important; }
              
              .text-blue-700, .text-blue-800, .text-blue-900 { color: #1e40af !important; }
              .text-green-700, .text-green-800, .text-green-900 { color: #065f46 !important; }
              .text-red-700, .text-red-800, .text-red-900 { color: #991b1b !important; }
              .text-yellow-700, .text-yellow-800, .text-yellow-900 { color: #854d0e !important; }
              .text-purple-700, .text-purple-800, .text-purple-900 { color: #5b21b6 !important; }
              
              /* Border colors */
              .border-blue-100, .border-blue-200 { border-color: #dbeafe !important; }
              .border-green-100, .border-green-200 { border-color: #d1fae5 !important; }
              .border-red-100, .border-red-200 { border-color: #fee2e2 !important; }
              .border-yellow-100, .border-yellow-200 { border-color: #fef3c7 !important; }
              .border-purple-100, .border-purple-200 { border-color: #ede9fe !important; }
              .border-gray-100, .border-gray-200, .border-gray-300 { border-color: #e5e7eb !important; }
              
              .border-t {
                border-top: 1px solid #e5e7eb;
                padding-top: 0.5rem;
              }
              
              /* Progress bar styling for print */
              .h-2, .h-3, .h-4 {
                height: 0.5rem;
              }
              
              .bg-gray-200, .bg-muted {
                background-color: #e5e7eb !important;
              }
              
              .bg-blue-600, .bg-primary {
                background-color: #2563eb !important;
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
              
              /* Report header and footer */
              .report-header {
                text-align: center;
                margin-bottom: 2rem;
                padding-bottom: 1rem;
                border-bottom: 2px solid #e5e7eb;
              }
              
              .report-footer {
                margin-top: 2rem;
                padding-top: 1rem;
                border-top: 2px solid #e5e7eb;
                text-align: center;
                font-size: 0.875rem;
                color: #6b7280;
              }
              
              /* Make sure all content is visible */
              * {
                visibility: visible !important;
                opacity: 1 !important;
              }
              
              @media print {
                body {
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                  color-adjust: exact !important;
                }
                
                /* Ensure background colors print properly */
                * {
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                  color-adjust: exact !important;
                  visibility: visible !important;
                  opacity: 1 !important;
                }
                
                /* Improve table borders for printing */
                table {
                  border-collapse: collapse;
                  width: 100%;
                }
                
                th, td {
                  border: 1px solid #e5e7eb;
                }
                
                /* Ensure page breaks don't occur in the middle of important content */
                tr, .border, section {
                  page-break-inside: avoid;
                }
                
                h2, h3 {
                  page-break-after: avoid;
                }
              }
            </style>
          </head>
          <body>
            ${content}
          </body>
        </html>
      `], { type: 'text/html' });
      
      // Create a URL for the blob
      const blobUrl = URL.createObjectURL(blob);
      
      // Open a new window with the blob URL
      const printWindow = window.open(blobUrl, '_blank', 'width=800,height=600');
      
      if (!printWindow) {
        throw new Error('Could not open print window. Please check your popup blocker settings.');
      }
      
      // Set up event handlers
      printWindow.onload = () => {
        console.log("Print window loaded");
        
        // Wait a moment to ensure everything is rendered
        setTimeout(() => {
          try {
            // Trigger print
            printWindow.print();
            
            // Set up a listener for after printing
            printWindow.onafterprint = () => {
              console.log("Printing completed");
              // Clean up the blob URL
              URL.revokeObjectURL(blobUrl);
              // Close the window after printing
              setTimeout(() => {
                printWindow.close();
              }, 500);
              resolve();
            };
            
            // Fallback in case onafterprint doesn't fire
            setTimeout(() => {
              URL.revokeObjectURL(blobUrl);
              resolve();
            }, 5000);
          } catch (printError) {
            console.error("Error during print operation:", printError);
            URL.revokeObjectURL(blobUrl);
            reject(printError);
          }
        }, 1500); // Increased timeout for better rendering
      };
      
      // Fallback in case onload doesn't fire
      setTimeout(() => {
        try {
          if (printWindow) {
            printWindow.print();
            URL.revokeObjectURL(blobUrl);
          }
          resolve();
        } catch (timeoutError) {
          console.error("Timeout error during print operation:", timeoutError);
          URL.revokeObjectURL(blobUrl);
          reject(timeoutError);
        }
      }, 4000); // Increased timeout for slower browsers
      
    } catch (error) {
      console.error('Error setting up print window:', error);
      reject(error);
    }
  });
};

/**
 * Alternative print method that uses an iframe for better compatibility
 * with some browsers that have issues with window.open()
 * 
 * @param content HTML content to print
 * @param title Title for the print window
 * @returns Promise that resolves when printing is complete or rejects on error
 */
export const printContentWithIframe = (content: string, title: string = 'Print'): Promise<void> => {
  // Remove any existing print iframes to prevent conflicts
  const existingIframes = document.querySelectorAll('iframe.print-frame');
  existingIframes.forEach(iframe => {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe);
    }
  });
  return new Promise((resolve, reject) => {
    try {
      console.log("Print with iframe called with content length:", content?.length || 0);
      
      // Create a hidden iframe
      const iframe = document.createElement('iframe');
      iframe.className = 'print-frame';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      
      // Add the iframe to the document
      document.body.appendChild(iframe);
      
      // Get the iframe document
      const iframeDoc = iframe.contentWindow?.document;
      
      if (!iframeDoc) {
        throw new Error('Could not access iframe document');
      }
      
      // Write the content to the iframe
      iframeDoc.open();
      iframeDoc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${title}</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              @page { 
                size: A4;
                margin: 1.5cm; 
              }
              
              body { 
                font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                margin: 0;
                padding: 20px;
                color: #000;
                background-color: #fff;
                visibility: visible !important;
                display: block !important;
                width: 100%;
                max-width: 100%;
              }
              
              /* Base styles for all elements */
              h1, h2, h3, h4, h5, h6 {
                margin-top: 0;
                color: #111827;
              }
              
              p {
                margin-bottom: 1em;
              }
              
              table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 1em;
              }
              
              th, td {
                border: 1px solid #e5e7eb;
                padding: 8px;
                text-align: left;
              }
              
              th {
                background-color: #f9fafb;
                font-weight: 600;
              }
              
              .bg-gray-50, .bg-gray-100 {
                background-color: #f9fafb !important;
              }
              
              .border {
                border: 1px solid #e5e7eb;
              }
              
              .rounded-lg {
                border-radius: 0.5rem;
              }
              
              .p-4, .p-5, .p-6, .p-8 {
                padding: 1rem;
              }
              
              .mb-4, .mb-6, .mb-8 {
                margin-bottom: 1rem;
              }
              
              .font-bold {
                font-weight: 700;
              }
              
              .text-gray-500 {
                color: #6b7280;
              }
              
              .text-gray-900 {
                color: #111827;
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
              
              /* Specific color classes */
              .bg-blue-50 { background-color: #eff6ff; }
              .bg-green-50 { background-color: #ecfdf5; }
              .bg-red-50 { background-color: #fef2f2; }
              .bg-yellow-50 { background-color: #fffbeb; }
              .bg-purple-50 { background-color: #f5f3ff; }
              
              .text-blue-700, .text-blue-800, .text-blue-900 { color: #1e40af; }
              .text-green-700, .text-green-800, .text-green-900 { color: #065f46; }
              .text-red-700, .text-red-800, .text-red-900 { color: #991b1b; }
              .text-yellow-700, .text-yellow-800, .text-yellow-900 { color: #854d0e; }
              .text-purple-700, .text-purple-800, .text-purple-900 { color: #5b21b6; }
              
              /* Border colors */
              .border-blue-100, .border-blue-200 { border-color: #dbeafe; }
              .border-green-100, .border-green-200 { border-color: #d1fae5; }
              .border-red-100, .border-red-200 { border-color: #fee2e2; }
              .border-yellow-100, .border-yellow-200 { border-color: #fef3c7; }
              .border-purple-100, .border-purple-200 { border-color: #ede9fe; }
              .border-gray-100, .border-gray-200, .border-gray-300 { border-color: #e5e7eb; }
              
              /* Make sure all content is visible */
              * {
                visibility: visible !important;
                opacity: 1 !important;
              }
              
              @media print {
                body {
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                  color-adjust: exact !important;
                }
                
                /* Ensure background colors print properly */
                * {
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                  color-adjust: exact !important;
                  visibility: visible !important;
                  opacity: 1 !important;
                }
                
                /* Improve table borders for printing */
                table {
                  border-collapse: collapse;
                  width: 100%;
                }
                
                th, td {
                  border: 1px solid #e5e7eb;
                }
                
                /* Ensure page breaks don't occur in the middle of important content */
                tr, .card, .section {
                  page-break-inside: avoid;
                }
                
                h2, h3 {
                  page-break-after: avoid;
                }
              }
            </style>
          </head>
          <body>
            ${content}
            <script>
              // Print automatically when content is loaded
              window.onload = function() {
                // Wait for all resources to load
                setTimeout(function() {
                  try {
                    window.print();
                    // Set up a listener for after printing
                    window.onafterprint = function() {
                      console.log("Printing completed in iframe");
                    };
                  } catch (e) {
                    console.error("Error in iframe print:", e);
                  }
                }, 1000);
              };
            </script>
          </body>
        </html>
      `);
      iframeDoc.close();
      
      // Set up event handlers for the iframe window
      const iframeWindow = iframe.contentWindow;
      if (iframeWindow) {
        iframeWindow.onload = () => {
          console.log("Iframe loaded");
          
          // Wait a moment to ensure everything is rendered
          setTimeout(() => {
            try {
              // Trigger print
              iframeWindow.print();
              
              // Set up a listener for after printing
              iframeWindow.onafterprint = () => {
                console.log("Printing completed");
                // Remove the iframe after printing
                document.body.removeChild(iframe);
                resolve();
              };
              
              // Fallback in case onafterprint doesn't fire
              setTimeout(() => {
                if (document.body.contains(iframe)) {
                  document.body.removeChild(iframe);
                }
                resolve();
              }, 5000);
            } catch (printError) {
              console.error("Error during iframe print operation:", printError);
              if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
              }
              reject(printError);
            }
          }, 1500);
        };
        
        // Fallback in case onload doesn't fire
        setTimeout(() => {
          try {
            iframeWindow.print();
            setTimeout(() => {
              if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
              }
              resolve();
            }, 1000);
          } catch (timeoutError) {
            console.error("Timeout error during iframe print operation:", timeoutError);
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
            reject(timeoutError);
          }
        }, 4000);
      } else {
        throw new Error('Could not access iframe window');
      }
      
    } catch (error) {
      console.error('Error setting up iframe for printing:', error);
      reject(error);
    }
  });
};

/**
 * Prints the current document content
 * This is useful for components that have their own print styling
 */
export const printCurrentPage = (): void => {
  window.print();
};