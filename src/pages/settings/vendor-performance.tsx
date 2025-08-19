import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Search, Users } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/contexts/TranslationContext";
import { VendorPerformanceCard } from "@/components/VendorPerformanceCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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

// Calculate days since last review
const getDaysSinceLastReview = (lastReviewDate: string | null): number | null => {
  if (!lastReviewDate) return null;
  const lastReview = new Date(lastReviewDate);
  const today = new Date();
  const diffTime = Math.abs(today.getTime() - lastReview.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Determine if vendor needs review (more than 90 days)
const needsReview = (lastReviewDate: string | null): boolean => {
  const daysSinceLastReview = getDaysSinceLastReview(lastReviewDate);
  return daysSinceLastReview === null || daysSinceLastReview > 90;
};

export default function VendorPerformancePage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [filteredVendors, setFilteredVendors] = useState<Vendor[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const { toast } = useToast();
  const { t } = useTranslation();

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
    let filtered = vendors;

    // Filter by tab
    if (activeTab === "needs-review") {
      filtered = vendors.filter((vendor) => needsReview(vendor.lastReviewDate));
    } else if (activeTab === "reviewed") {
      filtered = vendors.filter((vendor) => !needsReview(vendor.lastReviewDate));
    }

    // Filter by search query
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (vendor) =>
          vendor.name.toLowerCase().includes(query) ||
          (vendor.email && vendor.email.toLowerCase().includes(query)) ||
          (vendor.phone && vendor.phone.toLowerCase().includes(query)) ||
          (vendor.address && vendor.address.toLowerCase().includes(query)) ||
          vendor.type.some((type) => type.toLowerCase().includes(query))
      );
    }

    setFilteredVendors(filtered);
  }, [searchQuery, vendors, activeTab]);

  const handlePerformanceUpdated = () => {
    loadVendors();
  };

  const vendorsNeedingReview = vendors.filter((vendor) => needsReview(vendor.lastReviewDate));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Link href="/settings">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-3xl font-bold">Vendor Performance</h1>
          </div>
          <div className="flex gap-2">
            <Link href="/settings/error-logs">
              <Button variant="outline" className="flex items-center gap-2">
                <AlertTriangle size={16} />
                {t("error_logs")}
              </Button>
            </Link>
            <Link href="/settings/user-management">
              <Button variant="outline" className="flex items-center gap-2">
                <Users size={16} />
                {t("user_management")}
              </Button>
            </Link>
          </div>
        </div>

        {vendorsNeedingReview.length > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Vendors Need Review</AlertTitle>
            <AlertDescription>
              {vendorsNeedingReview.length} vendor{vendorsNeedingReview.length > 1 ? "s" : ""} need{vendorsNeedingReview.length === 1 ? "s" : ""} performance review.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Vendor Performance Tracking</CardTitle>
                <CardDescription>
                  Monitor and evaluate vendor performance metrics
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder={t("search_vendors")}
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <Tabs defaultValue="all" className="mb-6" onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="all">All Vendors</TabsTrigger>
                <TabsTrigger value="needs-review">
                  Needs Review ({vendorsNeedingReview.length})
                </TabsTrigger>
                <TabsTrigger value="reviewed">Reviewed</TabsTrigger>
              </TabsList>
            </Tabs>

            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-900 dark:border-gray-100"></div>
              </div>
            ) : filteredVendors.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchQuery
                  ? t("no_vendors_match_search")
                  : activeTab === "needs-review"
                  ? "No vendors need review at this time"
                  : activeTab === "reviewed"
                  ? "No vendors have been reviewed yet"
                  : t("no_vendors_found")}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredVendors.map((vendor) => (
                  <VendorPerformanceCard
                    key={vendor.id}
                    vendor={vendor}
                    onPerformanceUpdated={handlePerformanceUpdated}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}