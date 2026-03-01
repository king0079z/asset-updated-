import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useTranslation } from "@/contexts/TranslationContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, User, Car, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRouter } from "next/router";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { fetchWithCache } from '@/lib/api-cache';

interface Driver {
  id: string;
  email: string;
  createdAt: string;
  vehicleCount: number;
  tripCount: number;
  totalDistance: number;
  totalHours: number;
}

export default function DriversPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMobile = useMediaQuery("(max-width: 768px)");
  const isSmallMobile = useMediaQuery("(max-width: 480px)");

  useEffect(() => {
    fetchDrivers();
  }, []);

  const fetchDrivers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetchWithCache("/api/drivers");
      if (response.ok) {
        const data = await response.json();
        setDrivers(data.drivers);
      } else {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        console.error("Failed to fetch drivers:", errorData);
        setError(errorData.error || "Failed to fetch drivers");
      }
    } catch (error) {
      console.error("Error fetching drivers:", error);
      setError("Network error when fetching driver data");
    } finally {
      setLoading(false);
    }
  };

  const handleDriverClick = (driverId: string) => {
    router.push(`/drivers/${driverId}`);
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t('drivers_management')}</h1>
              <p className="text-muted-foreground">
                {t('drivers_management_description')}
              </p>
            </div>
            <Button 
              onClick={fetchDrivers} 
              variant="outline" 
              className="gap-2 w-full sm:w-auto"
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              {t('refresh')}
            </Button>
          </div>



          <Tabs defaultValue="list" className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="list">{t('list_view')}</TabsTrigger>
              <TabsTrigger value="grid">{t('grid_view')}</TabsTrigger>
            </TabsList>
            
            <TabsContent value="list" className="mt-4">
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle>{t('drivers_list')}</CardTitle>
                  <CardDescription>{t('all_drivers')}</CardDescription>
                </CardHeader>
                <CardContent>
                  {error && (
                    <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2 text-destructive">
                      <AlertTriangle className="h-5 w-5" />
                      <div>
                        <p className="text-sm font-medium">{t('error_fetching_data')}</p>
                        <p className="text-xs">{error}</p>
                        <Button 
                          variant="link" 
                          size="sm" 
                          className="p-0 h-auto text-xs text-destructive" 
                          onClick={fetchDrivers}
                        >
                          {t('try_again')}
                        </Button>
                      </div>
                    </div>
                  )}

                  {loading ? (
                    <div className="space-y-4">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="flex items-center p-4 border rounded-lg">
                          <Skeleton className="h-10 w-10 rounded-full" />
                          <div className="ml-4 space-y-2 flex-1">
                            <Skeleton className="h-4 w-[250px]" />
                            <Skeleton className="h-4 w-[200px]" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : drivers.length === 0 ? (
                    <div className="text-center py-10">
                      <User className="mx-auto h-12 w-12 text-muted-foreground" />
                      <h3 className="mt-2 text-sm font-semibold">{t('no_drivers_found')}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{t('no_drivers_description')}</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto -mx-6 px-6">
                      {isMobile ? (
                        // Mobile list view
                        <div className="space-y-4">
                          {drivers.map((driver) => (
                            <div 
                              key={driver.id} 
                              className="border rounded-lg p-4 hover:bg-accent/50 transition-colors cursor-pointer"
                              onClick={() => handleDriverClick(driver.id)}
                            >
                              <div className="flex items-center mb-3">
                                <div className="h-10 w-10 rounded-full bg-accent flex items-center justify-center">
                                  <User className="h-5 w-5 text-accent-foreground" />
                                </div>
                                <div className="ml-3">
                                  <p className="font-medium text-sm">{driver.email}</p>
                                  <p className="text-xs text-muted-foreground">{t('joined')}: {new Date(driver.createdAt).toLocaleDateString()}</p>
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-2 mb-3">
                                <div className="bg-accent/50 p-2 rounded">
                                  <p className="text-xs text-muted-foreground">{t('vehicles_assigned')}</p>
                                  <p className="text-sm font-medium">{driver.vehicleCount}</p>
                                </div>
                                <div className="bg-accent/50 p-2 rounded">
                                  <p className="text-xs text-muted-foreground">{t('total_trips')}</p>
                                  <p className="text-sm font-medium">{driver.tripCount}</p>
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-2">
                                <div className="bg-accent/50 p-2 rounded">
                                  <p className="text-xs text-muted-foreground">{t('total_distance')} (km)</p>
                                  <p className="text-sm font-medium">{driver.totalDistance.toFixed(1)}</p>
                                </div>
                                <div className="bg-accent/50 p-2 rounded">
                                  <p className="text-xs text-muted-foreground">{t('total_hours')}</p>
                                  <p className="text-sm font-medium">{driver.totalHours.toFixed(1)}</p>
                                </div>
                              </div>
                              
                              <div className="mt-3 pt-3 border-t flex justify-end">
                                <Button variant="outline" size="sm">
                                  {t('view_details')}
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        // Desktop table view
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-3 px-4 font-medium text-sm">{t('driver')}</th>
                              <th className="text-center py-3 px-4 font-medium text-sm">{t('vehicles_assigned')}</th>
                              <th className="text-center py-3 px-4 font-medium text-sm">{t('total_trips')}</th>
                              <th className="text-center py-3 px-4 font-medium text-sm">{t('total_distance')} (km)</th>
                              <th className="text-center py-3 px-4 font-medium text-sm">{t('total_hours')}</th>
                              <th className="text-right py-3 px-4 font-medium text-sm">{t('actions')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {drivers.map((driver) => (
                              <tr key={driver.id} className="border-b hover:bg-accent/50 transition-colors">
                                <td className="py-3 px-4">
                                  <div className="flex items-center">
                                    <div className="h-10 w-10 rounded-full bg-accent flex items-center justify-center">
                                      <User className="h-5 w-5 text-accent-foreground" />
                                    </div>
                                    <div className="ml-3">
                                      <p className="font-medium text-sm">{driver.email}</p>
                                      <p className="text-xs text-muted-foreground">{t('joined')}: {new Date(driver.createdAt).toLocaleDateString()}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <Badge variant="secondary">
                                    {driver.vehicleCount}
                                  </Badge>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <Badge variant="secondary">
                                    {driver.tripCount}
                                  </Badge>
                                </td>
                                <td className="py-3 px-4 text-center font-medium">
                                  {driver.totalDistance.toFixed(1)}
                                </td>
                                <td className="py-3 px-4 text-center font-medium">
                                  {driver.totalHours.toFixed(1)}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => handleDriverClick(driver.id)}
                                  >
                                    {t('view_details')}
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="grid" className="mt-4">
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle>{t('drivers_grid')}</CardTitle>
                  <CardDescription>{t('all_drivers')}</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="border rounded-lg p-4">
                          <div className="flex items-center mb-4">
                            <Skeleton className="h-12 w-12 rounded-full" />
                            <div className="ml-3 space-y-2">
                              <Skeleton className="h-4 w-[150px]" />
                              <Skeleton className="h-3 w-[100px]" />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-2/3" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : drivers.length === 0 ? (
                    <div className="text-center py-10">
                      <User className="mx-auto h-12 w-12 text-muted-foreground" />
                      <h3 className="mt-2 text-sm font-semibold">{t('no_drivers_found')}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{t('no_drivers_description')}</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {drivers.map((driver) => (
                        <div 
                          key={driver.id} 
                          className="border rounded-lg p-4 hover:bg-accent/50 transition-colors cursor-pointer"
                          onClick={() => handleDriverClick(driver.id)}
                        >
                          <div className="flex items-center mb-4">
                            <div className="h-12 w-12 rounded-full bg-accent flex items-center justify-center">
                              <User className="h-6 w-6 text-accent-foreground" />
                            </div>
                            <div className="ml-3">
                              <p className="font-medium">{driver.email}</p>
                              <p className="text-xs text-muted-foreground">{t('joined')}: {new Date(driver.createdAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                          
                          <div className={cn(
                            "grid gap-2 mb-3",
                            isSmallMobile ? "grid-cols-1" : "grid-cols-2"
                          )}>
                            <div className="bg-accent/50 p-2 rounded">
                              <p className="text-xs text-muted-foreground">{t('vehicles_assigned')}</p>
                              <p className="text-sm font-medium">{driver.vehicleCount}</p>
                            </div>
                            <div className="bg-accent/50 p-2 rounded">
                              <p className="text-xs text-muted-foreground">{t('total_trips')}</p>
                              <p className="text-sm font-medium">{driver.tripCount}</p>
                            </div>
                          </div>
                          
                          <div className={cn(
                            "grid gap-2",
                            isSmallMobile ? "grid-cols-1" : "grid-cols-2"
                          )}>
                            <div className="bg-accent/50 p-2 rounded">
                              <p className="text-xs text-muted-foreground">{t('total_distance')} (km)</p>
                              <p className="text-sm font-medium">{driver.totalDistance.toFixed(1)}</p>
                            </div>
                            <div className="bg-accent/50 p-2 rounded">
                              <p className="text-xs text-muted-foreground">{t('total_hours')}</p>
                              <p className="text-sm font-medium">{driver.totalHours.toFixed(1)}</p>
                            </div>
                          </div>
                          
                          <div className="mt-3 pt-3 border-t flex justify-end">
                            <Button variant="outline" size="sm">
                              {t('view_details')}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}