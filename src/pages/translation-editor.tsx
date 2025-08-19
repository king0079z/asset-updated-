import React, { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle, AlertCircle, Search, Save, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/contexts/TranslationContext";

// Import the original Arabic translations
import arTranslations from "@/translations/ar";

export default function TranslationEditor() {
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
  
  // State for translations
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [originalTranslations, setOriginalTranslations] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("landing");
  const [savedMessage, setSavedMessage] = useState({ show: false, success: true, message: "" });
  const [isLoading, setIsLoading] = useState(false);

  // Load translations on component mount
  useEffect(() => {
    // Get translations from localStorage or use the imported ones
    const savedTranslations = localStorage.getItem("customArabicTranslations");
    if (savedTranslations) {
      setTranslations(JSON.parse(savedTranslations));
    } else {
      setTranslations({ ...arTranslations });
    }
    
    // Keep a copy of the original translations for reference
    setOriginalTranslations({ ...arTranslations });
  }, []);

  // Redirect if not authenticated
  useEffect(() => {
    if (user === null) {
      router.push("/login");
    }
  }, [user, router]);

  // Handle input change
  const handleTranslationChange = (key: string, value: string) => {
    setTranslations(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Save translations to localStorage
  const saveTranslations = () => {
    setIsLoading(true);
    try {
      localStorage.setItem("customArabicTranslations", JSON.stringify(translations));
      setSavedMessage({
        show: true,
        success: true,
        message: "Translations saved successfully! Refresh the page to see changes."
      });
    } catch (error) {
      setSavedMessage({
        show: true,
        success: false,
        message: "Error saving translations. Please try again."
      });
    }
    setIsLoading(false);
    
    // Hide message after 5 seconds
    setTimeout(() => {
      setSavedMessage(prev => ({ ...prev, show: false }));
    }, 5000);
  };

  // Reset translations to original
  const resetTranslations = () => {
    if (window.confirm("Are you sure you want to reset all translations to their original values?")) {
      setTranslations({ ...originalTranslations });
      localStorage.removeItem("customArabicTranslations");
      setSavedMessage({
        show: true,
        success: true,
        message: "Translations reset to original values."
      });
      
      // Hide message after 5 seconds
      setTimeout(() => {
        setSavedMessage(prev => ({ ...prev, show: false }));
      }, 5000);
    }
  };

  // Filter translations based on search term and selected filter
  const filteredTranslations = Object.entries(translations).filter(([key, value]) => {
    const matchesSearch = searchTerm === "" || 
      key.toLowerCase().includes(searchTerm.toLowerCase()) || 
      value.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Landing page related keys
    const landingPageKeys = [
      "enterprise_solution",
      "intelligent_asset_management_system",
      "comprehensive_platform",
      "get_started",
      "view_demo",
      "barcode_integration",
      "gps_location_tracking",
      "real_time_analytics",
      "inventory_management",
      "maintenance_scheduling",
      "usage_reports",
      "supply_chain_tracking",
      "compliance_monitoring",
      "enterprise_dashboard",
      "system_status",
      "all_systems_operational",
      "resources",
      "enterprise_security",
      "ai_powered_insights",
      "scroll_to_explore",
      "core_capabilities",
      "powerful_management_tools",
      "comprehensive_tools",
      "asset_management",
      "ticketing_system",
      "task_planner",
      "food_supply_management",
      "vehicle_fleet_management",
      "staff_activity_tracking",
      "learn_more",
      "explore_all_features",
      "key_features",
      "designed_to_streamline",
      "interactive_feature_explorer",
      "discover_how",
      "our_impact_by_numbers",
      "trusted_by_enterprises",
      "assets_tracked",
      "enterprise_clients",
      "active_users",
      "uptime_reliability",
      "how_we_compare",
      "see_why",
      "core_systems",
      "ticketing_task_planning",
      "streamline_support",
      "enterprise_grade",
      "priority_based_ticket",
      "categorize_tickets",
      "asset_association",
      "link_tickets_directly",
      "comprehensive_history",
      "track_complete_lifecycle",
      "explore_ticketing_system",
      "kpi_tracking",
      "calendar_integration",
      "visualize_tasks",
      "task_assignment_tracking",
      "assign_tasks_to_team",
      "ai_powered_suggestions",
      "receive_intelligent_task",
      "explore_task_planner",
      "advanced_intelligence",
      "ai_powered_insights_analytics",
      "leverage_machine_learning",
      "anomaly_detection",
      "automatically_identify",
      "predictive_analytics",
      "forecast_future_resource",
      "smart_recommendations",
      "receive_ai_generated",
      "ai_insights_dashboard",
      "live_data",
      "critical_alert",
      "high_priority",
      "vehicle_rental_costs",
      "consumption_anomaly",
      "medium_priority",
      "food_consumption_costs",
      "optimization_opportunity",
      "recommendation",
      "based_on_current_trends",
      "view_all_insights",
      "what_our_clients_say",
      "trusted_by_leading",
      "get_started_today",
      "ready_to_streamline",
      "join_hundreds",
      "sign_up_now",
      "log_in",
      "simple_process",
      "how_it_works",
      "platform_simplifies",
      "track_assets",
      "track_assets_description",
      "manage_resources",
      "manage_resources_description",
      "analyze_data",
      "analyze_data_description",
      "optimize_operations",
      "optimize_operations_description",
      "ready_to_streamline_operations",
      "get_started_transform",
      "start_free_trial",
      "frequently_asked_questions",
      "find_answers",
      "asset_tracking_question",
      "asset_tracking_answer",
      "integration_question",
      "integration_answer",
      "security_question",
      "security_answer",
      "support_question",
      "support_answer",
      "offline_question",
      "offline_answer",
      "customization_question",
      "customization_answer",
      "enterprise_solutions",
      "powerful_tools",
      "comprehensive_suite",
      "all_features",
      "management",
      "intelligence",
      "operations",
      "explore_features",
      "all_features_included",
      "request_demo",
      "enterprise_grade_security",
      "support",
      "free_trial",
      "supports_arabic",
      "dark_light_mode",
      "testimonial_quote_1",
      "testimonial_quote_2",
      "testimonial_quote_3",
      "testimonial_quote_4",
      "testimonial_quote_5",
      "asset_management_title",
      "asset_management_description",
      "ticketing_system_title",
      "ticketing_system_description",
      "task_planner_title",
      "task_planner_description",
      "ai_powered_insights_title",
      "ai_powered_insights_description",
      "food_supply_management_title",
      "food_supply_management_description",
      "vehicle_fleet_management_title",
      "vehicle_fleet_management_description",
      "staff_activity_tracking_title",
      "staff_activity_tracking_description"
    ];
    
    if (filter === "landing") {
      return matchesSearch && landingPageKeys.includes(key);
    } else if (filter === "all") {
      return matchesSearch;
    } else if (filter === "modified") {
      return matchesSearch && translations[key] !== originalTranslations[key];
    }
    
    return matchesSearch;
  });

  return (
    <>
      <Head>
        <title>Arabic Translation Editor</title>
        <meta name="description" content="Edit Arabic translations for the landing page" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      
      <div className="bg-background min-h-screen flex flex-col">
        <Header />
        
        <main className="flex-1 container mx-auto px-4 py-8">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
              <div>
                <h1 className="text-3xl font-bold mb-2">Arabic Translation Editor</h1>
                <p className="text-muted-foreground">Edit Arabic translations for the landing page</p>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  onClick={saveTranslations} 
                  disabled={isLoading}
                  className="flex items-center gap-2"
                >
                  {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Changes
                </Button>
                <Button 
                  variant="outline" 
                  onClick={resetTranslations}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Reset to Original
                </Button>
              </div>
            </div>
            
            {savedMessage.show && (
              <Alert className={savedMessage.success ? "bg-green-500/10 border-green-500/50 mb-6" : "bg-red-500/10 border-red-500/50 mb-6"}>
                {savedMessage.success ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                )}
                <AlertTitle className={savedMessage.success ? "text-green-500" : "text-red-500"}>
                  {savedMessage.success ? "Success" : "Error"}
                </AlertTitle>
                <AlertDescription>
                  {savedMessage.message}
                </AlertDescription>
              </Alert>
            )}
            
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Filter Translations</CardTitle>
                <CardDescription>Search and filter the translations you want to edit</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search translations..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  
                  <Tabs defaultValue="landing" value={filter} onValueChange={setFilter} className="w-full md:w-auto">
                    <TabsList>
                      <TabsTrigger value="landing">Landing Page</TabsTrigger>
                      <TabsTrigger value="modified">Modified</TabsTrigger>
                      <TabsTrigger value="all">All Translations</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </CardContent>
              <CardFooter>
                <div className="text-sm text-muted-foreground">
                  Showing {filteredTranslations.length} of {Object.keys(translations).length} translations
                </div>
              </CardFooter>
            </Card>
            
            <div className="space-y-4">
              {filteredTranslations.map(([key, value]) => {
                const isModified = value !== originalTranslations[key];
                
                return (
                  <Card key={key} className={isModified ? "border-primary/50" : ""}>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-base font-medium">{key}</CardTitle>
                        {isModified && (
                          <Badge className="bg-primary/10 text-primary border-primary/20">
                            Modified
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="text-xs">
                        Original: {originalTranslations[key]}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Input
                        value={value}
                        onChange={(e) => handleTranslationChange(key, e.target.value)}
                        className="font-arabic text-right"
                        dir="rtl"
                      />
                    </CardContent>
                  </Card>
                );
              })}
              
              {filteredTranslations.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No translations found matching your criteria</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}