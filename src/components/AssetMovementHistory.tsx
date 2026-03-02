import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/util/string";
import { ArrowRight, MapPin, Calendar, Clock, Building, MoveHorizontal } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface AssetMovement {
  id: string;
  assetId: string;
  fromRoom: string | null;
  toRoom: string | null;
  fromFloor: string | null;
  toFloor: string | null;
  reason: string | null;
  movedAt: string;
  createdAt: string;
  updatedAt: string;
  asset?: {
    name: string;
  };
}

interface AssetMovementHistoryProps {
  assetId: string;
  assetName?: string;
  className?: string;
  maxHeight?: string;
}

export function AssetMovementHistory({ 
  assetId, 
  assetName,
  className = "",
  maxHeight = "400px"
}: AssetMovementHistoryProps) {
  const [movements, setMovements] = useState<AssetMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!assetId) return;
    
    const fetchMovementHistory = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetch(`/api/assets/${assetId}/movement-history`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch movement history');
        }
        
        const data = await response.json();
        setMovements(data);
      } catch (err) {
        console.error('Error fetching movement history:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMovementHistory();
  }, [assetId]);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MoveHorizontal className="h-5 w-5" />
            Movement History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-1/4" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MoveHorizontal className="h-5 w-5" />
            Movement History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-4 text-center text-muted-foreground">
            <p>Failed to load movement history</p>
            <p className="text-sm">{error}</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (movements.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MoveHorizontal className="h-5 w-5" />
            Movement History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-4 text-center text-muted-foreground">
            <p>No movement history found for this asset</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MoveHorizontal className="h-5 w-5" />
          Movement History
          {assetName && (
            <Badge variant="outline" className="ml-2">
              {assetName}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className={`pr-4 ${maxHeight ? `max-h-[${maxHeight}]` : ""}`}>
          <div className="space-y-4">
            {movements.map((movement) => (
              <div 
                key={movement.id} 
                className="border-l-2 border-primary/20 pl-4 py-2 hover:bg-muted/50 rounded-r-md transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {formatDate(movement.movedAt)}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 mb-2">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <div className="flex items-center gap-1 text-sm">
                    <span>
                      Floor {movement.fromFloor || 'Unknown'}, Room {movement.fromRoom || 'Unknown'}
                    </span>
                    <ArrowRight className="h-3 w-3 mx-1" />
                    <span>
                      Floor {movement.toFloor || 'Unknown'}, Room {movement.toRoom || 'Unknown'}
                    </span>
                  </div>
                </div>
                
                {movement.reason && (
                  <div className="text-sm text-muted-foreground ml-6">
                    Reason: {movement.reason}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}