import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Car, Truck, Bus, Bike, AlertCircle, CheckCircle2, Wrench, XCircle, User } from "lucide-react";
import Link from "next/link";

interface Vehicle {
  id: string;
  name: string;
  model: string;
  year: number;
  plateNumber: string;
  status: 'AVAILABLE' | 'RENTED' | 'MAINTENANCE' | 'RETIRED';
  type: 'CAR' | 'TRUCK' | 'VAN' | 'BUS' | 'MOTORCYCLE';
  color?: string;
  mileage?: number;
  rentalAmount: number;
  imageUrl?: string;
  location?: string;
  lastMaintenance?: string;
}

interface VehicleMobileCardProps {
  vehicle: Vehicle;
  onViewDetails: (vehicle: Vehicle) => void;
  onEditStatus: (vehicle: Vehicle) => void;
  onAssignUser: (vehicle: Vehicle) => void;
}

export function VehicleMobileCard({ 
  vehicle, 
  onViewDetails, 
  onEditStatus, 
  onAssignUser 
}: VehicleMobileCardProps) {
  const getVehicleIcon = (type: string) => {
    switch (type) {
      case 'CAR':
        return <Car className="h-5 w-5" />;
      case 'TRUCK':
        return <Truck className="h-5 w-5" />;
      case 'VAN':
        return <Car className="h-5 w-5" />;
      case 'BUS':
        return <Bus className="h-5 w-5" />;
      case 'MOTORCYCLE':
        return <Bike className="h-5 w-5" />;
      default:
        return <Car className="h-5 w-5" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'RENTED':
        return <AlertCircle className="h-4 w-4 text-blue-500" />;
      case 'MAINTENANCE':
        return <Wrench className="h-4 w-4 text-yellow-500" />;
      case 'RETIRED':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'RENTED':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'MAINTENANCE':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'RETIRED':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  return (
    <Card className="overflow-hidden shadow-sm border-slate-200 dark:border-slate-800">
      <CardHeader className="pb-3 space-y-2">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            {vehicle.imageUrl ? (
              <img
                src={vehicle.imageUrl}
                alt={vehicle.name}
                className="w-14 h-14 rounded-full object-cover ring-2 ring-background shadow-sm"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center shadow-sm">
                {getVehicleIcon(vehicle.type)}
              </div>
            )}
            <div>
              <CardTitle className="text-lg line-clamp-1">{vehicle.name}</CardTitle>
              <CardDescription className="line-clamp-1">
                {vehicle.model} ({vehicle.year})
              </CardDescription>
            </div>
          </div>
          <Badge 
            variant="secondary" 
            className={`${getStatusColor(vehicle.status)} flex items-center gap-1 px-2.5 py-0.5 rounded-full`}
          >
            {getStatusIcon(vehicle.status)}
            <span className="text-xs">{vehicle.status}</span>
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="pb-3 pt-0">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <div className="flex flex-col space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Type</span>
            </div>
            <div className="flex items-center gap-1.5 font-medium text-sm">
              {getVehicleIcon(vehicle.type)}
              <span>{vehicle.type}</span>
            </div>
          </div>
          
          <div className="flex flex-col space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Plate Number</span>
            </div>
            <code className="rounded bg-muted px-2 py-1 text-sm">
              {vehicle.plateNumber}
            </code>
          </div>
          
          <div className="flex flex-col space-y-1 col-span-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Monthly Rental</span>
            </div>
            <span className="font-medium text-sm">QAR {vehicle.rentalAmount.toLocaleString()}</span>
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="flex flex-col gap-2 p-3 bg-muted/10">
        <div className="grid grid-cols-2 gap-2 w-full">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewDetails(vehicle)}
            className="h-9 text-sm"
          >
            View Details
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEditStatus(vehicle)}
            className={vehicle.status === 'RENTED' ? "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400 h-9 text-sm" : "h-9 text-sm"}
          >
            {vehicle.status === 'RENTED' ? "Edit Rental" : "Edit Status"}
          </Button>
        </div>
        
        <div className="grid grid-cols-2 gap-2 w-full">
          <Button
            variant="default"
            size="sm"
            onClick={() => onAssignUser(vehicle)}
            className="bg-green-600 hover:bg-green-700 text-white h-9 text-sm"
          >
            <User className="h-4 w-4 mr-2" />
            Assign User
          </Button>
          
          <Link href={`/vehicles/${vehicle.id}`} className="w-full">
            <Button variant="outline" size="sm" className="w-full h-9 text-sm">
              Manage
            </Button>
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}