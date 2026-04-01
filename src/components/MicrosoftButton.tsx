import React from 'react';
import { Button } from '@/components/ui/button';

interface MicrosoftButtonProps {
  onClick: () => void;
  loading?: boolean;
  mode?: 'signin' | 'signup';
}

export function MicrosoftButton({ onClick, loading, mode = 'signin' }: MicrosoftButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full flex items-center justify-center gap-3 border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all"
      onClick={onClick}
      disabled={loading}
    >
      <svg width="20" height="20" viewBox="0 0 23 23" xmlns="http://www.w3.org/2000/svg">
        <rect x="1" y="1" width="10" height="10" fill="#f25022" />
        <rect x="12" y="1" width="10" height="10" fill="#7fba00" />
        <rect x="1" y="12" width="10" height="10" fill="#00a4ef" />
        <rect x="12" y="12" width="10" height="10" fill="#ffb900" />
      </svg>
      <span className="font-medium text-gray-700">
        {loading ? 'Connecting...' : mode === 'signin' ? 'Sign in with Microsoft' : 'Sign up with Microsoft'}
      </span>
    </Button>
  );
}
