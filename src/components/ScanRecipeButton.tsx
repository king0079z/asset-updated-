import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScanLine } from 'lucide-react';
import { RecipeScannerDialog } from './RecipeScannerDialog';
import { useTranslation } from "@/contexts/TranslationContext";

interface ScanRecipeButtonProps {
  kitchenId: string;
  onScanComplete?: () => void;
}

export function ScanRecipeButton({ kitchenId, onScanComplete }: ScanRecipeButtonProps) {
  const [showScanner, setShowScanner] = useState(false);
  const { t } = useTranslation();

  return (
    <>
      <Button 
        variant="outline" 
        className="bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200"
        onClick={() => setShowScanner(true)}
      >
        <ScanLine className="h-4 w-4 mr-2" />
        {t('scan_recipe')}
      </Button>

      <RecipeScannerDialog 
        kitchenId={kitchenId} 
        open={showScanner}
        onOpenChange={setShowScanner}
        onScanComplete={onScanComplete}
      />
    </>
  );
}