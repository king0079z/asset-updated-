import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/contexts/TranslationContext';
import { Printer, QrCode, Copy, Check } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface FoodSupplyBarcodeDialogProps {
  supply: {
    id: string;
    name: string;
    unit: string;
  };
  kitchenId: string;
}

export function FoodSupplyBarcodeDialog({ supply, kitchenId }: FoodSupplyBarcodeDialogProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [barcode, setBarcode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      fetchBarcode();
    }
  }, [open, supply.id, kitchenId]);

  const fetchBarcode = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/kitchens/barcodes?foodSupplyId=${supply.id}&kitchenId=${kitchenId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.barcode) {
          setBarcode(data.barcode);
        } else {
          // If no barcode exists, generate one
          await generateBarcode();
        }
      } else {
        // If API returns error, try to generate a new barcode
        await generateBarcode();
      }
    } catch (error) {
      console.error('Error fetching barcode:', error);
      toast({
        title: t('error'),
        description: t('failed_to_fetch_barcode'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generateBarcode = async () => {
    try {
      const response = await fetch('/api/food-supply/link-barcode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          foodSupplyId: supply.id,
          kitchenId: kitchenId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setBarcode(data.barcode);
      } else {
        throw new Error('Failed to generate barcode');
      }
    } catch (error) {
      console.error('Error generating barcode:', error);
      toast({
        title: t('error'),
        description: t('failed_to_generate_barcode'),
        variant: 'destructive',
      });
    }
  };

  const printBarcode = () => {
    if (!barcode) return;

    // Create a print window
    const printWindow = window.open('', `barcode_print_${Date.now()}`, 'width=400,height=300');
    
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Food Supply Barcode</title>
            <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
            <style>
              @media print {
                @page { margin: 0; }
                body { margin: 1cm; }
              }
              .barcode-container {
                text-align: center;
                margin: 20px;
                padding: 10px;
              }
              .item-name {
                font-size: 16px;
                font-weight: bold;
                margin-bottom: 5px;
              }
              .barcode-text {
                font-family: monospace;
                font-size: 14px;
                margin: 10px 0;
              }
              .no-print {
                display: none;
              }
              @media print {
                .no-print {
                  display: none;
                }
              }
            </style>
          </head>
          <body>
            <div class="no-print" style="text-align: center; margin-bottom: 20px;">
              <h1>Food Supply Barcode</h1>
              <p>Click the button below if printing doesn't start automatically:</p>
              <button onclick="window.print()" style="padding: 10px 20px; background: #4F46E5; color: white; border: none; border-radius: 4px; cursor: pointer;">
                Print Barcode
              </button>
            </div>
            <div class="barcode-container">
              <div class="item-name">
                ${supply.name} (${supply.unit})
              </div>
              <div class="barcode-text">
                ${barcode}
              </div>
              <svg id="barcode"></svg>
            </div>
            <script>
              JsBarcode("#barcode", "${barcode}", {
                format: "CODE128",
                width: 2,
                height: 100,
                displayValue: true
              });
              
              // Print and close
              window.onload = () => {
                setTimeout(() => {
                  window.print();
                  window.onafterprint = () => window.close();
                }, 1000);
              }
            </script>
          </body>
        </html>
      `);
      
      printWindow.document.close();
    } else {
      toast({
        title: t('error'),
        description: t('failed_to_open_print_window'),
        variant: 'destructive',
      });
    }
  };

  const copyToClipboard = () => {
    if (!barcode) return;
    
    navigator.clipboard.writeText(barcode)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast({
          title: t('success'),
          description: t('barcode_copied_to_clipboard'),
        });
      })
      .catch(() => {
        toast({
          title: t('error'),
          description: t('failed_to_copy_barcode'),
          variant: 'destructive',
        });
      });
  };

  return (
    <>
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-8 w-8" 
        onClick={() => setOpen(true)}
        title={t('view_barcode')}
      >
        <QrCode className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t('food_supply_barcode')}</DialogTitle>
            <DialogDescription>
              {t('barcode_for')} {supply.name}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : barcode ? (
              <div className="flex flex-col items-center">
                <div className="text-center mb-4">
                  <p className="font-mono text-sm mb-2">{barcode}</p>
                  <div className="w-full max-w-[250px] h-[100px] bg-gray-100 flex items-center justify-center rounded-md">
                    <svg id="barcodeDisplay" className="w-full"></svg>
                  </div>
                </div>
                
                <script
                  dangerouslySetInnerHTML={{
                    __html: `
                      if (typeof JsBarcode !== 'undefined') {
                        JsBarcode("#barcodeDisplay", "${barcode}", {
                          format: "CODE128",
                          width: 2,
                          height: 80,
                          displayValue: true
                        });
                      } else {
                        console.error("JsBarcode library not loaded");
                      }
                    `,
                  }}
                />
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-muted-foreground">{t('no_barcode_available')}</p>
                <Button 
                  onClick={generateBarcode} 
                  className="mt-4"
                >
                  {t('generate_barcode')}
                </Button>
              </div>
            )}
          </div>

          <DialogFooter className="flex justify-between">
            <Button 
              variant="outline" 
              onClick={copyToClipboard}
              disabled={!barcode || isLoading}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  {t('copied')}
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  {t('copy')}
                </>
              )}
            </Button>
            <Button 
              onClick={printBarcode}
              disabled={!barcode || isLoading}
            >
              <Printer className="h-4 w-4 mr-2" />
              {t('print_barcode')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default FoodSupplyBarcodeDialog;