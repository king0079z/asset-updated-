import { useState, useEffect } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { format, differenceInDays, differenceInHours, isAfter, isBefore } from 'date-fns';
import { Clock, AlertTriangle, CheckCircle, User, Calendar, TrendingUp } from 'lucide-react';

interface KpiData {
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  inProgressTasks: number;
  completionRate: number;
  averageCompletionTime: number;
  estimationAccuracy: number;
  tasksByPriority: {
    LOW: number;
    MEDIUM: number;
    HIGH: number;
    URGENT: number;
  };
  tasksByUser: {
    userId: string;
    userEmail: string;
    totalTasks: number;
    completedTasks: number;
    overdueTasks: number;
    averageCompletionTime: number;
  }[];
  recentCompletions: {
    id: string;
    title: string;
    completedAt: string;
    estimatedHours: number | null;
    actualHours: number | null;
    efficiency: number | null;
  }[];
  aiInsights: string[];
}

export function TaskKpiDashboard() {
  const { t } = useTranslation();
  const [kpiData, setKpiData] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchKpiData();
  }, []);
  
  // Add a retry mechanism if the first attempt fails
  useEffect(() => {
    if (error) {
      const retryTimer = setTimeout(() => {
        console.log('Retrying KPI data fetch after error');
        fetchKpiData();
      }, 3000);
      
      return () => clearTimeout(retryTimer);
    }
  }, [error]);

  const fetchKpiData = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('Fetching KPI data...');
      const response = await fetch('/api/planner/kpi');
      
      // Log the response status for debugging
      console.log('KPI API response status:', response.status);
      
      if (!response.ok) {
        let errorMessage = `Error fetching KPI data: ${response.status}`;
        try {
          const errorData = await response.json();
          console.error('KPI API error response:', errorData);
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          const errorText = await response.text();
          console.error('KPI API error response (text):', errorText);
          if (errorText) errorMessage += ` - ${errorText}`;
        }
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      console.log('KPI data successfully retrieved');
      setKpiData(data);
    } catch (err) {
      console.error('Error fetching KPI data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to format efficiency
  const formatEfficiency = (value: number | null) => {
    if (value === null) return 'N/A';
    if (value <= 0) return '0%';
    return `${Math.round(value * 100)}%`;
  };

  // Colors for charts
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];
  const PRIORITY_COLORS = {
    LOW: '#3b82f6',
    MEDIUM: '#10b981',
    HIGH: '#f59e0b',
    URGENT: '#ef4444',
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('task_kpi_dashboard')}</CardTitle>
          <CardDescription>{t('loading_kpi_data')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-[200px] w-full" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Skeleton className="h-[100px]" />
              <Skeleton className="h-[100px]" />
              <Skeleton className="h-[100px]" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('task_kpi_dashboard')}</CardTitle>
          <CardDescription>{t('error_loading_kpi')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{t('error')}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!kpiData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('task_kpi_dashboard')}</CardTitle>
          <CardDescription>{t('no_kpi_data_available')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground">{t('no_tasks_found')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Prepare data for charts
  const priorityChartData = [
    { name: t('priority_low'), value: kpiData.tasksByPriority.LOW, color: PRIORITY_COLORS.LOW },
    { name: t('priority_medium'), value: kpiData.tasksByPriority.MEDIUM, color: PRIORITY_COLORS.MEDIUM },
    { name: t('priority_high'), value: kpiData.tasksByPriority.HIGH, color: PRIORITY_COLORS.HIGH },
    { name: t('priority_urgent'), value: kpiData.tasksByPriority.URGENT, color: PRIORITY_COLORS.URGENT },
  ];

  const userCompletionData = kpiData.tasksByUser.map(user => ({
    name: user.userEmail.split('@')[0],
    completed: user.completedTasks,
    total: user.totalTasks,
    overdue: user.overdueTasks,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('task_kpi_dashboard')}</CardTitle>
        <CardDescription>{t('monitor_task_performance')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList className="grid grid-cols-3 mb-4">
            <TabsTrigger value="overview">{t('overview')}</TabsTrigger>
            <TabsTrigger value="users">{t('user_performance')}</TabsTrigger>
            <TabsTrigger value="insights">{t('ai_insights')}</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-card p-4 rounded-lg border shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{t('completion_rate')}</p>
                    <h3 className="text-2xl font-bold">{Math.round(kpiData.completionRate * 100)}%</h3>
                  </div>
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-full">
                    <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                </div>
                <Progress value={kpiData.completionRate * 100} className="mt-2" />
              </div>
              
              <div className="bg-card p-4 rounded-lg border shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{t('avg_completion_time')}</p>
                    <h3 className="text-2xl font-bold">{kpiData.averageCompletionTime.toFixed(1)} {t('hours')}</h3>
                  </div>
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                    <Clock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-2">{t('across_all_completed_tasks')}</p>
              </div>
              
              <div className="bg-card p-4 rounded-lg border shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{t('estimation_accuracy')}</p>
                    <h3 className="text-2xl font-bold">{Math.round(kpiData.estimationAccuracy * 100)}%</h3>
                  </div>
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                    <TrendingUp className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-2">{t('estimation_vs_actual')}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-card p-4 rounded-lg border shadow-sm">
                <h3 className="text-lg font-medium mb-4">{t('tasks_by_priority')}</h3>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={priorityChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {priorityChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value) => [value, t('tasks')]}
                        contentStyle={{ 
                          backgroundColor: 'var(--background)', 
                          color: 'var(--foreground)',
                          border: '1px solid var(--border)'
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              <div className="bg-card p-4 rounded-lg border shadow-sm">
                <h3 className="text-lg font-medium mb-4">{t('task_status_summary')}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg">
                    <p className="text-sm text-muted-foreground">{t('total_tasks')}</p>
                    <p className="text-2xl font-bold">{kpiData.totalTasks}</p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-950/30 p-3 rounded-lg">
                    <p className="text-sm text-muted-foreground">{t('completed_tasks')}</p>
                    <p className="text-2xl font-bold">{kpiData.completedTasks}</p>
                  </div>
                  <div className="bg-yellow-50 dark:bg-yellow-950/30 p-3 rounded-lg">
                    <p className="text-sm text-muted-foreground">{t('in_progress')}</p>
                    <p className="text-2xl font-bold">{kpiData.inProgressTasks}</p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-950/30 p-3 rounded-lg">
                    <p className="text-sm text-muted-foreground">{t('overdue_tasks')}</p>
                    <p className="text-2xl font-bold">{kpiData.overdueTasks}</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-card p-4 rounded-lg border shadow-sm">
              <h3 className="text-lg font-medium mb-4">{t('recent_completions')}</h3>
              {kpiData.recentCompletions.length > 0 ? (
                <div className="space-y-3">
                  {kpiData.recentCompletions.map((task) => (
                    <div key={task.id} className="flex items-center justify-between border-b pb-3">
                      <div>
                        <p className="font-medium">{task.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {t('completed_on')} {format(new Date(task.completedAt), 'PPP')}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge className={
                          task.efficiency === null ? 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200' :
                          task.efficiency >= 1 ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200' :
                          task.efficiency >= 0.8 ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200' :
                          'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200'
                        }>
                          {task.estimatedHours !== null && task.actualHours !== null
                            ? `${task.estimatedHours}h → ${task.actualHours}h (${formatEfficiency(task.efficiency)})`
                            : t('no_time_data')}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-4 text-muted-foreground">{t('no_completed_tasks')}</p>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="users" className="mt-0">
            <div className="bg-card p-6 rounded-lg border shadow-sm mb-6">
              <h3 className="text-xl font-semibold mb-4 text-foreground">{t('user_task_completion')}</h3>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={userCompletionData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 30 }}
                    barSize={40}
                    barGap={8}
                  >
                    <defs>
                      <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.6}/>
                      </linearGradient>
                      <linearGradient id="colorOverdue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0.6}/>
                      </linearGradient>
                      <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.6}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                      axisLine={{ stroke: 'var(--border)' }}
                      tickLine={{ stroke: 'var(--border)' }}
                      padding={{ left: 10, right: 10 }}
                    />
                    <YAxis 
                      tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                      axisLine={{ stroke: 'var(--border)' }}
                      tickLine={{ stroke: 'var(--border)' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'var(--background)', 
                        color: 'var(--foreground)',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                        border: '1px solid var(--border)',
                        padding: '10px'
                      }}
                      cursor={{ fill: 'rgba(224, 231, 255, 0.2)' }}
                      formatter={(value, name) => {
                        const displayName = name === 'completed' 
                          ? t('completed') 
                          : name === 'overdue' 
                            ? t('overdue') 
                            : t('total_assigned');
                        return [value, displayName];
                      }}
                      labelFormatter={(label) => `${label}`}
                    />
                    <Legend 
                      wrapperStyle={{ paddingTop: '20px' }}
                      formatter={(value) => {
                        return <span style={{ color: 'var(--muted-foreground)', fontSize: '14px', fontWeight: 500 }}>
                          {value === 'completed' 
                            ? t('completed') 
                            : value === 'overdue' 
                              ? t('overdue') 
                              : t('total_assigned')}
                        </span>
                      }}
                    />
                    <Bar 
                      dataKey="completed" 
                      stackId="a" 
                      fill="url(#colorCompleted)" 
                      name={t('completed')}
                      radius={[4, 4, 0, 0]}
                      animationDuration={1500}
                    />
                    <Bar 
                      dataKey="overdue" 
                      stackId="a" 
                      fill="url(#colorOverdue)" 
                      name={t('overdue')}
                      radius={[0, 0, 0, 0]}
                      animationDuration={1500}
                    />
                    <Bar 
                      dataKey="total" 
                      fill="url(#colorTotal)" 
                      name={t('total_assigned')}
                      radius={[4, 4, 0, 0]}
                      animationDuration={1500}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-lg font-medium">{t('user_performance_details')}</h3>
              {kpiData.tasksByUser.map((user) => (
                <div key={user.userId} className="bg-card p-4 rounded-lg border shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                      <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h4 className="font-medium">{user.userEmail}</h4>
                      <p className="text-sm text-muted-foreground">
                        {t('completed')}: {user.completedTasks}/{user.totalTasks} ({user.totalTasks > 0 ? Math.round((user.completedTasks / user.totalTasks) * 100) : 0}%)
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <p className="text-sm text-muted-foreground">{t('avg_completion_time')}</p>
                      <p className="font-medium">{user.averageCompletionTime.toFixed(1)} {t('hours')}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{t('overdue_tasks')}</p>
                      <p className="font-medium">{user.overdueTasks}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="insights" className="mt-0">
            <div className="bg-card p-4 rounded-lg border shadow-sm">
              <h3 className="text-lg font-medium mb-4">{t('ai_generated_insights')}</h3>
              {kpiData.aiInsights.length > 0 ? (
                <div className="space-y-4">
                  {kpiData.aiInsights.map((insight, index) => (
                    <Alert key={index} className="bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800">
                      <AlertTitle className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                        {t('insight')} #{index + 1}
                      </AlertTitle>
                      <AlertDescription className="text-indigo-700 dark:text-indigo-300">
                        {insight}
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              ) : (
                <p className="text-center py-4 text-muted-foreground">{t('no_ai_insights_available')}</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}