import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/contexts/TranslationContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { AlertCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Define ticket priority enum to match Prisma schema
enum TicketPriority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL"
}

interface Asset {
  id: string;
  name: string;
  assetId: string;
}

interface StaffMember {
  id: string;
  email: string;
}

interface CreateTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTicketCreated?: () => void;
  assetId?: string;
}

export function CreateTicketDialog({ open, onOpenChange, onTicketCreated, assetId: initialAssetId }: CreateTicketDialogProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TicketPriority>(TicketPriority.MEDIUM);
  const [assetId, setAssetId] = useState<string>("none");
  const [assignedToId, setAssignedToId] = useState<string>("none");
  const [requesterName, setRequesterName] = useState("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      // Reset form when dialog opens
      setTitle("");
      setDescription("");
      setPriority(TicketPriority.MEDIUM);
      setAssetId(initialAssetId || "none");
      setAssignedToId("none");
      setRequesterName("");
      setError(null);
      
      // Fetch assets and staff members for the dropdowns
      fetchAssets();
      fetchStaffMembers();
    }
  }, [open, initialAssetId]);
  
  const fetchStaffMembers = async () => {
    setIsLoadingStaff(true);
    try {
      console.log("Fetching staff members for ticket assignment...");
      
      const response = await fetch("/api/planner/users", {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        console.error(`Failed to fetch staff members. Status: ${response.status}`);
        setStaffMembers([]);
        return;
      }
      
      const data = await response.json();
      
      // Check if data has a users property that is an array
      if (data && data.users && Array.isArray(data.users)) {
        console.log(`Successfully fetched ${data.users.length} staff members`);
        const validatedStaff = data.users.map(staff => ({
          id: staff.id || "",
          email: staff.email || "Unknown Email"
        }));
        setStaffMembers(validatedStaff);
      } else if (Array.isArray(data)) {
        // Fallback for direct array response
        console.log(`Successfully fetched ${data.length} staff members`);
        const validatedStaff = data.map(staff => ({
          id: staff.id || "",
          email: staff.email || "Unknown Email"
        }));
        setStaffMembers(validatedStaff);
      } else {
        console.error("Unexpected staff data format:", data);
        setStaffMembers([]);
      }
    } catch (error) {
      console.error("Error fetching staff members:", error);
      setStaffMembers([]);
    } finally {
      setIsLoadingStaff(false);
    }
  };

  const fetchAssets = async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log("Fetching assets for ticket creation...");
      
      // Wrap the fetch in a try-catch to handle network errors
      let response;
      try {
        response = await fetch("/api/assets", {
          // Add cache control to prevent stale data
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
      } catch (fetchError) {
        console.error("Network error fetching assets:", fetchError);
        // Don't throw, just set empty assets and continue
        setAssets([]);
        setIsLoading(false);
        return;
      }
      
      console.log("Assets API response status:", response.status);
      
      if (!response.ok) {
        console.error(`Failed to fetch assets. Status: ${response.status}`);
        // Don't throw, just set empty assets and continue
        setAssets([]);
        setIsLoading(false);
        return;
      }
      
      // Parse the JSON response with error handling
      let data;
      try {
        const text = await response.text();
        console.log("Raw assets response:", text.substring(0, 100) + (text.length > 100 ? '...' : ''));
        
        // Only try to parse if we have content
        if (text.trim()) {
          try {
            data = JSON.parse(text);
          } catch (jsonError) {
            console.error("JSON parse error for assets:", jsonError);
            // Don't throw, just set empty assets and continue
            setAssets([]);
            setIsLoading(false);
            return;
          }
        } else {
          console.log("Empty response from assets API");
          data = [];
        }
      } catch (parseError) {
        console.error("Error parsing assets data:", parseError);
        // Don't throw, just set empty assets and continue
        setAssets([]);
        setIsLoading(false);
        return;
      }
      
      if (Array.isArray(data)) {
        console.log(`Successfully fetched ${data.length} assets`);
        // Ensure each asset has the required properties
        const validatedAssets = data.map(asset => ({
          id: asset.id || "",
          name: asset.name || "Unnamed Asset",
          assetId: asset.assetId || ""
        }));
        setAssets(validatedAssets);
      } else {
        console.error("Unexpected assets data format:", data);
        setAssets([]);
      }
    } catch (error) {
      console.error("Error fetching assets:", error);
      // Just log the error and set empty assets, don't show toast to avoid UI disruption
      setAssets([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    try {
      e.preventDefault();
      setError(null);
      
      // Check if all required fields are filled
      if (!title.trim() || 
          !description.trim() || 
          !priority || 
          assetId === "none" || 
          assignedToId === "none" || 
          !requesterName.trim()) {
        toast({
          title: t("missing_information"),
          description: t("please_fill_all_required_fields"),
          variant: "destructive",
        });
        return;
      }

      // Check if user is authenticated
      if (!user || !user.id) {
        console.error("User not authenticated");
        setError(t("must_be_logged_in"));
        toast({
          title: t("authentication_error"),
          description: t("must_be_logged_in_refresh"),
          variant: "destructive",
        });
        return;
      }

      setIsSubmitting(true);
      console.log("Submitting ticket creation form...");

      try {
        // Only include assetId and assignedToId if they're not empty, "none", or "no_assets"/"no_staff"
        const ticketData = {
          title: title.trim(),
          description: description.trim(),
          priority,
          ...(assetId && assetId !== "" && assetId !== "none" && assetId !== "no_assets" ? { assetId } : {}),
          ...(assignedToId && assignedToId !== "" && assignedToId !== "none" && assignedToId !== "no_staff" ? { assignedToId } : {}),
          ...(requesterName.trim() !== "" ? { requesterName: requesterName.trim() } : {})
        };
        
        console.log("Ticket data to submit:", ticketData);
        
        // Wrap the fetch in a try-catch to handle network errors
        let response;
        try {
          response = await fetch("/api/tickets", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            },
            body: JSON.stringify(ticketData),
          });
        } catch (fetchError) {
          console.error("Network error creating ticket:", fetchError);
          throw new Error("Network error: Could not connect to the server. Please check your connection and try again.");
        }

        console.log("Ticket creation response status:", response.status);
        
        if (!response.ok) {
          let errorMessage = "Failed to create ticket";
          try {
            const errorText = await response.text();
            console.error("Error response text:", errorText);
            
            try {
              const errorData = JSON.parse(errorText);
              console.error("Error response data:", errorData);
              if (errorData && errorData.error) {
                errorMessage = errorData.error;
              }
            } catch (jsonError) {
              console.error("Error parsing error JSON:", jsonError);
              // If we can't parse JSON, use the text as the error message if it exists
              if (errorText && errorText.trim()) {
                errorMessage = errorText.trim();
              }
            }
          } catch (parseError) {
            console.error("Error parsing error response:", parseError);
          }
          throw new Error(errorMessage);
        }

        // Try to parse the response to confirm it's valid
        let responseData;
        try {
          const responseText = await response.text();
          console.log("Raw ticket creation response:", responseText.substring(0, 100) + (responseText.length > 100 ? '...' : ''));
          
          if (responseText.trim()) {
            try {
              responseData = JSON.parse(responseText);
              console.log("Ticket created successfully:", responseData.id);
            } catch (jsonError) {
              console.error("JSON parse error for ticket creation response:", jsonError);
              // Continue anyway since the request was successful
            }
          }
        } catch (parseError) {
          console.error("Error parsing success response:", parseError);
          // Continue anyway since the request was successful
        }

        toast({
          title: t("success"),
          description: t("ticket_created_successfully"),
        });
        
        // Reset form fields
        setTitle("");
        setDescription("");
        setPriority(TicketPriority.MEDIUM);
        setAssetId("none");
        
        // Close dialog and refresh tickets
        onOpenChange(false);
        if (onTicketCreated) {
          try {
            setTimeout(() => {
              onTicketCreated();
            }, 500); // Small delay to ensure dialog is closed first
          } catch (callbackError) {
            console.error("Error in onTicketCreated callback:", callbackError);
            // Don't throw here, just log the error
          }
        }
      } catch (error) {
        console.error("Error creating ticket:", error);
        const errorMessage = error instanceof Error ? error.message : t("failed_to_create_ticket");
        setError(errorMessage);
        toast({
          title: t("error"),
          description: errorMessage,
          variant: "destructive",
        });
      } finally {
        setIsSubmitting(false);
      }
    } catch (outerError) {
      // This catches any errors that might occur in the event handler itself
      console.error("Critical error in submit handler:", outerError);
      toast({
        title: t("application_error"),
        description: t("unexpected_error_try_again"),
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      // Only allow closing if not submitting
      if (!isSubmitting || !newOpen) {
        onOpenChange(newOpen);
      }
    }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">{t("create_ticket")}</DialogTitle>
        </DialogHeader>
        
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title" className="font-medium">
              {t("title")} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("enter_ticket_title")}
              required
              disabled={isSubmitting}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description" className="font-medium">
              {t("description")} <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("describe_issue_in_detail")}
              rows={4}
              required
              disabled={isSubmitting}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority" className="font-medium">
                {t("priority")} <span className="text-red-500">*</span>
              </Label>
              <Select 
                value={priority} 
                onValueChange={(value) => setPriority(value as TicketPriority)}
                disabled={isSubmitting}
              >
                <SelectTrigger id="priority">
                  <SelectValue placeholder={t("select_priority")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TicketPriority.LOW}>{t("priority_low")}</SelectItem>
                  <SelectItem value={TicketPriority.MEDIUM}>{t("priority_medium")}</SelectItem>
                  <SelectItem value={TicketPriority.HIGH}>{t("priority_high")}</SelectItem>
                  <SelectItem value={TicketPriority.CRITICAL}>{t("priority_critical")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="asset" className="font-medium">
                {t("related_asset")} <span className="text-red-500">*</span>
              </Label>
              <Select 
                value={assetId || "none"} 
                onValueChange={(value) => setAssetId(value)}
                disabled={isLoading || isSubmitting}
              >
                <SelectTrigger id="asset">
                  <SelectValue placeholder={isLoading ? t("loading_assets") : t("select_asset")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("none")}</SelectItem>
                  {assets && assets.length > 0 ? (
                    assets.map((asset) => (
                      <SelectItem key={asset.id} value={asset.id}>
                        {asset.name || `${t("asset")} ${asset.assetId}`}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no_assets" disabled>
                      {isLoading ? t("loading_assets") : t("no_assets_available")}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="assignedTo" className="font-medium">
              {t("assign_to_staff")} <span className="text-red-500">*</span>
            </Label>
            <Select 
              value={assignedToId || "none"} 
              onValueChange={(value) => setAssignedToId(value)}
              disabled={isLoadingStaff || isSubmitting}
            >
              <SelectTrigger id="assignedTo">
                <SelectValue placeholder={isLoadingStaff ? t("loading_staff") : t("select_staff")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("none")}</SelectItem>
                {staffMembers && staffMembers.length > 0 ? (
                  staffMembers.map((staff) => (
                    <SelectItem key={staff.id} value={staff.id}>
                      {staff.email}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no_staff" disabled>
                    {isLoadingStaff ? t("loading_staff") : t("no_staff_available")}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="requesterName" className="font-medium">
              {t("requester_name")} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="requesterName"
              value={requesterName}
              onChange={(e) => setRequesterName(e.target.value)}
              placeholder={t("enter_requester_name")}
              required
              disabled={isSubmitting}
            />
          </div>
          
          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  <span>{t("creating")}</span>
                </>
              ) : (
                t("create_ticket")
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}