import React from 'react';
import { EnhancedDialogExample } from '@/components/EnhancedDialogExample';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function DialogShowcasePage() {
  return (
    <DashboardLayout>
      <div className="container mx-auto py-6 space-y-8">
        <div className="flex flex-col space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Enhanced Dialog Component</h1>
          <p className="text-muted-foreground">
            Showcasing the improved dialog UI with new features and better user experience
          </p>
        </div>

        <Tabs defaultValue="examples" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:w-auto md:grid-cols-3">
            <TabsTrigger value="examples">Examples</TabsTrigger>
            <TabsTrigger value="features">Features</TabsTrigger>
            <TabsTrigger value="usage">Usage</TabsTrigger>
          </TabsList>
          
          <TabsContent value="examples" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Basic Dialog</CardTitle>
                  <CardDescription>Simple dialog with enhanced UI</CardDescription>
                </CardHeader>
                <CardContent>
                  <EnhancedDialogExample variant="default" />
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Detailed Dialog</CardTitle>
                  <CardDescription>Dialog with more content and details</CardDescription>
                </CardHeader>
                <CardContent>
                  <EnhancedDialogExample variant="detailed" />
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Fullscreen Dialog</CardTitle>
                  <CardDescription>Dialog optimized for fullscreen view</CardDescription>
                </CardHeader>
                <CardContent>
                  <EnhancedDialogExample variant="fullscreen" />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="features" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>New Dialog Features</CardTitle>
                <CardDescription>Enhancements added to the dialog component</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Visual Improvements</h3>
                    <ul className="list-disc pl-5 space-y-2">
                      <li>Enhanced header with title and description</li>
                      <li>Better spacing and layout</li>
                      <li>Improved mobile responsiveness</li>
                      <li>Subtle animations and transitions</li>
                      <li>Proper border and shadow styling</li>
                    </ul>
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Functional Improvements</h3>
                    <ul className="list-disc pl-5 space-y-2">
                      <li>Fullscreen toggle capability</li>
                      <li>Copy to clipboard functionality</li>
                      <li>Web Share API integration</li>
                      <li>Enhanced print with loading indicator</li>
                      <li>Better accessibility with ARIA attributes</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="usage" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>How to Use the Enhanced Dialog</CardTitle>
                <CardDescription>Implementation examples and props</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-2">Basic Usage</h3>
                    <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm">
{`<Dialog>
  <DialogTrigger asChild>
    <Button>Open Dialog</Button>
  </DialogTrigger>
  <DialogContent 
    showPrintButton 
    showCopyButton 
    showShareButton 
    showFullscreenButton
    title="Dialog Title"
    description="Optional dialog description"
  >
    <p>Dialog content goes here</p>
    
    <DialogFooter>
      <Button variant="outline">Cancel</Button>
      <Button>Continue</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>`}
                    </pre>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-medium mb-2">Available Props</h3>
                    <div className="border rounded-md divide-y">
                      <div className="grid grid-cols-3 p-3 text-sm">
                        <div className="font-medium">Prop</div>
                        <div className="font-medium">Type</div>
                        <div className="font-medium">Description</div>
                      </div>
                      
                      <div className="grid grid-cols-3 p-3 text-sm">
                        <div className="font-medium">showPrintButton</div>
                        <div>boolean</div>
                        <div>Shows a print button in the dialog header</div>
                      </div>
                      
                      <div className="grid grid-cols-3 p-3 text-sm">
                        <div className="font-medium">showCopyButton</div>
                        <div>boolean</div>
                        <div>Shows a copy to clipboard button</div>
                      </div>
                      
                      <div className="grid grid-cols-3 p-3 text-sm">
                        <div className="font-medium">showShareButton</div>
                        <div>boolean</div>
                        <div>Shows a share button (uses Web Share API)</div>
                      </div>
                      
                      <div className="grid grid-cols-3 p-3 text-sm">
                        <div className="font-medium">showFullscreenButton</div>
                        <div>boolean</div>
                        <div>Shows a fullscreen toggle button</div>
                      </div>
                      
                      <div className="grid grid-cols-3 p-3 text-sm">
                        <div className="font-medium">title</div>
                        <div>string</div>
                        <div>Optional title to display in the dialog header</div>
                      </div>
                      
                      <div className="grid grid-cols-3 p-3 text-sm">
                        <div className="font-medium">description</div>
                        <div>string</div>
                        <div>Optional description to display below the title</div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}