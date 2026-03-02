/**
 * Utility functions for printing reports
 */

/**
 * Prints a report with proper styling
 * @param reportId The ID of the element containing the report to print
 * @param title The title of the report (for the print window)
 * @param additionalStyles Optional additional CSS styles to include
 * @returns Promise that resolves when printing is complete or rejects on error
 */
export const printReport = (
  reportId: string,
  title: string,
  additionalStyles?: string
): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      // Get the report content
      const reportContent = document.getElementById(reportId);
      if (!reportContent) {
        throw new Error(`Report content with ID "${reportId}" not found`);
      }
      
      // Create a new window for printing
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        throw new Error('Could not open print window. Please check your popup blocker settings.');
      }
      
      // Base styles for all reports
      const baseStyles = `
        @page {
          size: A4;
          margin: 1.5cm;
        }
        body {
          font-family: Arial, sans-serif;
          line-height: 1.5;
          color: #333;
          margin: 0;
          padding: 0;
          background-color: white;
        }
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .page-break-before {
          page-break-before: always;
        }
        .page-break-after {
          page-break-after: always;
        }
        .avoid-break {
          page-break-inside: avoid;
        }
      `;
      
      // Write the HTML to the new window
      printWindow.document.write(`
        <html>
          <head>
            <title>${title}</title>
            <style>
              ${baseStyles}
              ${additionalStyles || ''}
            </style>
          </head>
          <body>
            <div id="print-content"></div>
            <script>
              window.onload = function() {
                window.print();
                window.setTimeout(function() {
                  window.close();
                  window.opener.postMessage('print-complete', '*');
                }, 500);
              };
            </script>
          </body>
        </html>
      `);
      
      // Clone the report content and append it to the print window
      const contentClone = reportContent.cloneNode(true);
      const printContent = printWindow.document.getElementById('print-content');
      if (printContent) {
        // Make sure the content is visible in the print window
        const importedNode = printWindow.document.importNode(contentClone, true);
        
        // Ensure all elements are visible
        const allElements = (importedNode as Element).querySelectorAll('*');
        allElements.forEach(el => {
          if (el instanceof HTMLElement) {
            // Remove any display:none styles
            if (el.style.display === 'none') {
              el.style.display = '';
            }
            // Remove any visibility:hidden styles
            if (el.style.visibility === 'hidden') {
              el.style.visibility = 'visible';
            }
            // Remove any opacity:0 styles
            if (el.style.opacity === '0') {
              el.style.opacity = '1';
            }
          }
        });
        
        printContent.appendChild(importedNode);
      } else {
        throw new Error('Print content container not found in print window');
      }
      
      printWindow.document.close();
      
      // Listen for a message indicating printing is complete
      const messageHandler = (event: MessageEvent) => {
        if (event.data === 'print-complete') {
          window.removeEventListener('message', messageHandler);
          resolve();
        }
      };
      
      window.addEventListener('message', messageHandler);
      
      // Fallback in case the message event doesn't fire
      setTimeout(() => {
        window.removeEventListener('message', messageHandler);
        resolve();
      }, 5000);
      
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Adds page numbers to a printed document
 * This should be called after the document has been rendered but before printing
 * @param selector The CSS selector for elements that should display page numbers
 * @param printWindow The window object of the print window
 */
export const addPageNumbers = (selector: string, printWindow: Window): void => {
  const elements = printWindow.document.querySelectorAll(selector);
  
  if (elements.length === 0) return;
  
  // Add script to number pages during printing
  const script = printWindow.document.createElement('script');
  script.textContent = `
    (function() {
      const elements = document.querySelectorAll('${selector}');
      if (!elements.length) return;
      
      // Function to update page numbers
      const updatePageNumbers = () => {
        elements.forEach((el, i) => {
          el.textContent = 'Page ' + (i + 1) + ' of ' + elements.length;
        });
      };
      
      // Update initially and when printing
      updatePageNumbers();
      window.onbeforeprint = updatePageNumbers;
    })();
  `;
  
  printWindow.document.body.appendChild(script);
};