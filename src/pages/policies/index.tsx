// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Shield, Plus, CheckCircle, Users, Calendar, FileText, Eye } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function PoliciesPage() {
  const { toast } = useToast();
  const [policies, setPolicies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', version: '1.0', requiresAcceptance: true });

  const fetch_ = async () => {
    setLoading(true);
    const res = await fetch('/api/policies').then(r => r.json()).catch(() => []);
    setPolicies(Array.isArray(res) ? res : []);
    setLoading(false);
  };

  useEffect(() => { fetch_(); }, []);

  const create = async () => {
    if (!form.title || !form.content) { toast({ variant: 'destructive', title: 'Title and content required' }); return; }
    const res = await fetch('/api/policies', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    if (res.ok) { toast({ title: 'Policy created' }); setShowNew(false); setForm({ title: '', content: '', version: '1.0', requiresAcceptance: true }); fetch_(); }
    else toast({ variant: 'destructive', title: 'Failed' });
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-700 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Policy Documents</h1>
              <p className="text-sm text-gray-500">Manage asset usage policies that users must accept</p>
            </div>
          </div>
          <Button onClick={() => setShowNew(p => !p)} size="sm"><Plus className="w-4 h-4 mr-2" />New Policy</Button>
        </div>

        {showNew && (
          <Card className="border-green-200">
            <CardHeader><CardTitle className="text-sm">Create Policy Document</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Title</label>
                  <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Asset Usage Policy" /></div>
                <div><label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Version</label>
                  <Input value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} placeholder="1.0" /></div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Policy Content</label>
                <textarea className="w-full border rounded-lg px-3 py-2 text-sm resize-none" rows={6}
                  value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  placeholder="Enter the full policy text that users will read and accept..." />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="reqAccept" checked={form.requiresAcceptance}
                  onChange={e => setForm(f => ({ ...f, requiresAcceptance: e.target.checked }))} className="w-4 h-4 accent-green-600" />
                <label htmlFor="reqAccept" className="text-sm">Require user acceptance before asset access</label>
              </div>
              <div className="flex gap-2">
                <Button onClick={create}>Create Policy</Button>
                <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {loading ? <div className="py-12 text-center text-gray-400">Loading...</div> :
          policies.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-gray-400">
              <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No policies defined. Create one above.</p>
            </CardContent></Card>
          ) : (
            policies.map(policy => (
              <Card key={policy.id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="w-4 h-4 text-green-600" />
                        <p className="font-semibold text-gray-900">{policy.title}</p>
                        <Badge className="text-xs bg-blue-100 text-blue-700">v{policy.version}</Badge>
                        {policy.requiresAcceptance && <Badge className="text-xs bg-orange-100 text-orange-700">Requires Acceptance</Badge>}
                        {!policy.isActive && <Badge className="text-xs bg-gray-100 text-gray-500">Inactive</Badge>}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Effective {new Date(policy.effectiveDate).toLocaleDateString()}</span>
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" />{policy._count?.acceptances || 0} acceptances</span>
                      </div>
                      {policy.content && (
                        <p className="text-xs text-gray-400 mt-2 line-clamp-2">{policy.content.slice(0, 150)}...</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {policy._count?.acceptances > 0 && (
                        <Badge className="text-xs bg-green-100 text-green-700">
                          <CheckCircle className="w-3 h-3 mr-1" />{policy._count.acceptances} accepted
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

