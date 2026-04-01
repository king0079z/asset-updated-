// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Clock, Plus, Trash2, Save, AlertTriangle, TrendingUp, CheckCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const CATEGORIES = ['DEVICES', 'ACCESS', 'SERVICE_DESK', 'MAINTENANCE', 'INCIDENT', 'REQUEST', 'DAMAGE', 'LOSS', 'OTHER'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-blue-100 text-blue-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
};

export default function SLASettingsPage() {
  const { toast } = useToast();
  const [policies, setPolicies] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [matrix, setMatrix] = useState<Record<string, Record<string, { responseHours: number; resolutionHours: number }>>>({});
  const [stats, setStats] = useState({ total: 0, breached: 0, escalated: 0 });

  useEffect(() => {
    Promise.all([
      fetch('/api/sla/policies').then(r => r.json()),
      fetch('/api/sla/escalation-rules').then(r => r.json()),
    ]).then(([p, r]) => {
      setPolicies(Array.isArray(p) ? p : []);
      setRules(Array.isArray(r) ? r : []);
      const m: any = {};
      for (const cat of CATEGORIES) {
        m[cat] = {};
        for (const pri of PRIORITIES) {
          const existing = p.find((x: any) => x.category === cat && x.priority === pri);
          m[cat][pri] = { responseHours: existing?.responseHours || 4, resolutionHours: existing?.resolutionHours || 24 };
        }
      }
      setMatrix(m);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const savePolicy = async (category: string, priority: string) => {
    const { responseHours, resolutionHours } = matrix[category][priority];
    setSaving(true);
    const res = await fetch('/api/sla/policies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `${category} - ${priority}`, category, priority, responseHours, resolutionHours }),
    });
    setSaving(false);
    if (res.ok) toast({ title: 'SLA Policy saved', description: `${category} / ${priority}` });
    else toast({ variant: 'destructive', title: 'Failed to save' });
  };

  const addEscalationRule = async () => {
    const res = await fetch('/api/sla/escalation-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `Level ${rules.length + 1} Escalation`, level: rules.length + 1, delayMinutes: 60 }),
    });
    if (res.ok) { const rule = await res.json(); setRules(r => [...r, rule]); }
  };

  const updateRule = (id: string, field: string, value: any) => {
    setRules(r => r.map(x => x.id === id ? { ...x, [field]: value } : x));
  };

  const saveRule = async (rule: any) => {
    await fetch('/api/sla/escalation-rules', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule),
    });
    toast({ title: 'Escalation rule saved' });
  };

  if (loading) return <DashboardLayout><div className="p-8 text-center text-gray-500">Loading SLA settings...</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center">
            <Clock className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">SLA & Escalation Management</h1>
            <p className="text-sm text-gray-500">Configure service level agreements and escalation rules per ticket category</p>
          </div>
        </div>

        {/* SLA Matrix */}
        <Card>
          <CardHeader>
            <CardTitle>SLA Policy Matrix</CardTitle>
            <CardDescription>Set response and resolution hours for each category × priority combination</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 text-gray-500 font-semibold">Category</th>
                  {PRIORITIES.map(p => (
                    <th key={p} className="text-center py-2 px-3">
                      <span className={`inline-block px-2 py-1 rounded-lg text-xs font-bold ${PRIORITY_COLORS[p]}`}>{p}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CATEGORIES.map(cat => (
                  <tr key={cat} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-3 font-medium text-gray-700">{cat}</td>
                    {PRIORITIES.map(pri => (
                      <td key={pri} className="py-2 px-2 text-center">
                        <div className="flex flex-col gap-1 items-center">
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-400 w-16 text-right">Response</span>
                            <Input
                              type="number" min="1"
                              value={matrix[cat]?.[pri]?.responseHours || ''}
                              onChange={e => setMatrix(m => ({ ...m, [cat]: { ...m[cat], [pri]: { ...m[cat][pri], responseHours: Number(e.target.value) } } }))}
                              className="w-16 h-7 text-xs text-center"
                            />
                            <span className="text-xs text-gray-400">h</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-400 w-16 text-right">Resolve</span>
                            <Input
                              type="number" min="1"
                              value={matrix[cat]?.[pri]?.resolutionHours || ''}
                              onChange={e => setMatrix(m => ({ ...m, [cat]: { ...m[cat], [pri]: { ...m[cat][pri], resolutionHours: Number(e.target.value) } } }))}
                              className="w-16 h-7 text-xs text-center"
                            />
                            <span className="text-xs text-gray-400">h</span>
                          </div>
                          <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => savePolicy(cat, pri)}>
                            <Save className="w-3 h-3 mr-1" />Save
                          </Button>
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Escalation Rules */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Escalation Rules</CardTitle>
              <CardDescription>Define escalation tiers that trigger when SLA is breached</CardDescription>
            </div>
            <Button size="sm" onClick={addEscalationRule}><Plus className="w-4 h-4 mr-1" />Add Rule</Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {rules.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No escalation rules defined yet. Add rules to enable automatic escalation.</p>
              </div>
            )}
            {rules.map((rule, i) => (
              <div key={rule.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border">
                <div className="w-8 h-8 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                  L{rule.level}
                </div>
                <Input className="w-40 h-8 text-sm" value={rule.name} onChange={e => updateRule(rule.id, 'name', e.target.value)} placeholder="Rule name" />
                <span className="text-xs text-gray-500">Level</span>
                <Input type="number" min="1" max="10" className="w-16 h-8 text-sm" value={rule.level} onChange={e => updateRule(rule.id, 'level', Number(e.target.value))} />
                <span className="text-xs text-gray-500">After</span>
                <Input type="number" min="1" className="w-20 h-8 text-sm" value={rule.delayMinutes} onChange={e => updateRule(rule.id, 'delayMinutes', Number(e.target.value))} />
                <span className="text-xs text-gray-500">min breach</span>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => saveRule(rule)}>
                  <Save className="w-3 h-3 mr-1" />Save
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* SLA Compliance Dashboard */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingUp className="w-4 h-4" /> SLA Compliance Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'SLA Policies', value: policies.length, icon: CheckCircle, color: 'text-green-600' },
                { label: 'Escalation Rules', value: rules.length, icon: AlertTriangle, color: 'text-yellow-600' },
                { label: 'Monitor Interval', value: '5 min', icon: Clock, color: 'text-blue-600' },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="text-center p-4 bg-gray-50 rounded-xl">
                  <Icon className={`w-6 h-6 mx-auto mb-2 ${color}`} />
                  <p className="text-2xl font-bold text-gray-900">{value}</p>
                  <p className="text-xs text-gray-500 mt-1">{label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

