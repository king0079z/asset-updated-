import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

interface PasswordStrengthIndicatorProps {
  password: string;
}

const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({ password }) => {
  const strength = useMemo(() => {
    if (!password) return 0;
    
    let score = 0;
    
    // Length check
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    
    // Complexity checks
    if (/[A-Z]/.test(password)) score += 1; // Has uppercase
    if (/[a-z]/.test(password)) score += 1; // Has lowercase
    if (/[0-9]/.test(password)) score += 1; // Has number
    if (/[^A-Za-z0-9]/.test(password)) score += 1; // Has special char
    
    // Normalize to 0-4 range
    return Math.min(4, Math.floor(score / 1.5));
  }, [password]);
  
  const getStrengthLabel = () => {
    if (!password) return '';
    if (strength === 0) return 'Very weak';
    if (strength === 1) return 'Weak';
    if (strength === 2) return 'Fair';
    if (strength === 3) return 'Good';
    return 'Strong';
  };
  
  const getStrengthColor = () => {
    if (!password) return 'bg-muted';
    if (strength === 0) return 'bg-destructive/70';
    if (strength === 1) return 'bg-destructive/50';
    if (strength === 2) return 'bg-amber-500/70';
    if (strength === 3) return 'bg-emerald-500/70';
    return 'bg-emerald-500';
  };
  
  if (!password) return null;
  
  return (
    <div className="mt-1 space-y-1">
      <div className="flex gap-1 h-1">
        {[0, 1, 2, 3].map((index) => (
          <motion.div
            key={index}
            className={`h-full rounded-full ${index < strength ? getStrengthColor() : 'bg-muted'}`}
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 0.4, delay: index * 0.1 }}
            style={{ flexGrow: 1 }}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground flex justify-between">
        <span>Password strength:</span>
        <span className={`
          ${strength === 0 ? 'text-destructive/70' : ''}
          ${strength === 1 ? 'text-destructive/50' : ''}
          ${strength === 2 ? 'text-amber-500/70' : ''}
          ${strength === 3 ? 'text-emerald-500/70' : ''}
          ${strength === 4 ? 'text-emerald-500' : ''}
          font-medium
        `}>
          {getStrengthLabel()}
        </span>
      </p>
    </div>
  );
};

export default PasswordStrengthIndicator;