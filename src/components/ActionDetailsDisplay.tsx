import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, AlertCircle, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ActionDetailsProps {
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: any;
}

export function ActionDetailsDisplay({ action, resourceType, resourceId, details }: ActionDetailsProps) {
  // Format action for display
  const formatAction = (action: string) => {
    return action
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, char => char.toUpperCase());
  };

  // Get resource name from details if available
  const getResourceName = () => {
    if (!details) return null;
    
    // Different resource types store names in different fields
    switch (resourceType.toUpperCase()) {
      case 'ASSET':
        return details.name || details.assetName || details.asset?.name;
      case 'VEHICLE':
        return details.licensePlate || details.registrationNumber || details.vehicle?.licensePlate;
      case 'USER':
        return details.name || details.userName || details.email || details.user?.email;
      case 'TICKET':
        return details.ticketNumber || details.displayId || details.ticket?.displayId;
      case 'FOOD_SUPPLY':
        return details.name || details.itemName || details.foodSupply?.name;
      default:
        // Try to find a name field in the details
        return details.name || details.title || details.displayName || null;
    }
  };

  // Get action type (create, update, delete, etc.)
  const getActionType = () => {
    const actionUpper = action.toUpperCase();
    if (actionUpper.includes('CREATE') || actionUpper.includes('ADD')) return 'create';
    if (actionUpper.includes('UPDATE') || actionUpper.includes('EDIT') || actionUpper.includes('MODIFY')) return 'update';
    if (actionUpper.includes('DELETE') || actionUpper.includes('REMOVE')) return 'delete';
    if (actionUpper.includes('MOVE') || actionUpper.includes('TRANSFER')) return 'move';
    if (actionUpper.includes('ASSIGN')) return 'assign';
    if (actionUpper.includes('VIEW') || actionUpper.includes('ACCESS')) return 'view';
    if (actionUpper.includes('CONSUME')) return 'consume';
    return 'other';
  };

  // Get badge color based on action type
  const getBadgeVariant = () => {
    const actionType = getActionType();
    switch (actionType) {
      case 'create': return 'outline' as const;
      case 'update': return 'secondary' as const;
      case 'delete': return 'destructive' as const;
      case 'move': return 'default' as const;
      case 'assign': return 'default' as const;
      case 'view': return 'outline' as const;
      case 'consume': return 'default' as const;
      default: return 'outline' as const;
    }
  };
  
  // Get badge color class based on action type
  const getActionBadgeColor = () => {
    const actionType = getActionType();
    switch (actionType) {
      case 'create': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100';
      case 'update': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100';
      case 'delete': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100';
      case 'move': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100';
      case 'assign': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100';
      case 'view': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100';
      case 'consume': return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100';
    }
  };

  // Get specific details about what was changed
  const getChangeDetails = () => {
    if (!details) return null;
    
    const actionType = getActionType();
    const actionUpper = action.toUpperCase();
    
    // For updates, try to extract what fields were changed
    if (actionType === 'update' && details.changes) {
      const changedFields = Object.keys(details.changes);
      if (changedFields.length > 0) {
        // For asset updates, we'll show the detailed view using renderAssetChanges()
        // Just return a summary here, the detailed view will be shown separately
        if (resourceType.toUpperCase() === 'ASSET') {
          // If status was changed, highlight that specifically
          if (changedFields.includes('status')) {
            const statusChange = details.changes.status;
            return `Status changed from ${statusChange.from || '(none)'} to ${statusChange.to}`;
          }
          
          // For other important fields, show specific changes
          const importantFields = ['type', 'location', 'name'];
          for (const field of importantFields) {
            if (changedFields.includes(field)) {
              const change = details.changes[field];
              return `${formatFieldName(field)} changed from ${change.from || '(none)'} to ${change.to}`;
            }
          }
          
          // Default summary for other changes
          return `Updated ${changedFields.length} field${changedFields.length > 1 ? 's' : ''}`;
        }
        return `Changed: ${changedFields.map(f => formatFieldName(f)).join(', ')}`;
      }
    }
    
    // For moves, show from/to locations
    if (actionType === 'move') {
      if (details.fromLocation && details.toLocation) {
        return `From ${details.fromLocation} to ${details.toLocation}`;
      }
      if (details.location) {
        return `To ${details.location}`;
      }
    }
    
    // For assignments, show who was assigned
    if (actionType === 'assign') {
      if (details.assignedTo) {
        return `To ${details.assignedTo}`;
      }
      if (details.userId || details.userEmail) {
        return `To ${details.userEmail || details.userId}`;
      }
    }
    
    // For food consumption, show food item and quantity
    if (actionUpper.includes('CONSUME') && resourceType.toUpperCase() === 'FOOD_SUPPLY') {
      const foodName = details.foodSupplyName;
      const quantity = details.quantity;
      const kitchenName = details.kitchenName;
      
      let consumptionDetails = '';
      if (foodName) consumptionDetails += foodName;
      if (quantity) consumptionDetails += consumptionDetails ? ` - ${quantity}` : quantity;
      if (kitchenName) consumptionDetails += consumptionDetails ? ` at ${kitchenName}` : kitchenName;
      
      return consumptionDetails || null;
    }
    
    return null;
  };
  
  // Format field name for display
  const formatFieldName = (fieldName: string) => {
    return fieldName
      .replace(/([A-Z])/g, ' $1') // Add space before capital letters
      .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
      .replace(/Id$/i, 'ID') // Replace "Id" with "ID"
      .replace(/Url$/i, 'URL'); // Replace "Url" with "URL"
  };
  
  // Render detailed asset changes
  const renderAssetChanges = () => {
    // Check if this is an asset update action
    const isAssetUpdate = resourceType.toUpperCase() === 'ASSET' && 
                          action.toUpperCase().includes('UPDATE');
    
    // Check for changes in details or details.changes
    const changes = details?.changes || 
                   (details && isAssetUpdate && action.toUpperCase() === 'ASSET_UPDATED' ? details : null);
    
    if (!changes) {
      return null;
    }
    
    // Determine which object contains the changes
    let changesObj = changes;
    if (isAssetUpdate && details.changes) {
      changesObj = details.changes;
    }
    
    const changedFields = Object.keys(changesObj);
    if (changedFields.length === 0) return null;
    
    // Filter out non-change fields
    const relevantChanges = changedFields.filter(field => 
      !['assetId', 'assetName', 'timestamp', 'userId', 'userEmail', 'action'].includes(field)
    );
    
    if (relevantChanges.length === 0) return null;
    
    return (
      <Collapsible className="mt-2 w-full">
        <div className="flex items-center gap-1">
          <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ChevronRight className="h-3 w-3 transition-transform ui-expanded:rotate-90" />
            <span>View {relevantChanges.length} change{relevantChanges.length > 1 ? 's' : ''}</span>
          </CollapsibleTrigger>
        </div>
        
        <CollapsibleContent className="mt-2 space-y-2 text-sm border-l-2 border-muted pl-3 py-1">
          <div className="font-medium text-xs">Asset Update Details:</div>
          {relevantChanges.map(field => {
            const change = changesObj[field];
            
            // Handle different formats of change data
            let fromValue, toValue;
            
            if (change && typeof change === 'object' && ('from' in change || 'to' in change)) {
              // Standard format with from/to properties
              fromValue = change.from !== null && change.from !== undefined 
                ? typeof change.from === 'object' 
                  ? JSON.stringify(change.from) 
                  : String(change.from) 
                : '(empty)';
              toValue = change.to !== null && change.to !== undefined 
                ? typeof change.to === 'object' 
                  ? JSON.stringify(change.to) 
                  : String(change.to) 
                : '(empty)';
            } else {
              // For other formats, just show the value
              fromValue = '(previous value)';
              toValue = change !== null && change !== undefined 
                ? typeof change === 'object' 
                  ? JSON.stringify(change) 
                  : String(change) 
                : '(empty)';
            }
            
            // Format boolean values for better readability
            const displayFromValue = fromValue === 'true' ? 'Yes' : 
                                    fromValue === 'false' ? 'No' : 
                                    fromValue;
            
            const displayToValue = toValue === 'true' ? 'Yes' : 
                                  toValue === 'false' ? 'No' : 
                                  toValue;
            
            // Use special styling for status changes
            const isStatusField = field.toLowerCase() === 'status';
            const statusBadgeVariant = isStatusField ? 'default' : 'outline';
            
            // Get status-specific badge colors
            const getStatusBadgeColor = (status: string) => {
              const statusLower = status.toLowerCase();
              if (statusLower === 'active') return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100';
              if (statusLower === 'disposal' || statusLower === 'disposed') return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100';
              if (statusLower === 'maintenance') return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100';
              if (statusLower === 'inactive') return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100';
              return '';
            };
            
            return (
              <div key={field} className="grid grid-cols-[auto,1fr] gap-2 items-start">
                <Badge variant={statusBadgeVariant} className="text-xs px-2 py-0.5 whitespace-nowrap">
                  {formatFieldName(field)}
                </Badge>
                <div className="text-xs">
                  <span className="text-muted-foreground">From: </span>
                  {isStatusField ? (
                    <span className={`font-medium px-1.5 py-0.5 rounded-sm ${getStatusBadgeColor(displayFromValue)}`}>
                      {displayFromValue}
                    </span>
                  ) : (
                    <span className="font-medium">{displayFromValue}</span>
                  )}
                  <span className="mx-1 text-muted-foreground">→</span>
                  <span className="text-muted-foreground">To: </span>
                  {isStatusField ? (
                    <span className={`font-medium px-1.5 py-0.5 rounded-sm ${getStatusBadgeColor(displayToValue)}`}>
                      {displayToValue}
                    </span>
                  ) : (
                    <span className="font-medium">{displayToValue}</span>
                  )}
                </div>
              </div>
            );
          })}
        </CollapsibleContent>
      </Collapsible>
    );
  };
  
  // Render detailed changes for other resource types
  const renderGenericChanges = () => {
    // Only show for update actions
    if (getActionType() !== 'update' || !details?.changes) {
      return null;
    }
    
    // Skip for assets (they have their own detailed view)
    if (resourceType.toUpperCase() === 'ASSET') {
      return null;
    }
    
    const changedFields = Object.keys(details.changes);
    if (changedFields.length === 0) return null;
    
    // Filter out non-change fields
    const relevantChanges = changedFields.filter(field => 
      !['id', 'timestamp', 'userId', 'userEmail', 'action'].includes(field)
    );
    
    if (relevantChanges.length === 0) return null;
    
    return (
      <Collapsible className="mt-2 w-full">
        <div className="flex items-center gap-1">
          <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ChevronRight className="h-3 w-3 transition-transform ui-expanded:rotate-90" />
            <span>View {relevantChanges.length} change{relevantChanges.length > 1 ? 's' : ''}</span>
          </CollapsibleTrigger>
        </div>
        
        <CollapsibleContent className="mt-2 space-y-2 text-sm border-l-2 border-muted pl-3 py-1">
          <div className="font-medium text-xs">{resourceType} Update Details:</div>
          {relevantChanges.map(field => {
            const change = details.changes[field];
            
            // Handle different formats of change data
            let fromValue, toValue;
            
            if (change && typeof change === 'object' && ('from' in change || 'to' in change)) {
              // Standard format with from/to properties
              fromValue = change.from !== null && change.from !== undefined 
                ? typeof change.from === 'object' 
                  ? JSON.stringify(change.from) 
                  : String(change.from) 
                : '(empty)';
              toValue = change.to !== null && change.to !== undefined 
                ? typeof change.to === 'object' 
                  ? JSON.stringify(change.to) 
                  : String(change.to) 
                : '(empty)';
            } else {
              // For other formats, just show the value
              fromValue = '(previous value)';
              toValue = change !== null && change !== undefined 
                ? typeof change === 'object' 
                  ? JSON.stringify(change) 
                  : String(change) 
                : '(empty)';
            }
            
            return (
              <div key={field} className="grid grid-cols-[auto,1fr] gap-2 items-start">
                <Badge variant="outline" className="text-xs px-2 py-0.5 whitespace-nowrap">
                  {formatFieldName(field)}
                </Badge>
                <div className="text-xs">
                  <span className="text-muted-foreground">From: </span>
                  <span className="font-medium">{fromValue}</span>
                  <span className="mx-1 text-muted-foreground">→</span>
                  <span className="text-muted-foreground">To: </span>
                  <span className="font-medium">{toValue}</span>
                </div>
              </div>
            );
          })}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  const resourceName = getResourceName();
  const changeDetails = getChangeDetails();
  const actionType = getActionType();
  const badgeColor = getActionBadgeColor();

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2">
        <Badge className={`capitalize text-xs ${badgeColor}`}>
          {actionType}
        </Badge>
        <span className="font-medium">{formatAction(action)}</span>
      </div>
      
      {resourceName && (
        <div className="text-sm text-muted-foreground mt-1">
          <span className="font-medium">{resourceType}:</span> {resourceName}
        </div>
      )}
      
      {changeDetails && (
        <div className="text-sm text-muted-foreground mt-1">
          {changeDetails}
        </div>
      )}
      
      {renderAssetChanges()}
      {renderGenericChanges()}
      
      {details && !changeDetails && !renderAssetChanges() && !renderGenericChanges() && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground cursor-help">
                <Info className="h-3 w-3" />
                <span>Additional details available</span>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-xs">
                {JSON.stringify(details, null, 2)}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}