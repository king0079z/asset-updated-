import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle } from "lucide-react";

export default function UpdateRentalIdsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; count?: number } | null>(null);
  const { toast } = useToast();

  const handleUpdateRentalIds = async () => {
    try {
      setIsLoading(true);
      setResult(null);
      
      const response = await fetch('/api/admin/update-rental-display-ids', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to update rental IDs');
      }
      
      setResult({
        success: true,
        message: data.message,
        count: data.updatedCount
      });
      
      toast({
        title: "Success",
        description: data.message,
        variant: "default",
      });
    } catch (error) {
      console.error('Error updating rental IDs:', error);
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'An unknown error occurred'
      });
      
      toast({
        title: "Error",
        description: "Failed to update rental IDs",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Update Rental IDs</h1>
          <p className="text-muted-foreground">
            Update all vehicle rental IDs to the new format (RNT-YYYYMMDD-XXXX)
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Rental ID Update Tool</CardTitle>
            <CardDescription>
              This tool will update all vehicle rental IDs that don't follow the new format.
              The new format is RNT-YYYYMMDD-XXXX, where YYYYMMDD is the start date and XXXX is a sequential number.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col space-y-2">
              <p>
                Click the button below to update all rental IDs that don't follow the new format.
                This process may take a few moments depending on the number of rentals that need to be updated.
              </p>
              
              <Button 
                onClick={handleUpdateRentalIds} 
                disabled={isLoading}
                className="w-full md:w-auto"
              >
                {isLoading ? "Updating..." : "Update Rental IDs"}
              </Button>
            </div>

            {result && (
              <Alert variant={result.success ? "default" : "destructive"}>
                {result.success ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertTitle>
                  {result.success ? "Success" : "Error"}
                </AlertTitle>
                <AlertDescription>
                  {result.message}
                  {result.success && result.count !== undefined && (
                    <p className="mt-2">
                      {result.count === 0 
                        ? "No rental IDs needed to be updated." 
                        : `Updated ${result.count} rental ID${result.count === 1 ? "" : "s"}.`}
                    </p>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}