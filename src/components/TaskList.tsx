import { useState } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, isAfter, isBefore, addDays } from 'date-fns';
import { Edit, Trash2, CheckCircle, Clock, Calendar, AlertTriangle, User, ArrowRight } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

type Task = {
  id: string;
  title: string;
  description?: string | null;
  startDate: Date;
  endDate?: Date | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  assetId?: string | null;
  asset?: {
    id: string;
    name: string;
  } | null;
  aiSuggested: boolean;
  aiNotes?: string | null;
  assignedToUserId?: string | null;
  assignedToUser?: {
    id: string;
    email: string;
  } | null;
  estimatedHours?: number | null;
  actualHours?: number | null;
  completedAt?: Date | null;
};

interface TaskListProps {
  tasks: Task[];
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onStatusChange: (taskId: string, status: string) => void;
}

export function TaskList({ tasks, onEdit, onDelete, onStatusChange }: TaskListProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('all');

  // Helper function to safely parse dates
  const safeParseDate = (dateValue: any): Date | null => {
    if (!dateValue) return null;
    
    try {
      // Handle if dateValue is already a Date object
      if (dateValue instanceof Date) {
        return isNaN(dateValue.getTime()) ? null : dateValue;
      }
      
      // Handle string dates
      const date = new Date(dateValue);
      return isNaN(date.getTime()) ? null : date;
    } catch (error) {
      console.error("Invalid date value:", dateValue);
      return null;
    }
  };

  // Filter tasks based on active tab
  const filteredTasks = tasks.filter(task => {
    // Safely parse the task dates
    const taskStartDate = safeParseDate(task.startDate);
    if (!taskStartDate) return activeTab === 'all'; // If date is invalid, only show in "all" tab
    
    if (activeTab === 'all') return true;
    if (activeTab === 'today') {
      const today = new Date();
      return isSameDay(taskStartDate, today);
    }
    if (activeTab === 'upcoming') {
      const today = new Date();
      const nextWeek = addDays(today, 7);
      return isAfter(taskStartDate, today) && isBefore(taskStartDate, nextWeek);
    }
    if (activeTab === 'overdue') {
      const today = new Date();
      return isBefore(taskStartDate, today) && task.status !== 'COMPLETED' && task.status !== 'CANCELLED';
    }
    if (activeTab === 'completed') {
      return task.status === 'COMPLETED';
    }
    return true;
  });

  // Function to check if two dates are the same day
  function isSameDay(date1: Date, date2: Date) {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  }

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
        return <Calendar className="h-4 w-4 mr-1" />;
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

  // Function to calculate days remaining or overdue
  const getDaysInfo = (task: Task) => {
    const today = new Date();
    const startDate = new Date(task.startDate);
    const endDate = task.endDate ? new Date(task.endDate) : startDate;
    
    if (task.status === 'COMPLETED' || task.status === 'CANCELLED') {
      return null;
    }
    
    if (isBefore(endDate, today)) {
      const daysOverdue = Math.floor((today.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));
      return {
        type: 'overdue',
        days: daysOverdue,
      };
    } else {
      const daysRemaining = Math.floor((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return {
        type: 'remaining',
        days: daysRemaining,
      };
    }
  };

  // Function to get user initials for avatar
  const getUserInitials = (email: string) => {
    if (!email) return '??';
    
    const parts = email.split('@')[0].split(/[._-]/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    
    return email.substring(0, 2).toUpperCase();
  };

  // Function to get avatar background color based on user email
  const getAvatarColor = (email: string) => {
    if (!email) return 'bg-gray-200';
    
    const colors = [
      'bg-red-200 text-red-800',
      'bg-blue-200 text-blue-800',
      'bg-green-200 text-green-800',
      'bg-yellow-200 text-yellow-800',
      'bg-purple-200 text-purple-800',
      'bg-indigo-200 text-indigo-800',
      'bg-pink-200 text-pink-800',
    ];
    
    // Simple hash function to determine color
    const hash = email.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  return (
    <Card className="border-indigo-100 dark:border-gray-700 shadow-sm">
      <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-gray-800 dark:to-gray-900 border-b border-indigo-100 dark:border-gray-700">
        <CardTitle className="flex items-center">
          <ListTasks className="h-5 w-5 mr-2 text-indigo-600 dark:text-indigo-400" />
          {t('task_list')}
        </CardTitle>
        <CardDescription>{t('list_view')}</CardDescription>
      </CardHeader>
      <CardContent className="p-4">
        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList className="grid grid-cols-5 mb-4 bg-indigo-50 dark:bg-gray-800 p-1">
            <TabsTrigger 
              value="all"
              className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-indigo-700 dark:data-[state=active]:text-indigo-300 data-[state=active]:shadow-sm"
            >
              {t('all')}
            </TabsTrigger>
            <TabsTrigger 
              value="today"
              className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-indigo-700 dark:data-[state=active]:text-indigo-300 data-[state=active]:shadow-sm"
            >
              {t('today')}
            </TabsTrigger>
            <TabsTrigger 
              value="upcoming"
              className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-indigo-700 dark:data-[state=active]:text-indigo-300 data-[state=active]:shadow-sm"
            >
              {t('next_week')}
            </TabsTrigger>
            <TabsTrigger 
              value="overdue"
              className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-indigo-700 dark:data-[state=active]:text-indigo-300 data-[state=active]:shadow-sm"
            >
              {t('task_overdue')}
            </TabsTrigger>
            <TabsTrigger 
              value="completed"
              className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-indigo-700 dark:data-[state=active]:text-indigo-300 data-[state=active]:shadow-sm"
            >
              {t('status_completed')}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value={activeTab} className="mt-0">
            {filteredTasks.length > 0 ? (
              <div className="space-y-4">
                {filteredTasks.map((task) => {
                  const daysInfo = getDaysInfo(task);
                  
                  return (
                    <div 
                      key={task.id} 
                      className={`p-4 rounded-lg border ${
                        task.aiSuggested 
                          ? 'border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-900/30' 
                          : 'border-gray-200 dark:border-gray-700 dark:bg-gray-800/50'
                      } hover:shadow-md transition-shadow duration-200`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
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
                          {task.aiNotes && task.aiSuggested && (
                            <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1 italic">{task.aiNotes}</p>
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
                              <Calendar className="h-3 w-3 mr-1 text-indigo-500" />
                              {t('start_date')}: {format(new Date(task.startDate), 'PPP')}
                            </p>
                            {task.endDate && (
                              <p className="flex items-center">
                                <ArrowRight className="h-3 w-3 mr-1 text-indigo-500" />
                                {t('end_date')}: {format(new Date(task.endDate), 'PPP')}
                              </p>
                            )}
                            {task.asset && (
                              <p className="text-indigo-600 flex items-center">
                                <AssetIcon className="h-3 w-3 mr-1" />
                                {task.asset.name}
                              </p>
                            )}
                            <p className="flex items-center">
                                <Clock className="h-3 w-3 mr-1 text-indigo-500" />
                                {task.estimatedHours && `${t('estimated')}: ${task.estimatedHours}h`}
                                {task.estimatedHours && task.actualHours && ' | '}
                                {task.actualHours && `${t('actual')}: ${task.actualHours}h`}
                                {!task.actualHours && task.status !== 'COMPLETED' && (
                                  <span className="text-xs italic ml-1 text-gray-500">
                                    ({t('auto_calculated_on_completion')})
                                  </span>
                                )}
                              </p>
                          </div>
                          
                          <div className="flex items-center gap-2 mt-2 md:mt-0">
                            {task.assignedToUser && (
                              <div className="flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded-full">
                                <Avatar className="h-5 w-5">
                                  <AvatarFallback className={getAvatarColor(task.assignedToUser.email)}>
                                    {getUserInitials(task.assignedToUser.email)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-xs text-indigo-700">
                                  {task.assignedToUser.email.split('@')[0]}
                                </span>
                              </div>
                            )}
                            
                            {daysInfo && (
                              <Badge 
                                variant="outline" 
                                className={daysInfo.type === 'overdue' 
                                  ? 'bg-red-50 text-red-700 border-red-200' 
                                  : 'bg-blue-50 text-blue-700 border-blue-200'
                                }
                              >
                                <span className="flex items-center">
                                  {daysInfo.type === 'overdue' 
                                    ? <AlertTriangle className="h-3 w-3 mr-1" /> 
                                    : <Clock className="h-3 w-3 mr-1" />
                                  }
                                  {daysInfo.days} {t(daysInfo.type === 'overdue' ? 'days_overdue' : 'days_remaining')}
                                </span>
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-4 flex justify-end space-x-2">
                        {task.status !== 'COMPLETED' && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                            onClick={() => onStatusChange(task.id, 'COMPLETED')}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            {t('status_completed')}
                          </Button>
                        )}
                        {task.status === 'PLANNED' && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                            onClick={() => onStatusChange(task.id, 'IN_PROGRESS')}
                          >
                            <Clock className="h-4 w-4 mr-1" />
                            {t('status_in_progress')}
                          </Button>
                        )}
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="hover:bg-indigo-50"
                          onClick={() => onEdit(task)}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          {t('edit_task')}
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                          onClick={() => onDelete(task.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          {t('delete_task')}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
                <ListTasks className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400 font-medium">{t('no_tasks_found')}</p>
                <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
                  {activeTab === 'all' 
                    ? t('create_first_task') 
                    : t('no_tasks_in_category')}
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
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

// Custom component for the asset icon
function AssetIcon(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}