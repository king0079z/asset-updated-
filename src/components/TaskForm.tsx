import { useState, useEffect } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSafePlanner } from '@/hooks/useSafePlanner';

interface Asset {
  id: string;
  name: string;
}

interface User {
  id: string;
  email: string;
}

interface TaskFormProps {
  onSubmit: (data: any) => void;
  onCancel: () => void;
  initialData?: any;
  isEditing?: boolean;
}

export function TaskForm({ onSubmit, onCancel, initialData, isEditing = false }: TaskFormProps) {
  const { t } = useTranslation();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const { isReady, isIframe } = useSafePlanner(); // Use our safe hook
  
  // Ensure we have valid date objects
  const getValidDate = (dateValue: any): Date => {
    if (!dateValue) return new Date();
    
    try {
      // Handle both Date objects and string dates
      if (dateValue instanceof Date) {
        return isNaN(dateValue.getTime()) ? new Date() : dateValue;
      }
      
      const date = new Date(dateValue);
      // Check if date is valid
      return isNaN(date.getTime()) ? new Date() : date;
    } catch (error) {
      console.error("Invalid date value:", dateValue);
      return new Date();
    }
  };
  
  const [users, setUsers] = useState<User[]>([]);
  
  // Initialize form data with safe defaults
  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    description: initialData?.description || '',
    startDate: getValidDate(initialData?.startDate),
    endDate: initialData?.endDate ? getValidDate(initialData.endDate) : null,
    priority: initialData?.priority || 'MEDIUM',
    status: initialData?.status || 'PLANNED',
    assetId: initialData?.assetId || '',
    aiSuggested: initialData?.aiSuggested || false,
    aiNotes: initialData?.aiNotes || '',
    assignedToUserId: initialData?.assignedToUserId || '',
    estimatedHours: initialData?.estimatedHours || '',
    actualHours: initialData?.actualHours || '',
  });

  useEffect(() => {
    // Fetch assets for the dropdown
    const fetchAssets = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/assets');
        if (response.ok) {
          const data = await response.json();
          setAssets(data);
        } else {
          console.error('Failed to fetch assets:', response.status);
          // Set empty array to prevent errors
          setAssets([]);
        }
      } catch (error) {
        console.error('Error fetching assets:', error);
        // Set empty array to prevent errors
        setAssets([]);
      } finally {
        setLoading(false);
      }
    };

    // Fetch users for assignment dropdown
    const fetchUsers = async () => {
      try {
        const response = await fetch('/api/planner/users');
        if (response.ok) {
          const data = await response.json();
          // Check if the response has a users property (API returns { users: [...] })
          if (data.users && Array.isArray(data.users)) {
            setUsers(data.users);
          } else if (Array.isArray(data)) {
            // Fallback in case the API returns the array directly
            setUsers(data);
          } else {
            console.error('Unexpected users data format:', data);
            setUsers([]);
          }
        } else {
          console.error('Failed to fetch users:', response.status);
          setUsers([]);
        }
      } catch (error) {
        console.error('Error fetching users:', error);
        setUsers([]);
      }
    };

    fetchAssets();
    fetchUsers();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (name: string, date: Date | null) => {
    setFormData(prev => ({ ...prev, [name]: date }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Create a sanitized version of the form data to ensure dates are properly formatted
      const sanitizedData = {
        ...formData,
        startDate: formData.startDate instanceof Date ? formData.startDate : new Date(),
        endDate: formData.endDate instanceof Date ? formData.endDate : null
      };
      
      await onSubmit(sanitizedData);
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="title" className="text-sm font-medium">
          {t('task_title')} *
        </label>
        <Input
          id="title"
          name="title"
          value={formData.title}
          onChange={handleChange}
          required
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="description" className="text-sm font-medium">
          {t('task_description')}
        </label>
        <Textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          rows={3}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">
            {t('start_date')} *
          </label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !formData.startDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formData.startDate ? (
                  format(formData.startDate, "PPP")
                ) : (
                  <span>{t('select_date')}</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={formData.startDate || undefined}
                onSelect={(date) => handleDateChange('startDate', date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">
            {t('end_date')}
          </label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !formData.endDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formData.endDate ? (
                  format(formData.endDate, "PPP")
                ) : (
                  <span>{t('select_date')}</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={formData.endDate || undefined}
                onSelect={(date) => handleDateChange('endDate', date)}
                initialFocus
                disabled={(date) => date < (formData.startDate || new Date())}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">
            {t('task_priority')}
          </label>
          <Select
            value={formData.priority}
            onValueChange={(value) => handleSelectChange('priority', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('task_priority')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LOW">{t('priority_low')}</SelectItem>
              <SelectItem value="MEDIUM">{t('priority_medium')}</SelectItem>
              <SelectItem value="HIGH">{t('priority_high')}</SelectItem>
              <SelectItem value="URGENT">{t('priority_urgent')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">
            {t('task_status')}
          </label>
          <Select
            value={formData.status}
            onValueChange={(value) => handleSelectChange('status', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('task_status')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PLANNED">{t('status_planned')}</SelectItem>
              <SelectItem value="IN_PROGRESS">{t('status_in_progress')}</SelectItem>
              <SelectItem value="COMPLETED">{t('status_completed')}</SelectItem>
              <SelectItem value="CANCELLED">{t('status_cancelled')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">
          {t('related_asset')}
        </label>
        <Select
          value={formData.assetId}
          onValueChange={(value) => handleSelectChange('assetId', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('select_item')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t('none')}</SelectItem>
            {assets.map((asset) => (
              <SelectItem key={asset.id} value={asset.id}>
                {asset.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">
          {t('assigned_to')}
        </label>
        <Select
          value={formData.assignedToUserId}
          onValueChange={(value) => handleSelectChange('assignedToUserId', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('select_user')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t('none')}</SelectItem>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="estimatedHours" className="text-sm font-medium">
            {t('estimated_hours')}
          </label>
          <Input
            id="estimatedHours"
            name="estimatedHours"
            type="number"
            min="0"
            step="0.5"
            value={formData.estimatedHours}
            onChange={handleChange}
          />
        </div>

        {(isEditing || formData.status === 'COMPLETED') && (
          <div className="space-y-2">
            <label htmlFor="actualHours" className="text-sm font-medium">
              {t('actual_hours')}
            </label>
            <Input
              id="actualHours"
              name="actualHours"
              type="number"
              min="0"
              step="0.5"
              value={formData.actualHours}
              onChange={handleChange}
            />
          </div>
        )}
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('cancel')}
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? '...' : isEditing ? t('edit_task') : t('add_task')}
        </Button>
      </div>
    </form>
  );
}