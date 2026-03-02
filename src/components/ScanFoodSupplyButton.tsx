import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScanLine } from 'lucide-react';
import EnhancedBarcodeScanner from './EnhancedBarcodeScanner';
import { useTranslation } from "@/contexts/TranslationContext";

interface ScanFoodSupplyButtonProps {
  kitchenId: string;
  onScanComplete?: () => void;
}

export function ScanFoodSupplyButton({ kitchenId, onScanComplete }: ScanFoodSupplyButtonProps) {
  const [showScanner, setShowScanner] = useState(false);
  const { t } = useTranslation();

  return (
    <>
      <Button 
        variant="outline" 
        className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200"
        onClick={() => setShowScanner(true)}
      >
        <ScanLine className="h-4 w-4 mr-2" />
        {t('scan_food_supply')}
      </Button>

      <EnhancedBarcodeScanner 
        kitchenId={kitchenId} 
        open={showScanner}
        onOpenChange={setShowScanner}
        onScanComplete={onScanComplete}
      />
    </>
  );
}