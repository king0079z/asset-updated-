import React, { useEffect, useState } from 'react';
import { AlertCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/router';
import { useOrganization } from '@/contexts/OrganizationContext';

export const SubscriptionExpirationBar = () => {
  const { subscription } = useOrganization();
  const router = useRouter();
  const [showBar, setShowBar] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState(0);
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    // Only show for active subscriptions with an end date
    if (!subscription || !subscription.endDate || !subscription.isActive) {
      setShowBar(false);
      return;
    }

    const endDate = new Date(subscription.endDate);
    const now = new Date();
    const timeDiff = endDate.getTime() - now.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

    // Show notification bar if less than 60 days (2 months) remaining
    if (daysDiff <= 60 && daysDiff > 0) {
      setShowBar(true);
      setDaysRemaining(daysDiff);
    } else {
      setShowBar(false);
    }
  }, [subscription]);

  useEffect(() => {
    if (!showBar) return;

    // Update countdown timer
    const updateCountdown = () => {
      if (!subscription?.endDate) return;
      
      const endDate = new Date(subscription.endDate);
      const now = new Date();
      const timeDiff = endDate.getTime() - now.getTime();
      
      if (timeDiff <= 0) {
        setCountdown('Expired');
        return;
      }
      
      const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
      
      setCountdown(`${days}d ${hours}h ${minutes}m`);
    };

    // Initial update
    updateCountdown();
    
    // Update every minute
    const interval = setInterval(updateCountdown, 60000);
    
    return () => clearInterval(interval);
  }, [showBar, subscription]);

  if (!showBar) return null;

  const handleRenewClick = () => {
    router.push('/settings/organization?tab=subscription');
  };

  return (
    <div className="bg-amber-50 border-b border-amber-200 text-amber-800 px-4 py-2 flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <AlertCircle className="h-5 w-5 text-amber-500" />
        <span>
          <strong>Your subscription expires soon!</strong> Only {daysRemaining} days remaining.
        </span>
      </div>
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-1 bg-amber-100 px-3 py-1 rounded-full">
          <Clock className="h-4 w-4" />
          <span className="font-mono">{countdown}</span>
        </div>
        <Button 
          size="sm" 
          variant="default" 
          className="bg-amber-600 hover:bg-amber-700 text-white"
          onClick={handleRenewClick}
        >
          Renew Now
        </Button>
      </div>
    </div>
  );
};