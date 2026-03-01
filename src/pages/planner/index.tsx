import { useState, useEffect } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { TaskCalendar } from '@/components/TaskCalendar';
import { TaskList } from '@/components/TaskList';
import { TaskForm } from '@/components/TaskForm';
import { AiSuggestions } from '@/components/AiSuggestions';
import { TaskKpiDashboard } from '@/components/TaskKpiDashboard';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { Calendar, ListTodo, Plus, Lightbulb, BarChart, Clock, CheckCircle, AlertTriangle, Filter } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, addDays, isBefore, isAfter } from 'date-fns';

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
};

function PlannerPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [activeTab, setActiveTab] = useState('calendar');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [timeframeFilter, setTimeframeFilter] = useState<string>('all');

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/planner');
      if (response.ok) {
        const data = await response.json();
        // Convert date strings to Date objects
        const formattedTasks = data.map((task: any) => ({
          ...task,
          startDate: new Date(task.startDate),
          endDate: task.endDate ? new Date(task.endDate) : null,
        }));
        setTasks(formattedTasks);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to fetch tasks',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch tasks',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddTask = async (taskData: any) => {
    try {
      // Process the data before sending to API
      const processedData = { ...taskData };
      
      // Handle the "none" value for assetId and assignedToUserId
      if (processedData.assetId === "none") {
        processedData.assetId = null;
      }
      
      if (processedData.assignedToUserId === "none") {
        processedData.assignedToUserId = null;
      }
      
      const response = await fetch('/api/planner', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(processedData),
      });

      if (response.ok) {
        const newTask = await response.json();
        setTasks([...tasks, {
          ...newTask,
          startDate: new Date(newTask.startDate),
          endDate: newTask.endDate ? new Date(newTask.endDate) : null,
        }]);
        setIsAddDialogOpen(false);
        toast({
          title: t('task_created'),
          description: taskData.title,
        });
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Server error:', errorData);
        toast({
          title: 'Error',
          description: errorData.error || 'Failed to create task',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error adding task:', error);
      toast({
        title: 'Error',
        description: 'Failed to create task',
        variant: 'destructive',
      });
    }
  };

  const handleEditTask = async (taskData: any) => {
    if (!currentTask) return;

    try {
      // Process the data before sending to API
      const processedData = { ...taskData };
      
      // Handle the "none" value for assetId and assignedToUserId
      if (processedData.assetId === "none") {
        processedData.assetId = null;
      }
      
      if (processedData.assignedToUserId === "none") {
        processedData.assignedToUserId = null;
      }
      
      const response = await fetch(`/api/planner/${currentTask.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(processedData),
      });

      if (response.ok) {
        const updatedTask = await response.json();
        setTasks(tasks.map(task => 
          task.id === currentTask.id 
            ? {
                ...updatedTask,
                startDate: new Date(updatedTask.startDate),
                endDate: updatedTask.endDate ? new Date(updatedTask.endDate) : null,
              } 
            : task
        ));
        setIsEditDialogOpen(false);
        setCurrentTask(null);
        toast({
          title: t('task_updated'),
          description: taskData.title,
        });
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Server error:', errorData);
        toast({
          title: 'Error',
          description: errorData.error || 'Failed to update task',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        title: 'Error',
        description: 'Failed to update task',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteTask = async () => {
    if (!currentTask) return;

    try {
      const response = await fetch(`/api/planner/${currentTask.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setTasks(tasks.filter(task => task.id !== currentTask.id));
        setIsDeleteDialogOpen(false);
        setCurrentTask(null);
        toast({
          title: t('task_deleted'),
          description: currentTask.title,
        });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to delete task',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete task',
        variant: 'destructive',
      });
    }
  };

  const handleStatusChange = async (taskId: string, status: string) => {
    try {
      const taskToUpdate = tasks.find(task => task.id === taskId);
      if (!taskToUpdate) return;

      const response = await fetch(`/api/planner/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...taskToUpdate, status }),
      });

      if (response.ok) {
        const updatedTask = await response.json();
        setTasks(tasks.map(task => 
          task.id === taskId 
            ? {
                ...updatedTask,
                startDate: new Date(updatedTask.startDate),
                endDate: updatedTask.endDate ? new Date(updatedTask.endDate) : null,
              } 
            : task
        ));
        toast({
          title: t('task_updated'),
          description: `${taskToUpdate.title} - ${t(`status_${status.toLowerCase()}`)}`,
        });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to update task status',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error updating task status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update task status',
        variant: 'destructive',
      });
    }
  };

  const handleAddAiSuggestion = async (suggestion: any) => {
    await handleAddTask(suggestion);
  };

  // Filter tasks based on selected filters
  const getFilteredTasks = () => {
    return tasks.filter(task => {
      // Priority filter
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) {
        return false;
      }
      
      // Status filter
      if (statusFilter !== 'all' && task.status !== statusFilter) {
        return false;
      }
      
      // Timeframe filter
      const today = new Date();
      if (timeframeFilter === 'today') {
        return isSameDay(task.startDate, today);
      } else if (timeframeFilter === 'week') {
        const nextWeek = addDays(today, 7);
        return isAfter(task.startDate, today) && isBefore(task.startDate, nextWeek);
      } else if (timeframeFilter === 'overdue') {
        return isBefore(task.startDate, today) && task.status !== 'COMPLETED' && task.status !== 'CANCELLED';
      }
      
      return true;
    });
  };

  // Function to check if two dates are the same day
  function isSameDay(date1: Date, date2: Date) {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  }

  // Calculate task statistics
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(task => task.status === 'COMPLETED').length;
  const inProgressTasks = tasks.filter(task => task.status === 'IN_PROGRESS').length;
  const overdueTasks = tasks.filter(task => {
    const today = new Date();
    return isBefore(task.startDate, today) && task.status !== 'COMPLETED' && task.status !== 'CANCELLED';
  }).length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Get filtered tasks
  const filteredTasks = getFilteredTasks();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header with title and add button */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-gray-800 dark:to-gray-900 p-6 rounded-lg shadow-sm border border-indigo-100 dark:border-gray-700">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-indigo-900 dark:text-indigo-300">{t('task_planner')}</h1>
            <p className="text-indigo-700 dark:text-indigo-400">
              {t('plan_and_manage_your_tasks')}
            </p>
          </div>
          <Button 
            onClick={() => setIsAddDialogOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('add_task')}
          </Button>
        </div>

        {/* Dashboard summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-white dark:bg-gray-800 border-indigo-100 dark:border-gray-700 shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('total_tasks')}</p>
                <p className="text-2xl font-bold dark:text-white">{totalTasks}</p>
              </div>
              <div className="p-3 bg-indigo-100 dark:bg-indigo-900/50 rounded-full">
                <ListTodo className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white dark:bg-gray-800 border-green-100 dark:border-green-900/30 shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('completed_tasks')}</p>
                <p className="text-2xl font-bold dark:text-white">{completedTasks}</p>
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-900/50 rounded-full">
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white dark:bg-gray-800 border-blue-100 dark:border-blue-900/30 shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('in_progress')}</p>
                <p className="text-2xl font-bold dark:text-white">{inProgressTasks}</p>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-full">
                <Clock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white dark:bg-gray-800 border-red-100 dark:border-red-900/30 shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('task_overdue')}</p>
                <p className="text-2xl font-bold dark:text-white">{overdueTasks}</p>
              </div>
              <div className="p-3 bg-red-100 dark:bg-red-900/50 rounded-full">
                <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter controls */}
        <Card className="border-gray-100 dark:border-gray-700 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('filters')}:</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('priority')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('all_priorities')}</SelectItem>
                    <SelectItem value="LOW">{t('priority_low')}</SelectItem>
                    <SelectItem value="MEDIUM">{t('priority_medium')}</SelectItem>
                    <SelectItem value="HIGH">{t('priority_high')}</SelectItem>
                    <SelectItem value="URGENT">{t('priority_urgent')}</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('status')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('all_statuses')}</SelectItem>
                    <SelectItem value="PLANNED">{t('status_planned')}</SelectItem>
                    <SelectItem value="IN_PROGRESS">{t('status_in_progress')}</SelectItem>
                    <SelectItem value="COMPLETED">{t('status_completed')}</SelectItem>
                    <SelectItem value="CANCELLED">{t('status_cancelled')}</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={timeframeFilter} onValueChange={setTimeframeFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('timeframe')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('all_timeframes')}</SelectItem>
                    <SelectItem value="today">{t('today')}</SelectItem>
                    <SelectItem value="week">{t('next_week')}</SelectItem>
                    <SelectItem value="overdue">{t('task_overdue')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
                  {filteredTasks.length} {t('tasks_found')}
                </Badge>
                {(priorityFilter !== 'all' || statusFilter !== 'all' || timeframeFilter !== 'all') && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      setPriorityFilter('all');
                      setStatusFilter('all');
                      setTimeframeFilter('all');
                    }}
                    className="text-xs"
                  >
                    {t('clear_filters')}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main tabs */}
        <Tabs 
          defaultValue="calendar" 
          value={activeTab} 
          onValueChange={setActiveTab}
          className="space-y-4"
        >
          <TabsList className="grid w-full grid-cols-4 bg-indigo-50 dark:bg-gray-800 p-1">
            <TabsTrigger 
              value="calendar" 
              className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-indigo-700 dark:data-[state=active]:text-indigo-300 data-[state=active]:shadow-sm"
            >
              <Calendar className="h-4 w-4 mr-2" />
              {t('calendar_view')}
            </TabsTrigger>
            <TabsTrigger 
              value="list" 
              className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-indigo-700 dark:data-[state=active]:text-indigo-300 data-[state=active]:shadow-sm"
            >
              <ListTodo className="h-4 w-4 mr-2" />
              {t('list_view')}
            </TabsTrigger>
            <TabsTrigger 
              value="kpi" 
              className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-indigo-700 dark:data-[state=active]:text-indigo-300 data-[state=active]:shadow-sm"
            >
              <BarChart className="h-4 w-4 mr-2" />
              {t('kpi_dashboard')}
            </TabsTrigger>
            <TabsTrigger 
              value="ai" 
              className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-indigo-700 dark:data-[state=active]:text-indigo-300 data-[state=active]:shadow-sm"
            >
              <Lightbulb className="h-4 w-4 mr-2" />
              {t('ai_suggestions')}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="calendar" className="mt-0">
            <TaskCalendar 
              tasks={filteredTasks} 
              onDateSelect={setSelectedDate} 
              selectedDate={selectedDate} 
            />
          </TabsContent>
          
          <TabsContent value="list" className="mt-0">
            <TaskList 
              tasks={filteredTasks} 
              onEdit={(task) => {
                setCurrentTask(task);
                setIsEditDialogOpen(true);
              }}
              onDelete={(taskId) => {
                const task = tasks.find(t => t.id === taskId);
                if (task) {
                  setCurrentTask(task);
                  setIsDeleteDialogOpen(true);
                }
              }}
              onStatusChange={handleStatusChange}
            />
          </TabsContent>
          
          <TabsContent value="kpi" className="mt-0">
            <TaskKpiDashboard />
          </TabsContent>
          
          <TabsContent value="ai" className="mt-0">
            <div className="grid grid-cols-1 gap-6">
              <AiSuggestions onAddSuggestion={handleAddAiSuggestion} />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Task Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{t('add_task')}</DialogTitle>
            <DialogDescription>
              {t('create_new_task')}
            </DialogDescription>
          </DialogHeader>
          <TaskForm 
            onSubmit={handleAddTask} 
            onCancel={() => setIsAddDialogOpen(false)} 
          />
        </DialogContent>
      </Dialog>

      {/* Edit Task Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{t('edit_task')}</DialogTitle>
            <DialogDescription>
              {t('update_task_details')}
            </DialogDescription>
          </DialogHeader>
          {currentTask && (
            <TaskForm 
              onSubmit={handleEditTask} 
              onCancel={() => {
                setIsEditDialogOpen(false);
                setCurrentTask(null);
              }} 
              initialData={currentTask}
              isEditing
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete_task')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('delete_task_confirmation')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setIsDeleteDialogOpen(false);
              setCurrentTask(null);
            }}>
              {t('cancel')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTask} className="bg-red-600 hover:bg-red-700">
              {t('delete_task')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

export default function ProtectedPlannerPage() {
  return (
    <ProtectedRoute>
      <PlannerPage />
    </ProtectedRoute>
  );
}