import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import Link from "next/link";
import { AlertTriangle, Edit, FileText, PlusCircle, Search, Star, Users } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { VendorManagementDialog } from "@/components/VendorManagementDialog";
import { useTranslation } from "@/contexts/TranslationContext";
import { useAuth } from "@/contexts/AuthContext";

type Vendor = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  type: string[];
  reliabilityScore: number | null;
  qualityScore: number | null;
  responseTimeScore: number | null;
  lastReviewDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

// Function to get color based on score
const getScoreColor = (score: number): string => {
  if (score >= 80) return "#10b981"; // Green for high scores
  if (score >= 60) return "#f59e0b"; // Amber for medium scores
  return "#ef4444"; // Red for low scores
};

export default function SettingsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [filteredVendors, setFilteredVendors] = useState<Vendor[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | undefined>(undefined);
  const { toast } = useToast();
  const { t } = useTranslation();
  const { user } = useAuth();

  const loadVendors = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/vendors");
      if (!response.ok) {
        throw new Error("Failed to load vendors");
      }
      const data = await response.json();
      setVendors(data);
      setFilteredVendors(data);
    } catch (error) {
      console.error("Error loading vendors:", error);
      toast({
        title: "Error",
        description: "Failed to load vendors",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadVendors();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredVendors(vendors);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = vendors.filter(
        (vendor) =>
          vendor.name.toLowerCase().includes(query) ||
          (vendor.email && vendor.email.toLowerCase().includes(query)) ||
          (vendor.phone && vendor.phone.toLowerCase().includes(query)) ||
          (vendor.address && vendor.address.toLowerCase().includes(query)) ||
          vendor.type.some((type) => type.toLowerCase().includes(query))
      );
      setFilteredVendors(filtered);
    }
  }, [searchQuery, vendors]);

  const handleAddVendor = () => {
    setSelectedVendor(undefined);
    setIsDialogOpen(true);
  };

  const handleEditVendor = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
  };

  const handleVendorUpdated = () => {
    loadVendors();
  };

  // Calculate overall score for a vendor
  const calculateOverallScore = (vendor: Vendor): number | null => {
    const scores = [vendor.reliabilityScore, vendor.qualityScore, vendor.responseTimeScore].filter(score => score !== null) as number[];
    if (scores.length === 0) return null;
    return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  };

  // Get performance status based on overall score
  const getPerformanceStatus = (score: number | null): string => {
    if (score === null) return 'Not Rated';
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    return 'Needs Improvement';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">{t('settings')}</h1>
          <div className="flex gap-2">
            <Link href="/settings/vendor-performance">
              <Button variant="outline" className="flex items-center gap-2">
                <Star size={16} />
                Vendor Performance
              </Button>
            </Link>
            <Link href="/settings/error-logs">
              <Button variant="outline" className="flex items-center gap-2">
                <AlertTriangle size={16} />
                {t('error_logs')}
              </Button>
            </Link>
            <Link href="/settings/user-management">
              <Button variant="outline" className="flex items-center gap-2">
                <Users size={16} />
                {t('user_management')}
              </Button>
            </Link>
            {user?.isAdmin && (
              <Link href="/admin/organizations">
                <Button variant="outline" className="flex items-center gap-2">
                  <Users size={16} />
                  All Organizations
                </Button>
              </Link>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>{t('vendors')}</CardTitle>
                <CardDescription>{t('manage_your_vendors')}</CardDescription>
              </div>
              <Button onClick={handleAddVendor}>
                <PlusCircle className="mr-2 h-4 w-4" />
                {t('add_vendor')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder={t('search_vendors')}
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-900 dark:border-gray-100"></div>
              </div>
            ) : filteredVendors.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchQuery ? t('no_vendors_match_search') : t('no_vendors_found')}
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('name')}</TableHead>
                      <TableHead>{t('email')}</TableHead>
                      <TableHead>{t('phone')}</TableHead>
                      <TableHead>{t('type')}</TableHead>
                      <TableHead>{t('reliability')}</TableHead>
                      <TableHead>{t('quality_score')}</TableHead>
                      <TableHead>{t('response_time_score')}</TableHead>
                      <TableHead>{t('overall_score')}</TableHead>
                      <TableHead className="w-[80px]">{t('actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVendors.map((vendor) => {
                      const overallScore = calculateOverallScore(vendor);
                      const performanceStatus = getPerformanceStatus(overallScore);
                      
                      return (
                        <TableRow key={vendor.id}>
                          <TableCell className="font-medium">{vendor.name}</TableCell>
                          <TableCell>{vendor.email}</TableCell>
                          <TableCell>{vendor.phone}</TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              {vendor.type?.map((type) => (
                                <Badge key={type} variant="secondary">
                                  {type.replace("_", " ")}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            {vendor.reliabilityScore !== null ? (
                              <div className="flex items-center gap-1">
                                <div 
                                  className="w-2 h-2 rounded-full" 
                                  style={{ 
                                    backgroundColor: getScoreColor(vendor.reliabilityScore) 
                                  }}
                                />
                                <span className="text-xs">{vendor.reliabilityScore}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {vendor.qualityScore !== null ? (
                              <div className="flex items-center gap-1">
                                <div 
                                  className="w-2 h-2 rounded-full" 
                                  style={{ 
                                    backgroundColor: getScoreColor(vendor.qualityScore) 
                                  }}
                                />
                                <span className="text-xs">{vendor.qualityScore}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {vendor.responseTimeScore !== null ? (
                              <div className="flex items-center gap-1">
                                <div 
                                  className="w-2 h-2 rounded-full" 
                                  style={{ 
                                    backgroundColor: getScoreColor(vendor.responseTimeScore) 
                                  }}
                                />
                                <span className="text-xs">{vendor.responseTimeScore}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {overallScore !== null ? (
                              <div className="flex items-center gap-1">
                                <Badge 
                                  variant={
                                    performanceStatus === 'Excellent' ? 'default' : 
                                    performanceStatus === 'Good' ? 'secondary' : 
                                    'outline'
                                  }
                                  className="text-xs"
                                >
                                  {performanceStatus}
                                </Badge>
                                <span className="text-xs ml-1">{overallScore}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">Not Rated</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditVendor(vendor)}
                            >
                              <Edit className="h-4 w-4" />
                              <span className="sr-only">{t('edit')}</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <VendorManagementDialog
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        vendor={selectedVendor}
        onVendorUpdated={handleVendorUpdated}
      />
    </DashboardLayout>
  );
}