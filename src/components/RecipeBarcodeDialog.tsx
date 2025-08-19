import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "@/contexts/TranslationContext";
import { Barcode, QrCode, Printer, Copy, RefreshCw, AlertCircle } from "lucide-react";
import { printBarcode, CodeType } from '@/util/barcode';
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Recipe {
  id: string;
  name: string;
  description?: string;
}

interface RecipeBarcodeDialogProps {
  recipe: Recipe;
  onRecipeUpdate?: (updatedRecipe: Recipe) => void;
}

export function RecipeBarcodeDialog({ recipe, onRecipeUpdate }: RecipeBarcodeDialogProps) {
  const [barcodeUrl, setBarcodeUrl] = useState<string>('');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [currentRecipe, setCurrentRecipe] = useState<Recipe>(recipe);
  const { toast } = useToast();
  const { t } = useTranslation();

  // Check if the recipe ID is in the new format (starts with RCP-)
  const isNewFormat = currentRecipe.id.startsWith('RCP-');

  const generateCodes = useCallback(async (recipeId: string) => {
    setIsLoading(true);
    try {
      // Generate barcode
      const barcodeCanvas = document.createElement('canvas');
      const JsBarcode = (await import('jsbarcode')).default;
      JsBarcode(barcodeCanvas, recipeId, {
        format: "CODE128",
        lineColor: "#000",
        width: 2,
        height: 100,
        displayValue: true,
        fontSize: 14,
        margin: 10,
        background: "#fff"
      });
      setBarcodeUrl(barcodeCanvas.toDataURL('image/png'));
      
      // Generate QR code
      const QRCode = await import('qrcode');
      const qrUrl = await QRCode.toDataURL(recipeId, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
      setQrCodeUrl(qrUrl);
    } catch (error) {
      console.error('Error generating codes:', error);
      toast({
        title: t('error'),
        description: t('failed_to_generate_codes'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, t]);

  useEffect(() => {
    if (!recipe) return;
    setCurrentRecipe(recipe);
    generateCodes(recipe.id);
  }, [recipe, generateCodes]);

  const handlePrintCode = (codeType: CodeType) => {
    printBarcode(
      currentRecipe.id,
      currentRecipe.name,
      t('recipe_code'),
      currentRecipe.description || '',
      codeType
    );
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(currentRecipe.id)
      .then(() => {
        toast({
          title: t('success'),
          description: t('recipe_id_copied_to_clipboard'),
        });
      })
      .catch((error) => {
        console.error('Error copying to clipboard:', error);
        toast({
          title: t('error'),
          description: t('failed_to_copy_to_clipboard'),
          variant: "destructive",
        });
      });
  };

  const handleRegenerateBarcode = async () => {
    setIsRegenerating(true);
    try {
      const response = await fetch('/api/recipes/regenerate-barcode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipeId: currentRecipe.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to regenerate barcode');
      }

      const data = await response.json();
      
      // Update the current recipe with the new ID
      const updatedRecipe = {
        ...currentRecipe,
        id: data.recipe.id,
      };
      
      setCurrentRecipe(updatedRecipe);
      
      // Generate new codes with the new ID
      await generateCodes(data.recipe.id);
      
      // Notify parent component if callback provided
      if (onRecipeUpdate) {
        onRecipeUpdate(updatedRecipe);
      }
      
      toast({
        title: t('success'),
        description: t('recipe_barcode_regenerated'),
      });
    } catch (error) {
      console.error('Error regenerating barcode:', error);
      toast({
        title: t('error'),
        description: error instanceof Error ? error.message : t('failed_to_regenerate_barcode'),
        variant: "destructive",
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Barcode className="h-4 w-4 mr-2" />
          {t('view_codes')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('recipe_codes')}</DialogTitle>
          <DialogDescription>
            {t('scan_these_codes_to_record_recipe_usage')}
          </DialogDescription>
        </DialogHeader>
        
        {!isNewFormat && (
          <Alert variant="warning" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {t('old_barcode_format_detected')}. {t('consider_regenerating_barcode')}
            </AlertDescription>
          </Alert>
        )}
        
        <Tabs defaultValue="barcode" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="barcode">
              <Barcode className="h-4 w-4 mr-2" />
              {t('barcode')}
            </TabsTrigger>
            <TabsTrigger value="qrcode">
              <QrCode className="h-4 w-4 mr-2" />
              {t('qr_code')}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="barcode" className="mt-4">
            <Card>
              <CardContent className="pt-6 flex flex-col items-center">
                <h3 className="font-medium mb-2">{currentRecipe.name}</h3>
                {isLoading ? (
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                ) : (
                  <>
                    <div className="mb-2">
                      <p className="text-sm text-muted-foreground mb-2">
                        {t('recipe_id')}:
                      </p>
                      <p className="text-sm font-mono bg-gray-100 p-2 rounded mb-3 overflow-x-auto">
                        {currentRecipe.id}
                      </p>
                    </div>
                    <div className="mb-4">
                      <img src={barcodeUrl} alt="Barcode" className="max-w-full" />
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2 justify-center">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handlePrintCode('barcode')}
                      >
                        <Printer className="h-4 w-4 mr-2" />
                        {t('print')}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleCopyCode}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        {t('copy_id')}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="qrcode" className="mt-4">
            <Card>
              <CardContent className="pt-6 flex flex-col items-center">
                <h3 className="font-medium mb-2">{currentRecipe.name}</h3>
                {isLoading ? (
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                ) : (
                  <>
                    <div className="mb-2">
                      <p className="text-sm text-muted-foreground mb-2">
                        {t('recipe_id')}:
                      </p>
                      <p className="text-sm font-mono bg-gray-100 p-2 rounded mb-3 overflow-x-auto">
                        {currentRecipe.id}
                      </p>
                    </div>
                    <div className="mb-4">
                      <img src={qrCodeUrl} alt="QR Code" className="max-w-full" />
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2 justify-center">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handlePrintCode('qrcode')}
                      >
                        <Printer className="h-4 w-4 mr-2" />
                        {t('print')}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleCopyCode}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        {t('copy_id')}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        
        <DialogFooter className="mt-4">
          <Button
            variant={isNewFormat ? "outline" : "default"}
            onClick={handleRegenerateBarcode}
            disabled={isRegenerating}
            className="w-full"
          >
            {isRegenerating ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {t('regenerate_barcode')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}