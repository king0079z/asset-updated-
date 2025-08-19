import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, BarChart3 } from "lucide-react";

/**
 * Skeleton loading state for the dashboard
 * Displays placeholder UI while data is being fetched
 */
export function DashboardSkeleton() {
  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 md:p-10 pb-24 sm:pb-24 md:pb-10">
      {/* Welcome Section Skeleton */}
      <div className="bg-gradient-to-r from-slate-50 to-blue-50 dark:from-gray-800 dark:to-gray-900 rounded-xl p-4 sm:p-6 shadow-sm border border-slate-100 dark:border-gray-700">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64 bg-slate-200 dark:bg-slate-700" />
            <Skeleton className="h-4 w-40 bg-slate-200 dark:bg-slate-700" />
            <Skeleton className="h-4 w-80 bg-slate-200 dark:bg-slate-700" />
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3 mt-2 md:mt-0">
            <Skeleton className="h-9 w-32 bg-slate-200 dark:bg-slate-700" />
            <Skeleton className="h-9 w-32 bg-slate-200 dark:bg-slate-700" />
          </div>
        </div>
      </div>

      {/* Key Performance Metrics Skeleton */}
      <div>
        <div className="flex items-center mb-4">
          <Activity className="mr-2 h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          <Skeleton className="h-6 w-48 bg-slate-200 dark:bg-slate-700" />
        </div>
        <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border-none shadow-lg overflow-hidden bg-card dark:bg-gray-800 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-800 dark:to-gray-750 opacity-50"></div>
              <CardHeader className="relative pb-2 pt-5">
                <div className="absolute -top-4 left-4 w-12 h-12 rounded-full bg-slate-300 dark:bg-slate-600 flex items-center justify-center shadow-lg"></div>
                <div className="ml-10">
                  <Skeleton className="h-5 w-36 bg-slate-200 dark:bg-slate-700 mb-1" />
                  <Skeleton className="h-4 w-24 bg-slate-200 dark:bg-slate-700" />
                </div>
              </CardHeader>
              <CardContent className="pt-4 pb-5 relative z-10">
                <Skeleton className="h-8 w-32 bg-slate-200 dark:bg-slate-700 mb-4" />
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full bg-slate-200 dark:bg-slate-700" />
                  <Skeleton className="h-4 w-full bg-slate-200 dark:bg-slate-700" />
                  <Skeleton className="h-4 w-full bg-slate-200 dark:bg-slate-700" />
                  <Skeleton className="h-8 w-full bg-slate-200 dark:bg-slate-700" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Budget Overview Skeleton */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card dark:bg-gray-800 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm">
          <div>
            <div className="flex items-center">
              <BarChart3 className="mr-2 h-5 w-5 text-slate-700 dark:text-slate-300" />
              <Skeleton className="h-6 w-48 bg-slate-200 dark:bg-slate-700" />
            </div>
            <Skeleton className="h-4 w-80 bg-slate-200 dark:bg-slate-700 mt-2" />
          </div>
          <Skeleton className="h-10 w-40 bg-slate-200 dark:bg-slate-700" />
        </div>
        
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border border-slate-200 dark:border-slate-700">
              <CardHeader>
                <Skeleton className="h-6 w-40 bg-slate-200 dark:bg-slate-700" />
                <Skeleton className="h-4 w-32 bg-slate-200 dark:bg-slate-700 mt-1" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32 bg-slate-200 dark:bg-slate-700 mb-4" />
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full bg-slate-200 dark:bg-slate-700" />
                  <Skeleton className="h-4 w-full bg-slate-200 dark:bg-slate-700" />
                  <Skeleton className="h-4 w-full bg-slate-200 dark:bg-slate-700" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Quick Actions & AI Alerts Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center mb-4">
            <Activity className="mr-2 h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <Skeleton className="h-6 w-36 bg-slate-200 dark:bg-slate-700" />
          </div>
          <div className="grid grid-cols-1 xs:grid-cols-2 gap-5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-800 dark:to-gray-750 border border-slate-200 dark:border-slate-700 shadow-md p-6">
                <div className="flex flex-col items-center justify-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-slate-300 dark:bg-slate-600 flex items-center justify-center"></div>
                  <div className="text-center space-y-2">
                    <Skeleton className="h-5 w-24 bg-slate-200 dark:bg-slate-700 mx-auto" />
                    <Skeleton className="h-4 w-32 bg-slate-200 dark:bg-slate-700 mx-auto" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div>
          <div className="flex items-center mb-4">
            <Activity className="mr-2 h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <Skeleton className="h-6 w-48 bg-slate-200 dark:bg-slate-700" />
          </div>
          <Card className="border border-slate-200 dark:border-slate-700 h-[calc(100%-40px)]">
            <CardContent className="p-6 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-32 bg-slate-200 dark:bg-slate-700" />
                    <Skeleton className="h-5 w-16 bg-slate-200 dark:bg-slate-700" />
                  </div>
                  <Skeleton className="h-4 w-full bg-slate-200 dark:bg-slate-700" />
                  <Skeleton className="h-4 w-3/4 bg-slate-200 dark:bg-slate-700" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}