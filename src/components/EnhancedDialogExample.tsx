import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface EnhancedDialogExampleProps {
  variant?: 'default' | 'detailed' | 'fullscreen';
}

export function EnhancedDialogExample({ variant = 'default' }: EnhancedDialogExampleProps) {
  const [open, setOpen] = React.useState(false);

  const getDialogContent = () => {
    switch (variant) {
      case 'detailed':
        return (
          <div className="space-y-4">
            <p>
              This is a detailed dialog with more content to demonstrate scrolling and layout capabilities.
              The enhanced dialog component now includes several new features:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Fullscreen toggle - expand the dialog to fill the entire screen</li>
              <li>Copy to clipboard - easily copy the content of the dialog</li>
              <li>Share functionality - share the content via the Web Share API (if available)</li>
              <li>Improved print functionality - with loading indicator</li>
              <li>Better mobile responsiveness</li>
              <li>Enhanced visual design with proper spacing and layout</li>
            </ul>
            <div className="rounded-md bg-muted p-4 mt-4">
              <h3 className="text-sm font-medium mb-2">Sample Data</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>Vehicle ID:</div>
                <div>VEH-2023-0042</div>
                <div>Status:</div>
                <div>Active</div>
                <div>Location:</div>
                <div>Warehouse B</div>
                <div>Last Updated:</div>
                <div>2025-03-24 14:30</div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              This dialog demonstrates the enhanced UI with better spacing, typography, and visual hierarchy.
              The buttons in the footer are properly aligned and responsive.
            </p>
          </div>
        );
      
      case 'fullscreen':
        return (
          <div className="space-y-6">
            <p>
              This dialog is designed to work well in fullscreen mode. Try clicking the fullscreen button in the top right corner.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-lg border border-border/40 p-4">
                <h3 className="text-base font-medium mb-2">Vehicle Statistics</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Total Distance</span>
                    <span className="font-medium">1,245 km</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Fuel Consumption</span>
                    <span className="font-medium">8.7 L/100km</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Maintenance Cost</span>
                    <span className="font-medium">$1,850</span>
                  </div>
                </div>
              </div>
              
              <div className="rounded-lg border border-border/40 p-4">
                <h3 className="text-base font-medium mb-2">Usage Analytics</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Utilization Rate</span>
                    <span className="font-medium">78%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Average Trip Length</span>
                    <span className="font-medium">42 km</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Idle Time</span>
                    <span className="font-medium">14%</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="rounded-lg border border-border/40 p-4">
              <h3 className="text-base font-medium mb-3">Monthly Usage Trend</h3>
              <div className="h-40 flex items-end space-x-2">
                {[35, 42, 58, 48, 62, 38, 45, 53, 56, 72, 63, 40].map((value, index) => (
                  <div 
                    key={index} 
                    className="bg-primary/80 hover:bg-primary transition-all rounded-t w-full"
                    style={{ height: `${value}%` }}
                    title={`Month ${index + 1}: ${value}%`}
                  />
                ))}
              </div>
              <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                <span>Jan</span>
                <span>Feb</span>
                <span>Mar</span>
                <span>Apr</span>
                <span>May</span>
                <span>Jun</span>
                <span>Jul</span>
                <span>Aug</span>
                <span>Sep</span>
                <span>Oct</span>
                <span>Nov</span>
                <span>Dec</span>
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground">
              This example demonstrates how the dialog can be used to display complex data visualizations
              and reports that benefit from the additional screen space in fullscreen mode.
            </p>
          </div>
        );
      
      default:
        return (
          <p>
            This is a basic dialog example showcasing the enhanced UI. The dialog now has improved
            visual design and additional features like copy, share, print, and fullscreen options.
          </p>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Open {variant} Dialog</Button>
      </DialogTrigger>
      <DialogContent 
        showPrintButton 
        showCopyButton 
        showShareButton 
        showFullscreenButton
        title={`Enhanced ${variant.charAt(0).toUpperCase() + variant.slice(1)} Dialog`}
        description="This dialog demonstrates the improved UI and additional features"
      >
        <DialogHeader>
          <DialogTitle>Enhanced Dialog Example</DialogTitle>
          <DialogDescription>
            Showcasing the new dialog features and improved UI
          </DialogDescription>
        </DialogHeader>
        
        {getDialogContent()}
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => setOpen(false)}>Continue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}