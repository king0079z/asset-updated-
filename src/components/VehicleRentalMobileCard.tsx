import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Car, Calendar, User, Clock, CircleDollarSign, Info } from "lucide-react";
import Link from "next/link";
import { formatRentalId, formatRentalDate, calculateRentalDuration } from "@/util/rental";
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
  isProcessing?: boolean; // Added to track processing state
}

interface VehicleRentalMobileCardProps {
  rental: VehicleRental;
  onEndRental: (rentalId: string) => void;
}

export function VehicleRentalMobileCard({ rental, onEndRental }: VehicleRentalMobileCardProps) {
  const { t } = useTranslation();
  
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

  // Get the daily rate from either the rental or the vehicle
  const dailyRate = rental.dailyRate || rental.vehicle.rentalAmount || 0;

  return (
    <Card className="overflow-hidden shadow-sm border-slate-200 dark:border-slate-800">
      <CardHeader className="pb-3 space-y-2">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            {rental.vehicle.imageUrl ? (
              <img
                src={rental.vehicle.imageUrl}
                alt={rental.vehicle.name}
                className="w-14 h-14 rounded-full object-cover ring-2 ring-background shadow-sm"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center shadow-sm">
                <Car className="h-7 w-7" />
              </div>
            )}
            <div>
              <CardTitle className="text-lg line-clamp-1">{rental.vehicle.name}</CardTitle>
              <CardDescription className="line-clamp-1">
                {rental.vehicle.model} ({rental.vehicle.year})
              </CardDescription>
            </div>
          </div>
          <Badge 
            variant="secondary" 
            className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 text-xs px-2.5 py-0.5 rounded-full"
          >
            {rental.status}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="pb-3 pt-0">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <div className="flex flex-col space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <User className="h-3.5 w-3.5" />
              <span>{t('rented_by')}</span>
            </div>
            <span className="font-medium text-sm pl-5 truncate">{rental.userName || t('unknown_user')}</span>
          </div>
          
          <div className="flex flex-col space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>{t('start_date')}</span>
            </div>
            <span className="font-medium text-sm pl-5">{formatRentalDate(rental.startDate)}</span>
          </div>
          
          <div className="flex flex-col space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>{t('duration')}</span>
            </div>
            <span className="font-medium text-sm pl-5">
              {calculateRentalDuration(rental.startDate, rental.endDate)} {t('days')}
            </span>
          </div>
          
          <div className="flex flex-col space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CircleDollarSign className="h-3.5 w-3.5" />
              <span>{t('daily_rate')}</span>
            </div>
            <span className="font-medium text-sm pl-5">{formatCurrency(dailyRate)}</span>
          </div>
        </div>
        
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5" />
            <span>{t('rental_id')}</span>
          </div>
          <span className="font-medium text-sm pl-5 mt-1 block">
            {formatRentalId(rental.startDate, rental.id, rental.displayId)}
          </span>
        </div>
      </CardContent>
      
      <CardFooter className="flex flex-col sm:flex-row gap-2 p-3 bg-muted/10">
        <Link href={`/vehicles/${rental.vehicleId}`} className="w-full">
          <Button variant="outline" className="w-full h-10 text-sm" disabled={rental.isProcessing}>
            {t('view_vehicle')}
          </Button>
        </Link>
        <Button
          variant="default"
          className="w-full h-10 text-sm bg-green-600 hover:bg-green-700 text-white"
          onClick={() => onEndRental(rental.id)}
          disabled={rental.isProcessing}
        >
          {rental.isProcessing ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {t('processing')}
            </>
          ) : (
            <>
              <CircleDollarSign className="h-4 w-4 mr-1.5" />
              {t('end_rental')}
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}