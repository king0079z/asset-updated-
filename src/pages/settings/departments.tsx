// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Building2, Plus, Edit2, Trash2, CheckCircle, Package, RefreshCw, Save, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function DepartmentsSettingsPage() {
  const { toast } = useToast();
  const [depts, setDepts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', code: '', description: '' });
  const [saving, setSaving] = useState(false);

  const fetch_ = async () => {
    setLoading(true);
    const res = await fetch('/api/departments').then(r => r.json()).catch(() => []);
    setDepts(Array.isArray(res) ? res : []);
    setLoading(false);
  };

  useEffect(() => { fetch_(); }, []);

  const save = async () => {
    if (!form.name.trim()) { toast({ variant: 'destructive', title: 'Department name is required' }); return; }
    setSaving(true);
    const res = await fetch('/api/departments', {
      method: editId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editId ? { id: editId, ...form } : form),
      credentials: 'include',
    });
    setSaving(false);
    if (res.ok) {
      toast({ title: editId ? 'Department updated' : 'Department created' });
      setShowNew(false); setEditId(null); setForm({ name: '', code: '', description: '' }); fetch_();
    } else toast({ variant: 'destructive', title: 'Failed to save' });
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`Remove department "${name}"?`)) return;
    const res = await fetch('/api/departments', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }), credentials: 'include' });
    if (res.ok) { toast({ title: 'Department removed' }); fetch_(); }
  };

  const startEdit = (d: any) => { setEditId(d.id); setForm({ name: d.name, code: d.code || '', description: d.description || '' }); setShowNew(true); };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center"><Building2 className="w-5 h-5 text-white" /></div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Departments</h1>
              <p className="text-sm text-gray-500">Manage departments for spare parts assignment</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetch_}><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
            <Button size="sm" onClick={() => { setShowNew(p => !p); setEditId(null); setForm({ name: '', code: '', description: '' }); }}>
              <Plus className="w-4 h-4 mr-2" />Add Department
            </Button>
          </div>
        </div>

        {showNew && (
          <Card className="border-blue-200">
            <CardHeader><CardTitle className="text-sm">{editId ? 'Edit Department' : 'New Department'}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Department Name *</label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. IT Operations, Medical" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Code (optional)</label>
                  <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. IT, MED" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Description</label>
                <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description" />
              </div>
              <div className="flex gap-2">
                <Button onClick={save} disabled={saving}><Save className="w-4 h-4 mr-2" />{saving ? 'Saving…' : 'Save'}</Button>
                <Button variant="outline" onClick={() => { setShowNew(false); setEditId(null); }}><X className="w-4 h-4 mr-2" />Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle className="text-base">All Departments ({depts.length})</CardTitle><CardDescription>These departments are available when assigning spare parts</CardDescription></CardHeader>
          <CardContent className="p-0">
            {loading ? <div className="py-12 text-center text-gray-400">Loading…</div> :
            depts.length === 0 ? (
              <div className="py-12 text-center text-gray-400">
                <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No departments yet. Add one above to get started.</p>
              </div>
            ) : (
              <div className="divide-y">
                {depts.map(d => (
                  <div key={d.id} className="flex items-center gap-4 p-4 hover:bg-gray-50">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900">{d.name}</p>
                        {d.code && <Badge className="text-xs bg-gray-100 text-gray-600 border-gray-200 font-mono">{d.code}</Badge>}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                        {d.description && <span>{d.description}</span>}
                        <span className="flex items-center gap-1"><Package className="w-3 h-3" />{d._count?.assets || 0} assets</span>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => startEdit(d)}><Edit2 className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => remove(d.id, d.name)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
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
