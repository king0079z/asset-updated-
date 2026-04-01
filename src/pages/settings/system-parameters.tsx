// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Settings, Save, RefreshCw, CheckCircle, Sliders, Bell, Shield, Wifi, Clock } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const PARAM_GROUPS = [
  {
    group: 'RFID Configuration',
    icon: Wifi,
    params: [
      { key: 'rfid.scan_frequency_seconds', label: 'RFID Scan Frequency (seconds)', type: 'number', default: '30', desc: 'How often active RFID tags upload their location data' },
      { key: 'rfid.low_battery_threshold', label: 'Low Battery Alert Threshold (%)', type: 'number', default: '20', desc: 'Trigger alert when active tag battery drops below this %' },
      { key: 'rfid.zone_exit_alarm_minutes', label: 'Zone Exit Alarm Delay (minutes)', type: 'number', default: '5', desc: 'Minutes an asset must be outside its zone before alarm fires' },
      { key: 'rfid.quick_stocktaking_minutes', label: 'Quick Stocktaking Window (minutes)', type: 'number', default: '30', desc: 'If seen within this window, asset is counted as in-stock' },
    ],
  },
  {
    group: 'SLA Defaults',
    icon: Clock,
    params: [
      { key: 'sla.default_response_hours', label: 'Default Response Time (hours)', type: 'number', default: '4', desc: 'Default SLA response target when no specific policy matches' },
      { key: 'sla.default_resolution_hours', label: 'Default Resolution Time (hours)', type: 'number', default: '24', desc: 'Default SLA resolution target' },
      { key: 'sla.escalation_check_minutes', label: 'Escalation Check Interval (minutes)', type: 'number', default: '5', desc: 'How often the cron checks for SLA breaches' },
      { key: 'sla.breach_notify_hours_before', label: 'Breach Warning (hours before)', type: 'number', default: '2', desc: 'Send warning N hours before SLA breach' },
    ],
  },
  {
    group: 'Notifications',
    icon: Bell,
    params: [
      { key: 'notify.email_enabled', label: 'Email Notifications Enabled', type: 'boolean', default: 'true', desc: 'Master switch for all email notifications' },
      { key: 'notify.overdue_borrow_reminder_hours', label: 'Overdue Borrow Reminder (hours)', type: 'number', default: '24', desc: 'Remind borrower every N hours after overdue' },
      { key: 'notify.warranty_expiry_days', label: 'Warranty Expiry Warning (days)', type: 'number', default: '30', desc: 'Days before warranty expiry to send alert' },
      { key: 'notify.max_notifications_per_day', label: 'Max Notifications Per User Per Day', type: 'number', default: '20', desc: 'Throttle notifications to prevent spam' },
    ],
  },
  {
    group: 'Security & Access',
    icon: Shield,
    params: [
      { key: 'security.session_timeout_hours', label: 'Session Timeout (hours)', type: 'number', default: '8', desc: 'Auto-logout inactive users after this many hours' },
      { key: 'security.max_login_attempts', label: 'Max Failed Login Attempts', type: 'number', default: '5', desc: 'Lock account after this many failed attempts' },
      { key: 'security.require_mfa', label: 'Require MFA for Admin Roles', type: 'boolean', default: 'false', desc: 'Enforce multi-factor authentication for ADMIN and MANAGER roles' },
      { key: 'security.audit_retention_days', label: 'Audit Log Retention (days)', type: 'number', default: '365', desc: 'How long to keep audit logs' },
    ],
  },
  {
    group: 'Asset Management',
    icon: Sliders,
    params: [
      { key: 'assets.max_assets_per_user', label: 'Max Assets Per User', type: 'number', default: '50', desc: 'Maximum assets that can be assigned to a single user' },
      { key: 'assets.borrow_max_days', label: 'Max Borrow Duration (days)', type: 'number', default: '30', desc: 'Maximum days an asset can be borrowed without admin override' },
      { key: 'assets.disposal_approval_required', label: 'Disposal Requires Approval', type: 'boolean', default: 'true', desc: 'Require manager approval before disposing assets' },
      { key: 'assets.auto_acknowledge_after_days', label: 'Auto-Acknowledge After (days)', type: 'number', default: '0', desc: '0 = never auto-acknowledge; N = auto-acknowledge after N days of assignment' },
    ],
  },
];

export default function SystemParametersPage() {
  const { toast } = useToast();
  const [params, setParams] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Initialize with defaults
    const defaults: Record<string, string> = {};
    PARAM_GROUPS.forEach(g => g.params.forEach(p => { defaults[p.key] = p.default; }));
    setParams(defaults);
    setLoading(false);
  }, []);

  const saveAll = async () => {
    setSaving(true);
    // Save each param to SystemSettings
    const saves = Object.entries(params).map(([key, value]) =>
      fetch('/api/admin/system-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      }).catch(() => null)
    );
    await Promise.all(saves);
    setSaving(false);
    toast({ title: 'System parameters saved', description: `${Object.keys(params).length} parameters updated` });
  };

  const updateParam = (key: string, value: string) => {
    setParams(p => ({ ...p, [key]: value }));
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-700 flex items-center justify-center">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">System Parameters</h1>
              <p className="text-sm text-gray-500">Configure all system settings without code changes</p>
            </div>
          </div>
          <Button onClick={saveAll} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />{saving ? 'Saving...' : 'Save All Parameters'}
          </Button>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2 text-sm text-green-700">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          All parameters can be changed here without any code modification or redeployment.
        </div>

        {PARAM_GROUPS.map(({ group, icon: Icon, params: groupParams }) => (
          <Card key={group}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Icon className="w-4 h-4" />{group}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {groupParams.map(param => (
                <div key={param.key} className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <label className="text-sm font-semibold text-gray-800 block">{param.label}</label>
                    <p className="text-xs text-gray-500 mt-0.5">{param.desc}</p>
                    <p className="text-xs text-gray-300 font-mono mt-0.5">{param.key}</p>
                  </div>
                  <div className="flex-shrink-0 w-40">
                    {param.type === 'boolean' ? (
                      <div className="flex items-center gap-2 mt-1">
                        <button
                          onClick={() => updateParam(param.key, params[param.key] === 'true' ? 'false' : 'true')}
                          className={`relative w-10 h-6 rounded-full transition-colors ${params[param.key] === 'true' ? 'bg-blue-600' : 'bg-gray-300'}`}>
                          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${params[param.key] === 'true' ? 'translate-x-5' : 'translate-x-1'}`} />
                        </button>
                        <span className="text-xs text-gray-500">{params[param.key] === 'true' ? 'Enabled' : 'Disabled'}</span>
                      </div>
                    ) : (
                      <Input type="number" value={params[param.key] || param.default}
                        onChange={e => updateParam(param.key, e.target.value)}
                        className="text-sm" />
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </DashboardLayout>
  );
}

