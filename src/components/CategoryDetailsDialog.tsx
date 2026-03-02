import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Package, Search, Calendar, DollarSign, Building2, AlertTriangle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { WasteBreakdownDialog } from "./WasteBreakdownDialog";

interface CategoryDetailsDialogProps {
  category: string;
  categoryLabel: string;
  trigger: React.ReactNode;
}

export function CategoryDetailsDialog({ category, categoryLabel, trigger }: CategoryDetailsDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [categorySupplies, setCategorySupplies] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryStats, setCategoryStats] = useState<any>(null);
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  const { toast } = useToast();
  const [wasteDialogOpen, setWasteDialogOpen] = useState(false);

  // Fetch supplies for this category
  const loadCategorySupplies = async () => {
    if (!isOpen) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/food-supply?category=${category}`);
      if (!response.ok) throw new Error('Failed to load category supplies');
      const data = await response.json();
      setCategorySupplies(data);
    } catch (error) {
      console.error('Error loading category supplies:', error);
      toast({
        title: "Error",
        description: "Failed to load category details",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch dashboard stats for this category
  const loadCategoryStats = async () => {
    if (!isOpen) return;
    setIsStatsLoading(true);
    try {
      const response = await fetch(`/api/food-supply/stats?category=${category}`);
      if (!response.ok) throw new Error('Failed to load category stats');
      const data = await response.json();
      setCategoryStats(data);
    } catch (error) {
      console.error('Error loading category stats:', error);
      toast({
        title: "Error",
        description: "Failed to load category statistics",
        variant: "destructive",
      });
    } finally {
      setIsStatsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadCategorySupplies();
      loadCategoryStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, category]);

  const filteredSupplies = categorySupplies.filter(supply =>
    supply.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getExpirationStatus = (expirationDate: string) => {
    const expDate = new Date(expirationDate);
    const daysUntilExpiration = Math.ceil((expDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntilExpiration <= 7) return { status: 'Critical', color: 'bg-red-100 text-red-800' };
    if (daysUntilExpiration <= 30) return { status: 'Soon', color: 'bg-amber-100 text-amber-800' };
    return { status: 'Good', color: 'bg-green-100 text-green-800' };
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-4xl w-[90vw] max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {categoryLabel} Category Details
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Category Dashboard Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* Total Items */}
            <Card className="bg-muted/50 border border-border shadow-none rounded-lg transition hover:shadow-md">
              <CardContent className="p-3 flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-blue-100 p-2 flex items-center justify-center">
                    <Package className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-muted-foreground mb-0.5">Total Items</span>
                    <span className="block text-lg font-semibold text-primary">
                      {isStatsLoading ? <span className="animate-pulse">...</span> : categoryStats?.totalSupplies ?? "--"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
            {/* Total Consumed Value */}
            <Card className="bg-muted/50 border border-border shadow-none rounded-lg transition hover:shadow-md">
              <CardContent className="p-3 flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-green-100 p-2 flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-muted-foreground mb-0.5">Total Consumed Value</span>
                    <span className="block text-lg font-semibold text-primary">
                      {isStatsLoading ? <span className="animate-pulse">...</span> : `QAR ${(categoryStats?.totalConsumed ?? 0).toFixed(2)}`}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
            {/* Expiring Soon */}
            <Card className="bg-muted/50 border border-border shadow-none rounded-lg transition hover:shadow-md">
              <CardContent className="p-3 flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-amber-100 p-2 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-muted-foreground mb-0.5">Expiring Soon</span>
                    <span className="block text-lg font-semibold text-primary">
                      {isStatsLoading ? <span className="animate-pulse">...</span> : categoryStats?.expiringSupplies ?? "--"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
            {/* Total Waste */}
            <Card className="bg-muted/50 border border-border shadow-none rounded-lg transition hover:shadow-md">
              <CardContent className="p-3 flex flex-col gap-2 h-full">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-red-100 p-2 flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  </div>
                  <div className="flex flex-col w-full">
                    <span className="block text-xs font-medium text-muted-foreground mb-0.5">Total Waste</span>
                    <button
                      type="button"
                      className="flex items-center focus:outline-none group bg-transparent p-0 m-0 w-fit"
                      onClick={() => setWasteDialogOpen(true)}
                      disabled={isStatsLoading}
                      style={{ cursor: isStatsLoading ? "default" : "pointer" }}
                      aria-label="Show waste breakdown"
                    >
                      <span className="text-lg font-semibold text-destructive group-hover:underline">
                        {isStatsLoading
                          ? <span className="animate-pulse">...</span>
                          : (
                            <>
                              QAR {(categoryStats?.totalWasteCost ?? 0).toFixed(2)}
                            </>
                          )
                        }
                      </span>
                    </button>
                    {!isStatsLoading && (
                      <div className="flex flex-col gap-0.5 mt-1 text-xs text-muted-foreground w-full">
                        <div className="grid grid-cols-3 gap-2 mt-3 text-xs w-full">
                          <div className="flex flex-col items-center">
                            <span className="font-semibold text-muted-foreground mb-0.5">Ingredient</span>
                            <Badge className="bg-muted text-primary font-medium px-2 py-0.5">
                              QAR {(categoryStats?.ingredientWasteCost ?? 0).toFixed(2)}
                            </Badge>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="font-semibold text-muted-foreground mb-0.5">Expiration</span>
                            <Badge className="bg-red-100 text-red-700 font-semibold px-2 py-0.5">
                              QAR {(categoryStats?.expirationWasteCost ?? 0).toFixed(2)}
                            </Badge>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="font-semibold text-muted-foreground mb-0.5">Waste %</span>
                            <Badge className="bg-yellow-100 text-yellow-800 font-semibold px-2 py-0.5">
                              {(categoryStats?.wastePercentage ?? 0).toFixed(1)}%
                            </Badge>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                {/* Waste Breakdown Dialog */}
                <WasteBreakdownDialog
                  open={wasteDialogOpen}
                  onOpenChange={setWasteDialogOpen}
                  ingredientWaste={categoryStats?.ingredientWasteBreakdown ?? []}
                  expirationWaste={categoryStats?.expirationWasteBreakdown ?? []}
                />
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`Search ${categoryLabel.toLowerCase()} items...`}
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Items List */}
          <div className="max-h-96 overflow-y-auto space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredSupplies.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No {categoryLabel.toLowerCase()} items found</p>
              </div>
            ) : (
              filteredSupplies.map((supply) => {
                const expiration = getExpirationStatus(supply.expirationDate);
                return (
                  <Card key={supply.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold">{supply.name}</h3>
                            <Badge className={expiration.color}>
                              {expiration.status}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Quantity</p>
                              <p className="font-medium">{supply.quantity} {supply.unit}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Price/Unit</p>
                              <p className="font-medium">QAR {supply.pricePerUnit}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Total Value</p>
                              <p className="font-medium">QAR {(supply.quantity * supply.pricePerUnit).toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Expires</p>
                              <p className="font-medium">{new Date(supply.expirationDate).toLocaleDateString()}</p>
                            </div>
                          </div>

                          {supply.vendor && (
                            <div className="mt-2">
                              <Badge variant="outline" className="text-xs">
                                Vendor: {supply.vendor.name}
                              </Badge>
                            </div>
                          )}

                          {supply.kitchenSupplies && supply.kitchenSupplies.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs text-muted-foreground mb-1">Available in kitchens:</p>
                              <div className="flex flex-wrap gap-1">
                                {supply.kitchenSupplies.map((ks: any) => (
                                  <Badge key={ks.id} variant="secondary" className="text-xs">
                                    {ks.kitchen?.name || 'Unknown'}: {ks.quantity} {supply.unit}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}