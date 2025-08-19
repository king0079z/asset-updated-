import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Simplified version to reduce dependencies during build
export const SubscriptionInfoCard = ({ compact = false }) => {
  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Subscription Details</CardTitle>
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            ACTIVE
          </Badge>
        </div>
        <CardDescription>
          Your current subscription plan and usage information
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <p className="text-center text-muted-foreground py-4">
          Basic Plan - Active until 2025-05-27
        </p>
      </CardContent>
    </Card>
  );
};

export default SubscriptionInfoCard;