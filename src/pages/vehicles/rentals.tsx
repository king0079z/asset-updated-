import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Car, Calendar, User, Clock, CircleDollarSign, ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";
import { formatRentalId, formatRentalDate, calculateRentalDuration } from "@/util/rental";
import { VehicleRentalMobileCard } from "@/components/VehicleRentalMobileCard";
import { useTranslation } from "@/contexts/TranslationContext";

interface Vehicle {
  id: string;
  name: string;
  model: string;
  year: number;
  plateNumber: string;
  type: string;
  color?: string;
  imageUrl?: string;
  rentalAmount?: number;
}

interface VehicleRental {
  id: string;
  vehicleId: string;
  userId: string;
  userName?: string;
  startDate: string | Date;
  endDate?: string | Date | null;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  vehicle: Vehicle;
  dailyRate?: number | null;
  totalCost?: number | null;
  notes?: string | null;
  displayId?: string | null;
}

export default function VehicleRentalsPage() {
  const [rentals, setRentals] = useState<VehicleRental[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    fetchRentals();
  }, []);

  const fetchRentals = async () => {
    try {
      setIsLoading(true);
      setIsRefreshing(true);
      
      console.log('Fetching vehicle rentals data');
      const response = await fetch('/api/vehicles/rentals', {
        // Add cache-busting parameter to prevent stale data
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        let errorMessage = `Error: ${response.status}`;
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
        }
        
        throw new Error(errorMessage);
      }
      
      let data;
      try {
        data = await response.json();
        console.log('Rentals data received:', data);
      } catch (parseError) {
        console.error('Error parsing rentals response:', parseError);
        throw new Error(t('unexpected_response_format'));
      }
      
      // Validate the response data structure
      if (!data || !Array.isArray(data.rentals)) {
        console.error('Invalid rentals data format:', data);
        throw new Error(t('invalid_data_format'));
      }
      
      console.log(`Retrieved ${data.rentals.length} rentals`);
      
      // Process the rentals to ensure all required fields are present
      const processedRentals = data.rentals.map((rental: any) => {
        // Ensure dates are properly formatted
        let startDate = rental.startDate;
        let endDate = rental.endDate;
        
        // Convert date strings to Date objects if needed
        if (typeof startDate === 'string') {
          startDate = new Date(startDate);
        }
        
        if (endDate && typeof endDate === 'string') {
          endDate = new Date(endDate);
        }
        
        return {
          ...rental,
          // Ensure these fields are always present
          id: rental.id || '',
          vehicleId: rental.vehicleId || '',
          userId: rental.userId || '',
          userName: rental.userName || t('unknown_user'),
          startDate: startDate || new Date(),
          endDate: endDate,
          status: rental.status || 'ACTIVE',
          vehicle: rental.vehicle || {
            id: '',
            name: t('unknown_vehicle'),
            model: '',
            year: 0,
            plateNumber: '',
            type: ''
          },
          // Ensure dailyRate is populated
          dailyRate: rental.dailyRate || (rental.vehicle && rental.vehicle.rentalAmount) || 0
        };
      });
      
      setRentals(processedRentals);
      
      // Only show success toast if there are rentals or this is the initial load
      if (processedRentals.length > 0 || !isRefreshing) {
        toast({
          title: t('success'),
          description: t('vehicle_rentals_loaded_successfully'),
          variant: "default",
        });
      }
    } catch (error) {
      console.error('Error fetching rentals:', error);
      setRentals([]); // Clear rentals on error
      toast({
        title: t('error'),
        description: error instanceof Error ? error.message : t('failed_to_load_vehicle_rentals'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };
  
  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) {
      return 'N/A';
    }
    
    // For large numbers, use abbreviated format
    if (amount >= 1000000) {
      return `QAR ${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `QAR ${(amount / 1000).toFixed(1)}K`;
    } else {
      // For smaller numbers, use standard formatting with QAR currency
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'QAR',
        maximumFractionDigits: 0
      }).format(amount);
    }
  };
  
  const handleEndRental = async (rentalId: string) => {
    if (!rentalId) {
      console.error('Invalid rental ID provided to handleEndRental');
      toast({
        title: t('error'),
        description: t('invalid_rental_id'),
        variant: "destructive",
      });
      return;
    }
    
    if (!confirm(t('are_you_sure_end_rental') || 'Are you sure you want to end this rental?')) {
      return;
    }
    
    try {
      // Only disable the entire UI if we're not already in a loading state
      if (!isLoading) {
        setIsLoading(true);
      }
      
      // Create a temporary state to disable just the button that was clicked
      const updatedRentals = rentals.map(rental => 
        rental.id === rentalId ? { ...rental, isProcessing: true } : rental
      );
      setRentals(updatedRentals);
      
      console.log(`Attempting to end rental with ID: ${rentalId}`);
      const response = await fetch('/api/vehicles/end-rental', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify({ 
          rentalId,
          notes: 'Rental ended by user',
          endDate: new Date().toISOString() // Explicitly provide the end date
        }),
      });
      
      // Handle non-OK responses
      if (!response.ok) {
        let errorMessage = t('failed_to_end_rental') || 'Failed to end rental';
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
        }
        
        throw new Error(errorMessage);
      }
      
      // Parse successful response
      let data;
      try {
        data = await response.json();
        console.log('Rental ended successfully:', data);
      } catch (parseError) {
        console.error('Error parsing success response:', parseError);
        throw new Error(t('unexpected_response_format') || 'Unexpected response format');
      }
      
      toast({
        title: t('success') || 'Success',
        description: t('rental_ended_successfully') || 'Rental ended successfully',
        variant: "default",
      });
      
      // Refresh the rentals list
      await fetchRentals();
    } catch (error) {
      console.error('Error ending rental:', error);
      toast({
        title: t('error') || 'Error',
        description: error instanceof Error ? error.message : (t('failed_to_end_rental') || 'Failed to end rental'),
        variant: "destructive",
      });
      
      // Reset the processing state for the rental
      const resetRentals = rentals.map(rental => 
        rental.id === rentalId ? { ...rental, isProcessing: false } : rental
      );
      setRentals(resetRentals);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t('vehicle_rentals_management')}</h1>
            <p className="text-muted-foreground text-sm sm:text-base">{t('view_and_manage_all_active_vehicle_rentals')}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button 
              variant="outline" 
              className="w-full sm:w-auto"
              onClick={fetchRentals}
              disabled={isLoading || isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              {t('refresh')}
            </Button>
            <Link href="/vehicles" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto">{t('view_all_vehicles')}</Button>
            </Link>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('active_rentals')}</CardTitle>
            <CardDescription>{t('currently_rented_vehicles_and_their_details')}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {/* Desktop loading state */}
                <div className="hidden md:block">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center space-x-4">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-[250px]" />
                        <Skeleton className="h-4 w-[200px]" />
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Mobile loading state */}
                <div className="md:hidden space-y-4 px-0.5">
                  {[...Array(2)].map((_, i) => (
                    <Card key={i} className="overflow-hidden shadow-sm">
                      <CardHeader className="pb-3">
                        <div className="flex items-center space-x-4">
                          <Skeleton className="h-14 w-14 rounded-full" />
                          <div className="space-y-2 flex-1">
                            <Skeleton className="h-5 w-[120px]" />
                            <Skeleton className="h-4 w-[180px]" />
                          </div>
                        </div>
                        <div className="mt-2">
                          <Skeleton className="h-6 w-20 rounded-full" />
                        </div>
                      </CardHeader>
                      <CardContent className="pb-3 pt-0">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                          {[...Array(4)].map((_, j) => (
                            <div key={j} className="space-y-2">
                              <Skeleton className="h-4 w-24" />
                              <Skeleton className="h-5 w-full" />
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 pt-3 border-t">
                          <Skeleton className="h-4 w-24 mb-2" />
                          <Skeleton className="h-5 w-32" />
                        </div>
                      </CardContent>
                      <div className="p-4 bg-muted/20 flex flex-col gap-3">
                        <Skeleton className="h-10 w-full rounded-md" />
                        <Skeleton className="h-10 w-full rounded-md" />
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ) : rentals.length === 0 ? (
              <div className="text-center py-8 sm:py-12">
                <div className="bg-muted/30 rounded-full w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center mx-auto mb-5">
                  <Car className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">{t('no_active_rentals_found')}</h3>
                <p className="text-muted-foreground mb-5 text-sm sm:text-base px-4 max-w-md mx-auto">
                  {t('no_active_rentals_description')}
                </p>
                <Link href="/vehicles">
                  <Button className="h-11 px-6">
                    <Car className="h-4 w-4 mr-2" />
                    {t('manage_vehicles')}
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                {/* Desktop view - Table */}
                <div className="relative overflow-x-auto rounded-md border hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('rental_id')}</TableHead>
                        <TableHead>{t('vehicle')}</TableHead>
                        <TableHead>{t('rented_by')}</TableHead>
                        <TableHead>{t('start_date')}</TableHead>
                        <TableHead>{t('duration')}</TableHead>
                        <TableHead>{t('daily_rate')}</TableHead>
                        <TableHead>{t('status')}</TableHead>
                        <TableHead className="text-right">{t('actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rentals.map((rental) => {
                        // Get the daily rate from either the rental or the vehicle
                        const dailyRate = rental.dailyRate || rental.vehicle.rentalAmount || 0;
                        
                        return (
                          <TableRow key={rental.id} className="group hover:bg-muted/50">
                            <TableCell>
                              <div className="font-medium">
                                {formatRentalId(rental.startDate, rental.id, rental.displayId)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                {rental.vehicle.imageUrl ? (
                                  <img
                                    src={rental.vehicle.imageUrl}
                                    alt={rental.vehicle.name}
                                    className="w-10 h-10 rounded-full object-cover ring-2 ring-background"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                                    <Car className="h-5 w-5" />
                                  </div>
                                )}
                                <div>
                                  <div className="font-medium">{rental.vehicle.name}</div>
                                  <div className="text-sm text-muted-foreground">
                                    {rental.vehicle.model} ({rental.vehicle.year})
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <span>{rental.userName || t('unknown_user')}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span>{formatRentalDate(rental.startDate)}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <span>{calculateRentalDuration(rental.startDate, rental.endDate)} {t('days')}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
                                <span>{formatCurrency(dailyRate)}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                                {rental.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Link href={`/vehicles/${rental.vehicleId}`}>
                                  <Button variant="outline" size="sm">
                                    {t('view_vehicle')}
                                  </Button>
                                </Link>
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                  onClick={() => handleEndRental(rental.id)}
                                >
                                  <CircleDollarSign className="h-4 w-4 mr-2" />
                                  {t('end_rental')}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                
                {/* Mobile view - Cards */}
                <div className="space-y-4 md:hidden px-0.5">
                  {rentals.map((rental) => (
                    <VehicleRentalMobileCard 
                      key={rental.id} 
                      rental={rental} 
                      onEndRental={handleEndRental} 
                    />
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}