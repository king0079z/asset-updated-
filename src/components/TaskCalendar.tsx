import { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/contexts/TranslationContext';
import { format, isSameDay, isWithinInterval, startOfDay, endOfDay, addDays, parseISO, isToday, isBefore } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Clock, Calendar as CalendarIcon, CheckCircle, AlertTriangle, ArrowRight, User } from 'lucide-react';

type Task = {
  id: string;
  title: string;
  description?: string | null;
  startDate: Date;
  endDate?: Date | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  assetId?: string | null;
  aiSuggested: boolean;
  assignedToUserId?: string | null;
  assignedToUser?: {
    id: string;
    email: string;
  } | null;
  estimatedHours?: number | null;
  actualHours?: number | null;
};

interface TaskCalendarProps {
  tasks: Task[];
  onDateSelect: (date: Date) => void;
  selectedDate: Date;
}

export function TaskCalendar({ tasks, onDateSelect, selectedDate }: TaskCalendarProps) {
  const { t, locale } = useTranslation();

  // Helper function to safely parse dates
  const safeParseDate = (dateValue: any): Date | null => {
    if (!dateValue) return null;
    
    try {
      // Handle if dateValue is already a Date object
      if (dateValue instanceof Date) {
        return isNaN(dateValue.getTime()) ? null : dateValue;
      }
      
      // Handle ISO string dates
      if (typeof dateValue === 'string') {
        try {
          // Try to parse as ISO string first
          return parseISO(dateValue);
        } catch (parseError) {
          // Fallback to regular Date constructor
          const date = new Date(dateValue);
          return isNaN(date.getTime()) ? null : date;
        }
      }
      
      // Handle other cases
      const date = new Date(dateValue);
      return isNaN(date.getTime()) ? null : date;
    } catch (error) {
      console.error("Invalid date value:", dateValue);
      return null;
    }
  };

  // Function to determine if a task falls on a specific date
  const hasTaskOnDate = (date: Date) => {
    return tasks.some(task => {
      try {
        const taskStartDate = safeParseDate(task.startDate);
        if (!taskStartDate) return false;
        
        const taskEndDate = task.endDate ? safeParseDate(task.endDate) : null;
        
        if (taskEndDate) {
          return isWithinInterval(date, {
            start: startOfDay(taskStartDate),
            end: endOfDay(taskEndDate)
          });
        }
        
        return isSameDay(date, taskStartDate);
      } catch (error) {
        console.error("Error checking if task falls on date:", error);
        return false;
      }
    });
  };

  // Function to get tasks for the selected date
  const getTasksForDate = (date: Date) => {
    return tasks.filter(task => {
      try {
        const taskStartDate = safeParseDate(task.startDate);
        if (!taskStartDate) return false;
        
        const taskEndDate = task.endDate ? safeParseDate(task.endDate) : null;
        
        if (taskEndDate) {
          return isWithinInterval(date, {
            start: startOfDay(taskStartDate),
            end: endOfDay(taskEndDate)
          });
        }
        
        return isSameDay(date, taskStartDate);
      } catch (error) {
        console.error("Error filtering tasks for date:", error);
        return false;
      }
    });
  };

  // Function to get priority count for a specific date
  const getPriorityCountForDate = (date: Date, priority: string) => {
    try {
      return getTasksForDate(date).filter(task => task.priority === priority).length;
    } catch (error) {
      console.error("Error getting priority count for date:", error);
      return 0;
    }
  };

  // Get tasks for the selected date
  const tasksForSelectedDate = getTasksForDate(selectedDate);

  // Function to get priority badge color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'LOW':
        return 'bg-blue-100 text-blue-800 hover:bg-blue-100';
      case 'MEDIUM':
        return 'bg-green-100 text-green-800 hover:bg-green-100';
      case 'HIGH':
        return 'bg-orange-100 text-orange-800 hover:bg-orange-100';
      case 'URGENT':
        return 'bg-red-100 text-red-800 hover:bg-red-100';
      default:
        return 'bg-gray-100 text-gray-800 hover:bg-gray-100';
    }
  };

  // Function to get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PLANNED':
        return 'bg-purple-100 text-purple-800 hover:bg-purple-100';
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800 hover:bg-blue-100';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800 hover:bg-green-100';
      case 'CANCELLED':
        return 'bg-gray-100 text-gray-800 hover:bg-gray-100';
      default:
        return 'bg-gray-100 text-gray-800 hover:bg-gray-100';
    }
  };

  // Function to get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PLANNED':
        return <CalendarIcon className="h-4 w-4 mr-1" />;
      case 'IN_PROGRESS':
        return <Clock className="h-4 w-4 mr-1" />;
      case 'COMPLETED':
        return <CheckCircle className="h-4 w-4 mr-1" />;
      case 'CANCELLED':
        return <AlertTriangle className="h-4 w-4 mr-1" />;
      default:
        return null;
    }
  };

  // Function to determine if a date has high priority tasks
  const hasHighPriorityTask = (date: Date) => {
    try {
      return getTasksForDate(date).some(task => 
        task.priority === 'HIGH' || task.priority === 'URGENT'
      );
    } catch (error) {
      console.error("Error checking for high priority tasks:", error);
      return false;
    }
  };

  // Function to determine if a date has overdue tasks
  const hasOverdueTask = (date: Date) => {
    try {
      const today = new Date();
      return isBefore(date, today) && getTasksForDate(date).some(task => 
        task.status !== 'COMPLETED' && task.status !== 'CANCELLED'
      );
    } catch (error) {
      console.error("Error checking for overdue tasks:", error);
      return false;
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card className="md:col-span-1 border-indigo-100 dark:border-gray-700 shadow-sm">
        <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-gray-800 dark:to-gray-900 border-b border-indigo-100 dark:border-gray-700">
          <CardTitle className="flex items-center">
            <CalendarIcon className="h-5 w-5 mr-2 text-indigo-600 dark:text-indigo-400" />
            {t('calendar_view')}
          </CardTitle>
          <CardDescription>{t('select_date')}</CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => date && onDateSelect(date)}
            locale={locale === 'ar' ? ar : undefined}
            modifiers={{
              hasTask: (date) => hasTaskOnDate(date),
              today: (date) => isToday(date),
              highPriority: (date) => hasHighPriorityTask(date),
              overdue: (date) => hasOverdueTask(date),
            }}
            modifiersStyles={{
              hasTask: { 
                fontWeight: 'bold',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                color: '#4f46e5',
              },
              today: {
                fontWeight: 'bold',
                backgroundColor: 'rgba(79, 70, 229, 0.2)',
                color: '#4f46e5',
                borderColor: '#4f46e5',
              },
              highPriority: {
                border: '2px solid #ef4444',
              },
              overdue: {
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
              }
            }}
            className="rounded-md border-indigo-100"
          />
          
          <div className="mt-4 space-y-2">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('legend')}:</div>
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-indigo-200 dark:bg-indigo-800 mr-1"></div>
                <span className="text-xs text-gray-600 dark:text-gray-400">{t('has_tasks')}</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full border-2 border-red-500 mr-1"></div>
                <span className="text-xs text-gray-600 dark:text-gray-400">{t('high_priority')}</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-red-100 dark:bg-red-900/50 mr-1"></div>
                <span className="text-xs text-gray-600 dark:text-gray-400">{t('task_overdue')}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="md:col-span-2 border-indigo-100 dark:border-gray-700 shadow-sm">
        <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-gray-800 dark:to-gray-900 border-b border-indigo-100 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center">
              <ListTasks className="h-5 w-5 mr-2 text-indigo-600 dark:text-indigo-400" />
              {t('tasks_for_date')}
            </CardTitle>
            <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900/70">
              {format(selectedDate, 'PPP', { locale: locale === 'ar' ? ar : undefined })}
            </Badge>
          </div>
          <CardDescription>
            {tasksForSelectedDate.length > 0 
              ? t('task_due_soon') 
              : t('no_tasks_found')}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          {tasksForSelectedDate.length > 0 ? (
            <div className="space-y-4">
              {tasksForSelectedDate.map((task) => (
                <div 
                  key={task.id} 
                  className={`p-4 rounded-lg border ${
                    task.aiSuggested 
                      ? 'border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-900/30' 
                      : 'border-gray-200 dark:border-gray-700 dark:bg-gray-800/50'
                  } hover:shadow-md transition-shadow duration-200`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-gray-100 flex items-center">
                        {task.title}
                        {task.aiSuggested && (
                          <Badge variant="outline" className="ml-2 bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/70">
                            {t('ai_suggested')}
                          </Badge>
                        )}
                      </h3>
                      {task.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{task.description}</p>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      <Badge className={getPriorityColor(task.priority)}>
                        {t(`priority_${task.priority.toLowerCase()}`)}
                      </Badge>
                      <Badge className={getStatusColor(task.status)}>
                        <span className="flex items-center">
                          {getStatusIcon(task.status)}
                          {t(`status_${task.status.toLowerCase()}`)}
                        </span>
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="mt-3 text-sm text-gray-500">
                    <div className="flex flex-wrap items-center justify-between">
                      <div className="space-y-1">
                        <p className="flex items-center">
                          <CalendarIcon className="h-3 w-3 mr-1 text-indigo-500" />
                          {t('start_date')}: {format(new Date(task.startDate), 'PPP')}
                        </p>
                        {task.endDate && (
                          <p className="flex items-center">
                            <ArrowRight className="h-3 w-3 mr-1 text-indigo-500" />
                            {t('end_date')}: {format(new Date(task.endDate), 'PPP')}
                          </p>
                        )}
                        {task.assignedToUser && (
                          <p className="text-purple-600 flex items-center">
                            <User className="h-3 w-3 mr-1" />
                            {task.assignedToUser.email.split('@')[0]}
                          </p>
                        )}
                        {(task.estimatedHours || task.actualHours) && (
                          <p className="flex items-center">
                            <Clock className="h-3 w-3 mr-1 text-indigo-500" />
                            {task.estimatedHours && `${t('estimated')}: ${task.estimatedHours}h`}
                            {task.estimatedHours && task.actualHours && ' | '}
                            {task.actualHours && `${t('actual')}: ${task.actualHours}h`}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
              <CalendarIcon className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400 font-medium">{t('no_tasks_found')}</p>
              <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">{t('select_another_date')}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Custom component for the list icon
function ListTasks(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

// User component is imported from lucide-react