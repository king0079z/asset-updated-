// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  CheckSquare, Plus, CheckCircle, XCircle, Clock, User,
  ArrowRight, RefreshCw, Layers, AlertTriangle
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const STATUS_COLORS: Record<string, string> = {
  PENDING:   'bg-yellow-100 text-yellow-700',
  APPROVED:  'bg-green-100 text-green-700',
  REJECTED:  'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
};

const ENTITY_COLORS: Record<string, string> = {
  TICKET:   'bg-blue-100 text-blue-700',
  BORROW:   'bg-purple-100 text-purple-700',
  DISPOSAL: 'bg-red-100 text-red-700',
  TRANSFER: 'bg-teal-100 text-teal-700',
};

export default function ApprovalSettingsPage() {
  const { toast } = useToast();
  const [chains, setChains] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [deciding, setDeciding] = useState<string | null>(null);
  const [tab, setTab] = useState<'chains' | 'pending'>('pending');
  const [form, setForm] = useState({ name: '', description: '', entityType: 'TICKET', steps: [] as any[] });
  const [stepRole, setStepRole] = useState('MANAGER');

  const fetch_ = async () => {
    setLoading(true);
    const [c, r] = await Promise.all([
      fetch('/api/approval/chains').then(r => r.json()).catch(() => []),
      fetch('/api/approval/requests?pendingFor=me').then(r => r.json()).catch(() => []),
    ]);
    setChains(Array.isArray(c) ? c : []);
    setRequests(Array.isArray(r) ? r : []);
    setLoading(false);
  };

  useEffect(() => { fetch_(); }, []);

  const createChain = async () => {
    if (!form.name) { toast({ variant: 'destructive', title: 'Name required' }); return; }
    const res = await fetch('/api/approval/chains', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    if (res.ok) { toast({ title: 'Approval chain created' }); setShowNew(false); fetch_(); }
  };

  const addStep = () => {
    setForm(f => ({ ...f, steps: [...f.steps, { role: stepRole, order: f.steps.length }] }));
  };

  const decide = async (requestId: string, stepId: string, decision: 'APPROVED' | 'REJECTED') => {
    const reason = decision === 'REJECTED' ? prompt('Rejection reason:') : undefined;
    setDeciding(stepId);
    const res = await fetch(`/api/approval/requests/${requestId}/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stepId, decision, comment: reason }),
    });
    setDeciding(null);
    if (res.ok) { toast({ title: `Request ${decision.toLowerCase()}` }); fetch_(); }
    else toast({ variant: 'destructive', title: 'Failed' });
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-600 flex items-center justify-center">
              <CheckSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Approval Management</h1>
              <p className="text-sm text-gray-500">Multi-level approval chains for tickets, borrowing, and disposals</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetch_}><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
        </div>

        {/* Pending approvals badge */}
        {requests.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
            <p className="text-sm text-yellow-800">You have <strong>{requests.length}</strong> pending approval request(s) awaiting your decision.</p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 border-b">
          <button onClick={() => setTab('pending')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-all ${tab === 'pending' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500'}`}>
            <Clock className="w-4 h-4 inline mr-1" />Pending Approvals
            {requests.length > 0 && <Badge className="ml-1 bg-yellow-100 text-yellow-700 text-xs">{requests.length}</Badge>}
          </button>
          <button onClick={() => setTab('chains')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-all ${tab === 'chains' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500'}`}>
            <Layers className="w-4 h-4 inline mr-1" />Approval Chains
          </button>
        </div>

        {tab === 'pending' && (
          <div className="space-y-4">
            {loading ? <div className="py-12 text-center text-gray-400">Loading...</div> :
            requests.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-gray-400">
                <CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-400 opacity-50" />
                <p className="font-medium">No pending approvals</p>
                <p className="text-sm mt-1">All approval requests have been actioned.</p>
              </CardContent></Card>
            ) : (
              requests.map(req => {
                const myStep = req.steps?.find((s: any) => s.status === 'PENDING');
                return (
                  <Card key={req.id} className="border-yellow-200 bg-yellow-50/30">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className={`text-xs ${ENTITY_COLORS[req.entityType] || 'bg-gray-100 text-gray-600'}`}>{req.entityType}</Badge>
                            <span className="text-sm font-mono text-gray-500">{req.entityId?.slice(0, 12)}...</span>
                          </div>
                          <p className="text-sm text-gray-700 mt-1">
                            Requested by <strong>{req.requestedBy?.email}</strong>
                          </p>
                          {req.notes && <p className="text-xs text-gray-500 mt-1 italic">"{req.notes}"</p>}
                          {/* Steps progress */}
                          <div className="flex items-center gap-1 mt-2 flex-wrap">
                            {req.steps?.map((s: any, i: number) => (
                              <div key={s.id} className="flex items-center gap-1">
                                <Badge className={`text-xs ${STATUS_COLORS[s.status] || 'bg-gray-100'}`}>
                                  Step {s.stepOrder + 1}: {s.assignedTo?.email?.split('@')[0]}
                                </Badge>
                                {i < req.steps.length - 1 && <ArrowRight className="w-3 h-3 text-gray-300" />}
                              </div>
                            ))}
                          </div>
                        </div>
                        {myStep && (
                          <div className="flex gap-2 flex-shrink-0">
                            <Button size="sm" className="bg-green-600 hover:bg-green-700"
                              disabled={deciding === myStep.id}
                              onClick={() => decide(req.id, myStep.id, 'APPROVED')}>
                              <CheckCircle className="w-3.5 h-3.5 mr-1" />Approve
                            </Button>
                            <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50"
                              disabled={deciding === myStep.id}
                              onClick={() => decide(req.id, myStep.id, 'REJECTED')}>
                              <XCircle className="w-3.5 h-3.5 mr-1" />Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}

        {tab === 'chains' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setShowNew(p => !p)}><Plus className="w-4 h-4 mr-2" />New Chain</Button>
            </div>

            {showNew && (
              <Card className="border-green-200">
                <CardHeader><CardTitle className="text-sm">Create Approval Chain</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Chain Name</label>
                      <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Asset Disposal Approval" /></div>
                    <div><label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Entity Type</label>
                      <select className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                        value={form.entityType} onChange={e => setForm(f => ({ ...f, entityType: e.target.value }))}>
                        {['TICKET', 'BORROW', 'DISPOSAL', 'TRANSFER'].map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Steps</label>
                    <div className="flex gap-2 mb-2">
                      <select className="border rounded-lg px-3 py-2 text-sm bg-white flex-1" value={stepRole} onChange={e => setStepRole(e.target.value)}>
                        {['ADMIN', 'MANAGER', 'STAFF'].map(r => <option key={r}>{r}</option>)}
                      </select>
                      <Button size="sm" variant="outline" onClick={addStep}><Plus className="w-3.5 h-3.5 mr-1" />Add Step</Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {form.steps.map((s, i) => (
                        <Badge key={i} className="bg-green-100 text-green-700">Step {i + 1}: {s.role}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={createChain}>Create Chain</Button>
                    <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {chains.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-gray-400">
                <Layers className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No approval chains. Create one above.</p>
              </CardContent></Card>
            ) : (
              chains.map(chain => (
                <Card key={chain.id}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <Badge className={`text-xs ${ENTITY_COLORS[chain.entityType] || ''}`}>{chain.entityType}</Badge>
                      <p className="font-semibold text-gray-900">{chain.name}</p>
                      {chain.description && <p className="text-xs text-gray-400">{chain.description}</p>}
                      <Badge className="text-xs bg-gray-100 text-gray-500 ml-auto">{chain._count?.requests || 0} requests</Badge>
                      <Badge className={`text-xs ${chain.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {chain.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    {Array.isArray(chain.steps) && chain.steps.length > 0 && (
                      <div className="flex items-center gap-1 mt-2 flex-wrap">
                        {chain.steps.map((s: any, i: number) => (
                          <div key={i} className="flex items-center gap-1">
                            <Badge className="text-xs bg-blue-50 text-blue-700">
                              <User className="w-2.5 h-2.5 mr-1" />Step {s.order + 1}: {s.role}
                            </Badge>
                            {i < chain.steps.length - 1 && <ArrowRight className="w-3 h-3 text-gray-300" />}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
