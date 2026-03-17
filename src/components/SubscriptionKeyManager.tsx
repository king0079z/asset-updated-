import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Plus } from 'lucide-react';

// Simplified version to reduce dependencies during build
export const SubscriptionKeyManager = () => {
  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Subscription Key Management</CardTitle>
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Generate New Key
          </Button>
        </div>
        <CardDescription>
          Manage subscription keys for your organization
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <p className="text-center text-muted-foreground py-8">
          Subscription key management is currently being set up.
          <br />
          Please check back later.
        </p>
      </CardContent>
    </Card>
  );
};

export default SubscriptionKeyManager;