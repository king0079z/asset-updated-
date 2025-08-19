import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';

// Simplified version to reduce dependencies
interface SubscriptionKeyInputProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
}

export const SubscriptionKeyInput: React.FC<SubscriptionKeyInputProps> = ({ 
  value, 
  onChange,
  placeholder = "XXX-XXXX-XXXX-XXXX-XXXX"
}) => {
  const [licenseKey, setLicenseKey] = useState(value || '');
  
  useEffect(() => {
    if (value !== undefined) {
      setLicenseKey(value);
    }
  }, [value]);

  const formatLicenseKey = (value: string) => {
    const cleaned = value.replace(/[^A-Za-z0-9]/g, '');
    const upper = cleaned.toUpperCase();
    
    let formatted = '';
    for (let i = 0; i < upper.length; i++) {
      if (i > 0 && i % 4 === 0 && i < upper.length) {
        formatted += '-';
      }
      formatted += upper[i];
    }
    
    return formatted;
  };

  const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatLicenseKey(e.target.value);
    setLicenseKey(formatted);
    
    if (onChange) {
      onChange(formatted);
    }
  };

  return (
    <div className="space-y-2">
      <Input
        id="licenseKey"
        placeholder={placeholder}
        value={licenseKey}
        onChange={handleKeyChange}
        className="text-center font-mono text-lg"
        maxLength={24}
      />
      <p className="text-xs text-muted-foreground text-center">
        Format: XXX-XXXX-XXXX-XXXX-XXXX
      </p>
    </div>
  );
};

export default SubscriptionKeyInput;