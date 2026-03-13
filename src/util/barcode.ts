import JsBarcode from 'jsbarcode';
import { printContent } from './print';
import * as QRCode from 'qrcode';

export type CodeType = 'barcode' | 'qrcode';

/**
 * Generates a structured recipe barcode ID in the format: RCP-YYYYMMDD-XXXXX
 * Where:
 * - RCP: Prefix indicating it's a recipe
 * - YYYYMMDD: Current date
 * - XXXXX: Random 5-digit number
 * 
 * This format is more suitable for barcode scanning and human readability
 */
export const generateRecipeBarcodeId = () => {
  const prefix = 'RCP';
  const date = new Date();
  const dateStr = date.getFullYear().toString() +
    (date.getMonth() + 1).toString().padStart(2, '0') +
    date.getDate().toString().padStart(2, '0');
  
  // Generate a random 5-digit number
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  
  return `${prefix}-${dateStr}-${randomNum}`;
};

/**
 * Utility function to print a barcode or QR code
 * @param codeValue The value to encode in the barcode/QR code
 * @param displayText The text to display below the code (optional)
 * @param title The title to display above the code (optional)
 * @param subtitle The subtitle to display below the title (optional)
 * @param codeType The type of code to print ('barcode' or 'qrcode')
 */
export const printBarcode = async (
  codeValue: string,
  displayText?: string,
  title?: string,
  subtitle?: string,
  codeType: CodeType = 'barcode'
): Promise<void> => {
  if (!codeValue) {
    console.error('No code value provided for printing');
    return;
  }

  try {
    console.log(`Printing ${codeType}:`, { codeValue, displayText, title, subtitle });
    
    let codeDataUrl: string;
    
    if (codeType === 'barcode') {
      // Create a canvas for the barcode
      const canvas = document.createElement('canvas');
      canvas.width = 300; // Set explicit width
      canvas.height = 150; // Set explicit height
      
      // Generate the barcode on the canvas
      try {
        JsBarcode(canvas, codeValue, {
          format: "CODE128",
          lineColor: "#000",
          width: 2,
          height: 100,
          displayValue: true,
          text: displayText || codeValue,
          fontSize: 16,
          margin: 10,
          background: "#fff"
        });
        console.log('Barcode generated successfully on canvas');
        codeDataUrl = canvas.toDataURL('image/png');
      } catch (barcodeError) {
        console.error('Error generating barcode with JsBarcode:', barcodeError);
        throw barcodeError;
      }
    } else {
      // Generate QR code
      try {
        codeDataUrl = await QRCode.toDataURL(codeValue, {
          width: 300,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#ffffff',
          },
        });
        console.log('QR code generated successfully');
      } catch (qrError) {
        console.error('Error generating QR code:', qrError);
        throw qrError;
      }
    }
    
    // Create HTML content for the code - using vertical layout for consistency with batch printing
    const codeHtml = `
      <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 20px;">
        <div style="display: flex; flex-direction: column; gap: 20px;">
          <div style="max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #ccc; border-radius: 5px; background-color: white; page-break-inside: avoid;">
            ${title ? `<h1 style="font-size: 18px; margin-bottom: 5px; color: black;">${title}</h1>` : ''}
            ${subtitle ? `<div style="font-size: 14px; color: #666; margin-bottom: 20px;">${subtitle}</div>` : ''}
            <img src="${codeDataUrl}" alt="${codeType === 'barcode' ? 'Barcode' : 'QR Code'}" style="max-width: 100%; height: auto; margin: 20px 0; display: block; margin-left: auto; margin-right: auto;" />
            <div style="font-size: 16px; margin-top: 10px; font-weight: bold; color: black;">${displayText || codeValue}</div>
          </div>
        </div>
      </div>
    `;
    
    // Use our improved print utility
    printContent(codeHtml, title || `${codeType === 'barcode' ? 'Barcode' : 'QR Code'} Print`)
      .then(() => {
        console.log(`${codeType === 'barcode' ? 'Barcode' : 'QR Code'} printed successfully`);
      })
      .catch((error) => {
        console.error(`Error printing ${codeType}:`, error);
        alert(`There was an error printing the ${codeType === 'barcode' ? 'barcode' : 'QR code'}. Please try again.`);
      });
    
  } catch (error) {
    console.error(`Error in print${codeType === 'barcode' ? 'Barcode' : 'QRCode'} function:`, error);
    alert(`There was an error generating the ${codeType === 'barcode' ? 'barcode' : 'QR code'} for printing. Please try again.`);
  }
};

/**
 * Utility function to generate a base64 barcode image
 * @param codeValue The value to encode in the barcode
 * @param displayText The text to display below the barcode (optional)
 * @param codeType The type of code to generate ('barcode' or 'qrcode')
 * @returns Promise that resolves to a base64 encoded image
 */
export const generateCodeImage = async (
  codeValue: string,
  displayText?: string,
  codeType: CodeType = 'barcode'
): Promise<string> => {
  try {
    if (codeType === 'barcode') {
      // Create a canvas element
      const canvas = document.createElement('canvas');
      
      // Generate the barcode on the canvas
      JsBarcode(canvas, codeValue, {
        format: "CODE128",
        lineColor: "#000",
        width: 2,
        height: 100,
        displayValue: !!displayText,
        text: displayText || '',
        fontSize: 16,
        margin: 10,
        background: "#fff"
      });
      
      // Convert the canvas to a base64 image
      return canvas.toDataURL('image/png').split(',')[1];
    } else {
      // Generate QR code
      const qrDataUrl = await QRCode.toDataURL(codeValue, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
      
      // Return the base64 part of the data URL
      return qrDataUrl.split(',')[1];
    }
  } catch (error) {
    console.error(`Error generating ${codeType} image:`, error);
    throw error;
  }
};