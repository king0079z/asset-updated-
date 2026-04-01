// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { GitBranch, Plus, Save, Trash2, ArrowRight, Settings, Shield } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const CATEGORIES = ['DEVICES', 'ACCESS', 'SERVICE_DESK', 'MAINTENANCE', 'INCIDENT', 'REQUEST', 'DAMAGE', 'LOSS'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const DEFAULT_STATUSES = ['OPEN', 'IN_PROGRESS', 'PENDING', 'RESOLVED', 'CLOSED'];
const ROLES = ['ADMIN', 'MANAGER', 'STAFF', 'HANDHELD'];

export default function WorkflowSettingsPage() {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCat, setSelectedCat] = useState('INCIDENT');
  const [statuses, setStatuses] = useState<string[]>([...DEFAULT_STATUSES]);
  const [customFields, setCustomFields] = useState<any[]>([]);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState('text');
  const [saving, setSaving] = useState(false);

  // Routing rule form
  const [ruleForm, setRuleForm] = useState({ category: 'INCIDENT', priority: 'HIGH', assignToRole: 'MANAGER', teamName: '' });

  useEffect(() => {
    Promise.all([
      fetch('/api/workflow/configs').then(r => r.json()).catch(() => []),
      fetch('/api/workflow/routing-rules').then(r => r.json()).catch(() => []),
    ]).then(([c, r]) => {
      setConfigs(Array.isArray(c) ? c : []);
      setRules(Array.isArray(r) ? r : []);
      setLoading(false);
      const cfg = (Array.isArray(c) ? c : []).find((x: any) => x.ticketCategory === selectedCat);
      if (cfg) {
        setStatuses(Array.isArray(cfg.statuses) ? cfg.statuses : DEFAULT_STATUSES);
        setCustomFields(Array.isArray(cfg.customFields) ? cfg.customFields : []);
      }
    });
  }, []);

  const loadConfig = (cat: string) => {
    setSelectedCat(cat);
    const cfg = configs.find(c => c.ticketCategory === cat);
    setStatuses(cfg?.statuses && Array.isArray(cfg.statuses) ? cfg.statuses : [...DEFAULT_STATUSES]);
    setCustomFields(cfg?.customFields && Array.isArray(cfg.customFields) ? cfg.customFields : []);
  };

  const saveConfig = async () => {
    setSaving(true);
    const res = await fetch('/api/workflow/configs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketCategory: selectedCat, statuses, customFields }),
    });
    setSaving(false);
    if (res.ok) {
      toast({ title: 'Workflow saved', description: `${selectedCat} workflow updated` });
      const updated = await fetch('/api/workflow/configs').then(r => r.json());
      setConfigs(Array.isArray(updated) ? updated : []);
    } else toast({ variant: 'destructive', title: 'Failed to save' });
  };

  const addField = () => {
    if (!newFieldName.trim()) return;
    setCustomFields(f => [...f, { name: newFieldName.trim(), type: newFieldType, required: false }]);
    setNewFieldName('');
  };

  const addRule = async () => {
    const res = await fetch('/api/workflow/routing-rules', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ruleForm),
    });
    if (res.ok) {
      const rule = await res.json();
      setRules(r => [...r, rule]);
      toast({ title: 'Routing rule added' });
    }
  };

  const deleteRule = async (id: string) => {
    await fetch('/api/workflow/routing-rules', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
    });
    setRules(r => r.filter(x => x.id !== id));
    toast({ title: 'Rule deleted' });
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center">
            <GitBranch className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Ticket Workflow Configuration</h1>
            <p className="text-sm text-gray-500">Customize statuses, fields, and auto-routing per ticket category</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Left: Category selector */}
          <div className="col-span-1 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Ticket Category</p>
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => loadConfig(cat)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all ${selectedCat === cat ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                {cat}
                {configs.find(c => c.ticketCategory === cat) && (
                  <Badge className="ml-2 bg-green-100 text-green-700 text-xs border-0">Custom</Badge>
                )}
              </button>
            ))}
          </div>

          {/* Right: Config */}
          <div className="col-span-2 space-y-4">
            {/* Workflow Statuses */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Status Workflow — {selectedCat}</CardTitle>
                <CardDescription>Define the ordered list of statuses for this ticket category</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2 items-center">
                  {statuses.map((s, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <Badge className="bg-violet-100 text-violet-700 flex items-center gap-1">
                        {s}
                        <button className="ml-1 text-violet-400 hover:text-red-500"
                          onClick={() => setStatuses(st => st.filter((_, j) => j !== i))}>×</button>
                      </Badge>
                      {i < statuses.length - 1 && <ArrowRight className="w-3 h-3 text-gray-300" />}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <select className="border rounded-lg px-3 py-1.5 text-sm bg-white"
                    onChange={e => { if (e.target.value && !statuses.includes(e.target.value)) setStatuses(s => [...s, e.target.value]); }}>
                    <option value="">Add status...</option>
                    {['OPEN','IN_PROGRESS','PENDING','RESOLVED','CLOSED','ESCALATED','REOPENED','ON_HOLD','AWAITING_PARTS'].map(s => (
                      <option key={s} disabled={statuses.includes(s)}>{s}</option>
                    ))}
                  </select>
                </div>
              </CardContent>
            </Card>

            {/* Custom Fields */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Custom Fields — {selectedCat}</CardTitle>
                <CardDescription>Additional fields on the ticket form for this category</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {customFields.length === 0 ? (
                  <p className="text-xs text-gray-400">No custom fields yet.</p>
                ) : (
                  <div className="space-y-2">
                    {customFields.map((f, i) => (
                      <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
                        <span className="text-sm font-medium text-gray-800 flex-1">{f.name}</span>
                        <Badge className="text-xs bg-blue-100 text-blue-700">{f.type}</Badge>
                        {f.required && <Badge className="text-xs bg-red-100 text-red-600">Required</Badge>}
                        <button className="text-gray-400 hover:text-red-500" onClick={() => setCustomFields(cf => cf.filter((_, j) => j !== i))}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Input placeholder="Field name" value={newFieldName} onChange={e => setNewFieldName(e.target.value)} className="flex-1" />
                  <select className="border rounded-lg px-3 py-1.5 text-sm bg-white" value={newFieldType} onChange={e => setNewFieldType(e.target.value)}>
                    {['text', 'number', 'date', 'select', 'textarea', 'file'].map(t => <option key={t}>{t}</option>)}
                  </select>
                  <Button size="sm" onClick={addField}><Plus className="w-3.5 h-3.5" /></Button>
                </div>
                <Button onClick={saveConfig} disabled={saving} className="w-full">
                  <Save className="w-4 h-4 mr-2" />{saving ? 'Saving...' : 'Save Workflow Config'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Auto-Routing Rules */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Auto-Routing Rules</CardTitle>
              <CardDescription>Automatically assign tickets to roles/teams based on category and priority</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Rule builder */}
            <div className="grid grid-cols-5 gap-2 items-end">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Category</label>
                <select className="w-full border rounded-lg px-2 py-1.5 text-sm bg-white"
                  value={ruleForm.category} onChange={e => setRuleForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Priority</label>
                <select className="w-full border rounded-lg px-2 py-1.5 text-sm bg-white"
                  value={ruleForm.priority} onChange={e => setRuleForm(f => ({ ...f, priority: e.target.value }))}>
                  {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Assign Role</label>
                <select className="w-full border rounded-lg px-2 py-1.5 text-sm bg-white"
                  value={ruleForm.assignToRole} onChange={e => setRuleForm(f => ({ ...f, assignToRole: e.target.value }))}>
                  {ROLES.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Team Name</label>
                <Input className="h-8 text-sm" value={ruleForm.teamName} onChange={e => setRuleForm(f => ({ ...f, teamName: e.target.value }))} placeholder="e.g. IT Support" />
              </div>
              <Button onClick={addRule} size="sm"><Plus className="w-3.5 h-3.5 mr-1" />Add Rule</Button>
            </div>

            {/* Segregation of duties notice */}
            <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm">
              <Shield className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-blue-800">Segregation of Duties</p>
                <p className="text-xs text-blue-600 mt-0.5">The system enforces: Requesters cannot approve their own requests. Approvers cannot resolve tickets they submitted. Resolvers must be different from the original requester for DISPOSAL and BORROW workflows. This is enforced at the API level for all approval chains.</p>
              </div>
            </div>

            {/* Rules list */}
            {rules.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No routing rules defined.</p>
            ) : (
              <div className="space-y-2">
                {rules.map(rule => (
                  <div key={rule.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2">
                    <Badge className="text-xs bg-purple-100 text-purple-700">{rule.category || 'ANY'}</Badge>
                    <ArrowRight className="w-3 h-3 text-gray-400" />
                    <Badge className="text-xs bg-orange-100 text-orange-700">{rule.priority || 'ANY'}</Badge>
                    <ArrowRight className="w-3 h-3 text-gray-400" />
                    <span className="text-sm text-gray-700">→ Role: <strong>{rule.assignToRole || 'ANY'}</strong></span>
                    {rule.teamName && <span className="text-xs text-gray-400">({rule.teamName})</span>}
                    <button className="ml-auto text-gray-400 hover:text-red-500" onClick={() => deleteRule(rule.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

