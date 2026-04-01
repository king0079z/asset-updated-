// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Route, Plus, CheckCircle, Clock, TrendingUp, AlertTriangle,
  User, Calendar, Package, RefreshCw, Play, BarChart2
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function InspectionRoutesPage() {
  const { toast } = useToast();
  const [routes, setRoutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [completing, setCompleting] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', periodDays: 30, assignedToId: '' });

  const fetch_ = async () => {
    setLoading(true);
    const res = await fetch('/api/inspection-routes').then(r => r.json()).catch(() => []);
    setRoutes(Array.isArray(res) ? res : []);
    setLoading(false);
  };

  useEffect(() => { fetch_(); }, []);

  const create = async () => {
    if (!form.name) { toast({ variant: 'destructive', title: 'Name required' }); return; }
    const res = await fetch('/api/inspection-routes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    if (res.ok) { toast({ title: 'Inspection route created' }); setShowNew(false); setForm({ name: '', description: '', periodDays: 30, assignedToId: '' }); fetch_(); }
    else toast({ variant: 'destructive', title: 'Failed' });
  };

  const complete = async (route: any) => {
    setCompleting(route.id);
    const res = await fetch(`/api/inspection-routes/${route.id}/complete`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isOnTime: new Date() <= new Date(route.nextDueAt), isSuccessful: true }),
    });
    setCompleting(null);
    if (res.ok) { toast({ title: 'Inspection completed', description: route.name }); fetch_(); }
    else toast({ variant: 'destructive', title: 'Failed to complete inspection' });
  };

  const isDue = (route: any) => route.nextDueAt && new Date(route.nextDueAt) <= new Date();
  const isOverdue = (route: any) => route.nextDueAt && new Date(route.nextDueAt) < new Date();

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center">
              <Route className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Inspection Routes</h1>
              <p className="text-sm text-gray-500">Set routes, periods, personnel and track delivery rates</p>
            </div>
          </div>
          <Button onClick={() => setShowNew(p => !p)} size="sm">
            <Plus className="w-4 h-4 mr-2" />New Route
          </Button>
        </div>

        {/* New Route Form */}
        {showNew && (
          <Card className="border-teal-200">
            <CardHeader><CardTitle className="text-base">Create Inspection Route</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Route Name</label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Server Room Monthly Inspection" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Period (days)</label>
                  <Input type="number" min="1" value={form.periodDays} onChange={e => setForm(f => ({ ...f, periodDays: Number(e.target.value) }))} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Description</label>
                <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Inspection scope and instructions" />
              </div>
              <div className="flex gap-2">
                <Button onClick={create}>Create Route</Button>
                <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Routes */}
        {loading ? (
          <div className="py-16 text-center text-gray-400">Loading routes...</div>
        ) : routes.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-gray-400">
              <Route className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No inspection routes. Create one to get started.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {routes.map(route => {
              const overdue = isOverdue(route);
              return (
                <Card key={route.id} className={overdue ? 'border-red-200' : ''}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-bold text-gray-900">{route.name}</p>
                          {overdue && <Badge className="bg-red-100 text-red-600 text-xs">OVERDUE</Badge>}
                        </div>
                        <p className="text-sm text-gray-500 mb-3">{route.description}</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {[
                            { label: 'Period', value: `${route.periodDays} days`, icon: Clock },
                            { label: 'Assigned To', value: route.assignedTo?.email || 'Unassigned', icon: User },
                            { label: 'Next Due', value: route.nextDueAt ? new Date(route.nextDueAt).toLocaleDateString() : 'N/A', icon: Calendar },
                            { label: 'Last Completed', value: route.lastCompletedAt ? new Date(route.lastCompletedAt).toLocaleDateString() : 'Never', icon: CheckCircle },
                          ].map(({ label, value, icon: Icon }) => (
                            <div key={label}>
                              <p className="text-xs text-gray-400 flex items-center gap-1"><Icon className="w-3 h-3" />{label}</p>
                              <p className="text-sm font-medium text-gray-700 mt-0.5 truncate">{value}</p>
                            </div>
                          ))}
                        </div>
                        {/* Delivery & Success Rate bars */}
                        {(route.deliveryRate != null || route.successRate != null) && (
                          <div className="mt-3 flex gap-4">
                            {route.deliveryRate != null && (
                              <div className="flex-1">
                                <div className="flex justify-between text-xs text-gray-500 mb-1">
                                  <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" />On-time Rate</span>
                                  <span className="font-semibold">{Math.round(route.deliveryRate)}%</span>
                                </div>
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${route.deliveryRate}%` }} />
                                </div>
                              </div>
                            )}
                            {route.successRate != null && (
                              <div className="flex-1">
                                <div className="flex justify-between text-xs text-gray-500 mb-1">
                                  <span className="flex items-center gap-1"><BarChart2 className="w-3 h-3" />Success Rate</span>
                                  <span className="font-semibold">{Math.round(route.successRate)}%</span>
                                </div>
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-green-500 rounded-full" style={{ width: `${route.successRate}%` }} />
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        {/* Recent completions */}
                        {route.completions?.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs text-gray-400 mb-1">Recent completions</p>
                            <div className="flex gap-2 flex-wrap">
                              {route.completions.slice(0, 5).map((c: any) => (
                                <Badge key={c.id} className={`text-xs ${c.isSuccessful ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                  {new Date(c.completedAt).toLocaleDateString()} {c.isOnTime ? '✓' : '⏰'}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        className={overdue ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-teal-600 hover:bg-teal-700 text-white'}
                        disabled={completing === route.id}
                        onClick={() => complete(route)}>
                        <Play className="w-3.5 h-3.5 mr-1" />
                        {completing === route.id ? 'Completing...' : 'Mark Complete'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

