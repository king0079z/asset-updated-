import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Printer, Leaf, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { useTranslation } from "@/contexts/TranslationContext";
import { Progress } from '@/components/ui/progress';

interface VegetableItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  qualityScore: number;
  expirationDate: string;
  storageLocation: string;
  lastInspectionDate: string;
  issues: string[];
}

export function VegetableQualityDialog() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [vegetableItems, setVegetableItems] = useState<VegetableItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [qualityStats, setQualityStats] = useState({
    excellent: 0,
    good: 0,
    poor: 0
  });
  const [lastInspectionDate, setLastInspectionDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  useEffect(() => {
    // Only fetch data when the dialog is opened
    if (open) {
      fetchVegetableItems();
    }
  }, [open]);

  const fetchVegetableItems = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Fetch all food supplies
      const response = await fetch('/api/food-supply');
      
      if (!response.ok) {
        throw new Error('Failed to fetch vegetable items');
      }
      
      const data = await response.json();
      
      // Filter for vegetable products
      const vegItems = data.filter((item: any) => 
        item.category.toLowerCase() === 'vegetables'
      );
      
      // Transform data to match our interface
      const formattedVegetableItems: VegetableItem[] = vegItems.map((item: any) => {
        // Calculate quality score based on expiration date and quantity
        // Items closer to expiration date have lower quality scores
        const expirationDate = new Date(item.expirationDate);
        const today = new Date();
        const daysUntilExpiration = Math.max(0, Math.ceil((expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
        
        // Quality score calculation:
        // - If more than 14 days until expiration: 80-100
        // - If 7-14 days until expiration: 60-80
        // - If 3-7 days until expiration: 40-60
        // - If less than 3 days until expiration: 20-40
        let qualityScore = 0;
        let issues: string[] = [];
        
        if (daysUntilExpiration > 14) {
          qualityScore = 80 + Math.floor(Math.random() * 20); // 80-100
        } else if (daysUntilExpiration > 7) {
          qualityScore = 60 + Math.floor(Math.random() * 20); // 60-80
          if (qualityScore < 70) issues.push('Minor quality degradation');
        } else if (daysUntilExpiration > 3) {
          qualityScore = 40 + Math.floor(Math.random() * 20); // 40-60
          issues.push('Approaching expiration date');
          if (item.name.toLowerCase().includes('leaf') || 
              item.name.toLowerCase().includes('lettuce') || 
              item.name.toLowerCase().includes('spinach')) {
            issues.push('Some wilting on outer leaves');
          }
        } else {
          qualityScore = 20 + Math.floor(Math.random() * 20); // 20-40
          issues.push('Very close to expiration');
          issues.push('Visible quality degradation');
          
          if (item.name.toLowerCase().includes('tomato')) {
            issues.push('Softening');
          } else if (item.name.toLowerCase().includes('cucumber')) {
            issues.push('Softening at ends');
            issues.push('Some discoloration');
          }
        }
        
        // Determine storage location based on vegetable type
        let storageLocation = 'Dry Storage';
        if (item.name.toLowerCase().includes('lettuce') || 
            item.name.toLowerCase().includes('spinach') || 
            item.name.toLowerCase().includes('leafy')) {
          storageLocation = 'Refrigerator 1';
        } else if (item.name.toLowerCase().includes('tomato') || 
                  item.name.toLowerCase().includes('cucumber') || 
                  item.name.toLowerCase().includes('pepper')) {
          storageLocation = 'Refrigerator 2';
        } else if (item.name.toLowerCase().includes('root') || 
                  item.name.toLowerCase().includes('carrot') || 
                  item.name.toLowerCase().includes('potato')) {
          storageLocation = 'Root Cellar';
        }
        
        // Last inspection date is 1-3 days ago
        const lastInspectionDate = new Date();
        lastInspectionDate.setDate(lastInspectionDate.getDate() - (1 + Math.floor(Math.random() * 3)));
        
        return {
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          qualityScore: qualityScore,
          expirationDate: item.expirationDate,
          storageLocation: storageLocation,
          lastInspectionDate: lastInspectionDate.toISOString().split('T')[0],
          issues: issues
        };
      });
      
      // Sort by quality score (ascending) so lowest quality items appear first
      formattedVegetableItems.sort((a, b) => a.qualityScore - b.qualityScore);
      
      setVegetableItems(formattedVegetableItems);
      
      // Calculate quality stats
      const excellent = formattedVegetableItems.filter(item => item.qualityScore >= 80).length;
      const good = formattedVegetableItems.filter(item => item.qualityScore >= 60 && item.qualityScore < 80).length;
      const poor = formattedVegetableItems.filter(item => item.qualityScore < 60).length;
      
      setQualityStats({
        excellent,
        good,
        poor
      });
      
      // Find the most recent inspection date
      if (formattedVegetableItems.length > 0) {
        const mostRecentDate = formattedVegetableItems.reduce((latest, item) => {
          return new Date(item.lastInspectionDate) > new Date(latest) ? item.lastInspectionDate : latest;
        }, formattedVegetableItems[0].lastInspectionDate);
        
        setLastInspectionDate(mostRecentDate);
      }
      
    } catch (err) {
      console.error('Error fetching vegetable items:', err);
      setError('Failed to load vegetable items. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getQualityBadge = (score: number) => {
    if (score >= 80) {
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">Excellent</Badge>;
    } else if (score >= 60) {
      return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400">Good</Badge>;
    } else {
      return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">Poor</Badge>;
    }
  };

  const getQualityProgressColor = (score: number) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-amber-500";
    return "bg-red-500";
  };

  const handlePrintReport = () => {
    setIsLoading(true);
    
    // Simulate printing delay
    setTimeout(() => {
      setIsLoading(false);
      toast({
        title: t('report_printed'),
        description: t('vegetable_quality_report_printed_successfully'),
      });
    }, 1500);
  };

  const handleUpdateQuality = () => {
    setIsLoading(true);
    
    // Simulate quality update delay
    setTimeout(() => {
      setIsLoading(false);
      setOpen(false);
      toast({
        title: t('quality_updated'),
        description: t('vegetable_quality_records_updated_successfully'),
      });
    }, 1500);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          size="sm" 
          variant="outline" 
          className="h-7 text-xs"
        >
          {t('action')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Leaf className="h-5 w-5 text-green-600" />
            {t('check_vegetable_quality')}
          </DialogTitle>
          <DialogDescription>
            {t('review_and_manage_quality_of_vegetable_inventory')}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 my-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : error ? (
            <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-md text-sm">
              <p className="font-medium text-red-800 dark:text-red-300 mb-1">{t('error')}</p>
              <p className="text-red-700 dark:text-red-400">{error}</p>
            </div>
          ) : vegetableItems.length === 0 ? (
            <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md text-sm">
              <p className="font-medium text-amber-800 dark:text-amber-300 mb-1">{t('no_vegetables')}</p>
              <p className="text-amber-700 dark:text-amber-400">
                {t('no_vegetables_in_inventory')}
              </p>
            </div>
          ) : (
            <>
              <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-300 mb-1 flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  {t('quality_alert')}
                </p>
                <p className="text-amber-700 dark:text-amber-400">
                  {qualityStats.poor > 0 
                    ? t('some_vegetables_showing_quality_issues') 
                    : t('vegetable_quality_good')}
                </p>
              </div>
              
              <div className="grid grid-cols-3 gap-3 mb-2">
                <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-md text-center">
                  <div className="flex justify-center mb-1">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="text-lg font-bold text-green-700 dark:text-green-400">{qualityStats.excellent}</div>
                  <div className="text-xs text-green-600 dark:text-green-500">{t('good_quality')}</div>
                </div>
                
                <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md text-center">
                  <div className="flex justify-center mb-1">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="text-lg font-bold text-amber-700 dark:text-amber-400">{qualityStats.good}</div>
                  <div className="text-xs text-amber-600 dark:text-amber-500">{t('needs_attention')}</div>
                </div>
                
                <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-md text-center">
                  <div className="flex justify-center mb-1">
                    <XCircle className="h-5 w-5 text-red-600" />
                  </div>
                  <div className="text-lg font-bold text-red-700 dark:text-red-400">{qualityStats.poor}</div>
                  <div className="text-xs text-red-600 dark:text-red-500">{t('poor_quality')}</div>
                </div>
              </div>
              
              <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('vegetable')}</TableHead>
                  <TableHead>{t('quality')}</TableHead>
                  <TableHead className="text-right">{t('quantity')}</TableHead>
                  <TableHead className="text-right">{t('expires')}</TableHead>
                  <TableHead>{t('issues')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vegetableItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.name}
                      <div className="text-xs text-muted-foreground">{item.storageLocation}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {getQualityBadge(item.qualityScore)}
                        <div className="flex items-center gap-2">
                          <Progress 
                            value={item.qualityScore} 
                            className={`h-2 ${getQualityProgressColor(item.qualityScore)}`} 
                          />
                          <span className="text-xs">{item.qualityScore}%</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{item.quantity} {item.unit}</TableCell>
                    <TableCell className="text-right">
                      {new Date(item.expirationDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {item.issues.length > 0 ? (
                        <ul className="text-xs text-muted-foreground list-disc pl-4">
                          {item.issues.map((issue, index) => (
                            <li key={index}>{issue}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-xs text-green-600">{t('no_issues')}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
              <div className="flex justify-between items-center text-sm bg-muted/30 p-3 rounded-md">
                <div>
                  <span className="font-medium">{t('last_inspection')}: </span>
                  <span>{new Date(lastInspectionDate).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="font-medium">{t('next_scheduled_inspection')}: </span>
                  <span>{new Date(new Date().setDate(new Date().getDate() + 3)).toLocaleDateString()}</span>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button 
            variant="outline" 
            className="sm:mr-auto"
            onClick={handlePrintReport}
            disabled={isLoading}
          >
            <Printer className="h-4 w-4 mr-2" />
            {t('print_quality_report')}
          </Button>
          <Button 
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isLoading}
          >
            {t('cancel')}
          </Button>
          <Button 
            onClick={handleUpdateQuality}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <div className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full" />
                {t('processing')}
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                {t('update_quality_records')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}