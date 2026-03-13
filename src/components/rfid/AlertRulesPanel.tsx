'use client';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface AlertRule {
  id: string;
  type: string;
  name: string;
  enabled: boolean;
  config: Record<string, any>;
  _count?: { alerts: number };
}

interface Zone { id: string; name: string; }

const RULE_TYPES = [
  {
    type: 'ZONE_BREACH',
    label: 'Zone Breach',
    description: 'Alert when an asset is detected outside its assigned home zone',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    severityColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
    severity: 'WARNING',
  },
  {
    type: 'RESTRICTED_ZONE',
    label: 'Restricted Zone Entry',
    description: 'Alert when any asset enters a zone marked as restricted',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
    ),
    severityColor: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
    severity: 'CRITICAL',
  },
  {
    type: 'MISSING',
    label: 'Missing Asset',
    description: 'Alert when an asset has not been scanned for a set period',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    severityColor: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
    severity: 'WARNING',
  },
  {
    type: 'LOW_BATTERY',
    label: 'Low Battery',
    description: 'Alert when a tag battery level drops below the threshold',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7h14a2 2 0 012 2v6a2 2 0 01-2 2H3a2 2 0 01-2-2V9a2 2 0 012-2zm17 4h1a1 1 0 011 1v2a1 1 0 01-1 1h-1" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 11v2" />
      </svg>
    ),
    severityColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    severity: 'INFO',
  },
];

export default function AlertRulesPanel() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null); // rule type being configured
  const [savingId, setSavingId] = useState<string | null>(null);
  const [configs, setConfigs] = useState<Record<string, Record<string, any>>>({});

  const fetchData = useCallback(async () => {
    const [rulesRes, zonesRes] = await Promise.all([
      fetch('/api/rfid/alert-rules'),
      fetch('/api/rfid/zones'),
    ]);
    if (rulesRes.ok) {
      const { rules: r } = await rulesRes.json();
      setRules(r ?? []);
      const c: Record<string, Record<string, any>> = {};
      (r ?? []).forEach((rule: AlertRule) => { c[rule.type] = rule.config; });
      setConfigs(c);
    }
    if (zonesRes.ok) {
      const { zones: z } = await zonesRes.json();
      setZones(z ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getRuleForType = (type: string) => rules.find(r => r.type === type);

  const toggleRule = async (type: string, enabled: boolean) => {
    const existing = getRuleForType(type);
    const ruleType = RULE_TYPES.find(rt => rt.type === type)!;
    try {
      if (existing) {
        await fetch(`/api/rfid/alert-rules/${existing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled }),
        });
      } else {
        await fetch('/api/rfid/alert-rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type, name: ruleType.label, enabled,
            config: getDefaultConfig(type),
          }),
        });
      }
      toast.success(enabled ? `${ruleType.label} alerts enabled` : `${ruleType.label} alerts disabled`);
      await fetchData();
    } catch { toast.error('Failed to update rule'); }
  };

  const saveConfig = async (type: string) => {
    const existing = getRuleForType(type);
    const ruleType = RULE_TYPES.find(rt => rt.type === type)!;
    const config = configs[type] ?? getDefaultConfig(type);
    setSavingId(type);
    try {
      if (existing) {
        await fetch(`/api/rfid/alert-rules/${existing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config }),
        });
      } else {
        await fetch('/api/rfid/alert-rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, name: ruleType.label, enabled: true, config }),
        });
      }
      toast.success('Settings saved');
      setEditing(null);
      await fetchData();
    } catch { toast.error('Failed to save'); } finally { setSavingId(null); }
  };

  const getDefaultConfig = (type: string) => {
    switch (type) {
      case 'MISSING':      return { thresholdMinutes: 30 };
      case 'LOW_BATTERY':  return { batteryThreshold: 20 };
      case 'ZONE_BREACH':  return { zoneId: '' };
      case 'RESTRICTED_ZONE': return {};
      default: return {};
    }
  };

  const updateConfig = (type: string, key: string, value: any) => {
    setConfigs(prev => ({ ...prev, [type]: { ...(prev[type] ?? {}), [key]: value } }));
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-48 rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Automation Rules</h3>
        <p className="text-sm text-muted-foreground">Configure which events trigger automatic alerts in real-time</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {RULE_TYPES.map(rt => {
          const rule = getRuleForType(rt.type);
          const isEnabled = rule?.enabled ?? false;
          const config = configs[rt.type] ?? getDefaultConfig(rt.type);
          const isEditing = editing === rt.type;
          const alertCount = rule?._count?.alerts ?? 0;

          return (
            <Card
              key={rt.type}
              className={`border transition-all duration-200 ${isEnabled ? 'shadow-md' : 'opacity-70'}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${isEnabled ? rt.severityColor : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>
                      {rt.icon}
                    </div>
                    <div>
                      <CardTitle className="text-sm font-semibold">{rt.label}</CardTitle>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge variant="outline" className={`text-[10px] h-4 px-1.5 border-0 ${rt.severityColor}`}>
                          {rt.severity}
                        </Badge>
                        {alertCount > 0 && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                            {alertCount} alerts
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <Switch checked={isEnabled} onCheckedChange={v => toggleRule(rt.type, v)} />
                </div>
                <CardDescription className="text-xs mt-2">{rt.description}</CardDescription>
              </CardHeader>

              <CardContent className="pt-0 space-y-3">
                {/* Config panel */}
                {rt.type === 'MISSING' && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">No-scan threshold</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range" min={5} max={240} step={5}
                        value={config.thresholdMinutes ?? 30}
                        onChange={e => updateConfig(rt.type, 'thresholdMinutes', Number(e.target.value))}
                        className="flex-1 accent-blue-500"
                      />
                      <span className="text-sm font-medium w-16 text-right">{config.thresholdMinutes ?? 30} min</span>
                    </div>
                  </div>
                )}

                {rt.type === 'LOW_BATTERY' && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Battery threshold</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range" min={5} max={50} step={5}
                        value={config.batteryThreshold ?? 20}
                        onChange={e => updateConfig(rt.type, 'batteryThreshold', Number(e.target.value))}
                        className="flex-1 accent-blue-500"
                      />
                      <span className="text-sm font-medium w-12 text-right">{config.batteryThreshold ?? 20}%</span>
                    </div>
                  </div>
                )}

                {rt.type === 'ZONE_BREACH' && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Home zone (alert if asset leaves this zone)</Label>
                    <Select
                      value={config.zoneId ?? ''}
                      onValueChange={v => updateConfig(rt.type, 'zoneId', v)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select zone..." />
                      </SelectTrigger>
                      <SelectContent>
                        {zones.map(z => (
                          <SelectItem key={z.id} value={z.id} className="text-xs">{z.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {rt.type === 'RESTRICTED_ZONE' && (
                  <p className="text-xs text-muted-foreground">
                    Mark zones as restricted in the Zone Editor. Any asset entering a restricted zone will trigger a CRITICAL alert immediately.
                  </p>
                )}

                {rt.type !== 'RESTRICTED_ZONE' && (
                  <Button
                    size="sm"
                    variant={isEnabled ? 'default' : 'outline'}
                    className="w-full h-7 text-xs"
                    onClick={() => saveConfig(rt.type)}
                    disabled={savingId === rt.type}
                  >
                    {savingId === rt.type ? 'Saving...' : 'Save Settings'}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
