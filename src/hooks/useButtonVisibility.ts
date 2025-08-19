import { useContext, useState, useEffect } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import { createClient } from '@/util/supabase/component';

/**
 * Hook to provide button visibility information for the current user
 * This hook fetches the user's button visibility permissions
 * and provides a function to check if a button should be visible
 */
export function useButtonVisibility() {
  const { user } = useContext(AuthContext);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [buttonVisibility, setButtonVisibility] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<boolean>(true);
  
  useEffect(() => {
    const fetchButtonVisibility = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('User')
          .select('isAdmin, buttonVisibility')
          .eq('id', user.id)
          .single();
        
        if (error) {
          console.error('Error fetching button visibility:', error);
          setLoading(false);
          return;
        }
        
        setIsAdmin(data.isAdmin || false);
        setButtonVisibility(data.buttonVisibility || {});
        setLoading(false);
      } catch (error) {
        console.error('Error in useButtonVisibility:', error);
        setLoading(false);
      }
    };
    
    fetchButtonVisibility();
  }, [user]);
  
  /**
   * Check if a button should be visible to the current user
   * 
   * @param buttonId The ID of the button to check visibility for
   * @returns Boolean indicating if the button should be visible
   */
  const isButtonVisible = (buttonId: string): boolean => {
    if (!user) return false;
    
    // Admin can see all buttons
    if (isAdmin) return true;
    
    // Check button visibility from the buttonVisibility JSON field
    if (buttonVisibility && buttonVisibility[buttonId] === true) {
      return true;
    }
    
    return false;
  };
  
  return {
    isButtonVisible,
    loading
  };
}