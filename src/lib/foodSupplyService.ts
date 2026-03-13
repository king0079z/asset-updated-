import { toast } from '@/components/ui/use-toast';

// Types
export interface Kitchen {
  id: string;
  name: string;
  floorNumber: string;
  description?: string;
}

export interface KitchenAssignment {
  id: string;
  kitchenId: string;
  kitchen: Kitchen;
}

export interface FoodSupply {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  pricePerUnit: number;
  expirationDate: string;
  totalWasted: number;
  kitchenId: string;
  kitchenSupplies?: {
    id: string;
    kitchenId: string;
    quantity: number;
    expirationDate: string;
    kitchen: {
      id: string;
      name: string;
    };
  }[];
}

/**
 * Fetches kitchen assignments for the current user
 */
export async function getKitchenAssignments(): Promise<KitchenAssignment[]> {
  try {
    const response = await fetch('/api/kitchens/assignments', {
      credentials: 'include',
      headers: {
        'Cache-Control': 'no-cache',
      },
    });

    if (!response.ok) {
      throw new Error(`Error fetching kitchen assignments: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error in getKitchenAssignments:', error);
    return [];
  }
}

/**
 * Fetches food supplies for a specific kitchen
 */
export async function getFoodSupplies(kitchenId: string, forceRefresh = false): Promise<FoodSupply[]> {
  try {
    const url = `/api/food-supply?kitchenId=${kitchenId}`;
    
    const response = await fetch(url, {
      credentials: 'include',
      headers: forceRefresh ? { 'Cache-Control': 'no-cache' } : {},
    });

    if (!response.ok) {
      throw new Error(`Error fetching food supplies: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error in getFoodSupplies:', error);
    return [];
  }
}

/**
 * Utility function to filter expiring items
 */
export function getExpiringItems(foodSupplies: FoodSupply[], daysThreshold = 7): FoodSupply[] {
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);
  
  return foodSupplies.filter(item => {
    const expirationDate = new Date(item.expirationDate);
    return expirationDate <= thresholdDate;
  });
}

/**
 * Utility function to filter low stock items
 */
export function getLowStockItems(foodSupplies: FoodSupply[], threshold = 0.2): FoodSupply[] {
  if (foodSupplies.length === 0) return [];
  
  // Calculate average quantity
  const averageQuantity = foodSupplies.reduce((sum, item) => sum + item.quantity, 0) / foodSupplies.length;
  
  // Return items below threshold
  return foodSupplies.filter(item => item.quantity < (averageQuantity * threshold));
}

/**
 * Utility function to fetch data with caching
 */
export async function fetchWithCache<T>(
  url: string, 
  options: RequestInit = {}, 
  forceRefresh = false
): Promise<T | null> {
  try {
    // Add credentials and cache control headers
    const fetchOptions: RequestInit = {
      ...options,
      credentials: 'include',
      headers: {
        ...options.headers,
        ...(forceRefresh ? { 'Cache-Control': 'no-cache' } : {}),
      },
    };

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      throw new Error(`Error fetching data: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching from ${url}:`, error);
    return null;
  }
}

/**
 * Consumes food supply from a kitchen
 */
export async function consumeFoodSupply(
  kitchenId: string,
  foodSupplyId: string,
  quantity: number
): Promise<boolean> {
  try {
    const response = await fetch('/api/food-supply/consume', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        kitchenId,
        foodSupplyId,
        quantity,
      }),
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to consume food supply');
    }

    return true;
  } catch (error) {
    console.error('Error consuming food supply:', error);
    toast({
      title: 'Error',
      description: error instanceof Error ? error.message : 'Failed to consume food supply',
      variant: 'destructive',
    });
    return false;
  }
}

/**
 * Records food waste
 */
export async function recordFoodWaste(
  kitchenId: string,
  foodSupplyId: string,
  quantity: number,
  reason: string
): Promise<boolean> {
  try {
    const response = await fetch('/api/food-supply/dispose', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        kitchenId,
        foodSupplyId,
        quantity,
        reason,
      }),
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to record food waste');
    }

    return true;
  } catch (error) {
    console.error('Error recording food waste:', error);
    toast({
      title: 'Error',
      description: error instanceof Error ? error.message : 'Failed to record food waste',
      variant: 'destructive',
    });
    return false;
  }
}

/**
 * Orders food supplies for a kitchen
 */
export async function orderFoodSupplies(
  kitchenId: string,
  items: { foodSupplyId: string; quantity: number }[]
): Promise<boolean> {
  try {
    const response = await fetch('/api/food-supply/order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        kitchenId,
        items,
      }),
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to order food supplies');
    }

    return true;
  } catch (error) {
    console.error('Error ordering food supplies:', error);
    toast({
      title: 'Error',
      description: error instanceof Error ? error.message : 'Failed to order food supplies',
      variant: 'destructive',
    });
    return false;
  }
}

/**
 * Gets consumption history for a kitchen
 */
export async function getConsumptionHistory(kitchenId: string): Promise<any[]> {
  try {
    const response = await fetch(`/api/food-supply/consumption-history?kitchenId=${kitchenId}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Error fetching consumption history: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error in getConsumptionHistory:', error);
    return [];
  }
}

/**
 * Gets waste history for a kitchen
 */
export async function getWasteHistory(kitchenId: string): Promise<any[]> {
  try {
    const response = await fetch(`/api/food-supply/disposals?kitchenId=${kitchenId}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Error fetching waste history: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error in getWasteHistory:', error);
    return [];
  }
}

/**
 * Gets recipes for a kitchen
 */
export async function getRecipes(kitchenId: string): Promise<any[]> {
  try {
    const response = await fetch(`/api/recipes?kitchenId=${kitchenId}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Error fetching recipes: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error in getRecipes:', error);
    return [];
  }
}

/**
 * Uses a recipe in a kitchen
 */
export async function useRecipe(
  kitchenId: string,
  recipeId: string,
  quantity: number = 1
): Promise<boolean> {
  try {
    const response = await fetch('/api/recipes/use', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        kitchenId,
        recipeId,
        quantity,
      }),
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to use recipe');
    }

    return true;
  } catch (error) {
    console.error('Error using recipe:', error);
    toast({
      title: 'Error',
      description: error instanceof Error ? error.message : 'Failed to use recipe',
      variant: 'destructive',
    });
    return false;
  }
}