// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Wrench, Plus, AlertTriangle, Package, Search, Trash2, RefreshCw } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function SparePartsPage() {
  const { toast } = useToast();
  const [parts, setParts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: '', partNumber: '', quantity: 0, unitCost: 0, reorderLevel: 5, unit: 'pcs', location: '' });

  const fetch_ = async () => {
    setLoading(true);
    const res = await fetch(`/api/spare-parts${search ? `?search=${search}` : ''}`).then(r => r.json()).catch(() => []);
    setParts(Array.isArray(res) ? res : []);
    setLoading(false);
  };

  useEffect(() => { fetch_(); }, []);

  const create = async () => {
    if (!form.name) { toast({ variant: 'destructive', title: 'Name required' }); return; }
    const res = await fetch('/api/spare-parts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    if (res.ok) { toast({ title: 'Spare part added' }); setShowNew(false); setForm({ name: '', partNumber: '', quantity: 0, unitCost: 0, reorderLevel: 5, unit: 'pcs', location: '' }); fetch_(); }
    else toast({ variant: 'destructive', title: 'Failed' });
  };

  const isLowStock = (p: any) => p.quantity <= p.reorderLevel;
  const lowCount = parts.filter(isLowStock).length;

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-600 flex items-center justify-center">
              <Wrench className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Spare Parts Inventory</h1>
              <p className="text-sm text-gray-500">Track parts, reorder levels, and usage per ticket</p>
            </div>
          </div>
          <Button onClick={() => setShowNew(p => !p)} size="sm"><Plus className="w-4 h-4 mr-2" />Add Part</Button>
        </div>

        {lowCount > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-700"><strong>{lowCount} spare part(s)</strong> are at or below reorder level. Check and reorder.</p>
          </div>
        )}

        {showNew && (
          <Card className="border-amber-200">
            <CardHeader><CardTitle className="text-sm">Add Spare Part</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div><label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Name</label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Part name" /></div>
                <div><label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Part Number</label><Input value={form.partNumber} onChange={e => setForm(f => ({ ...f, partNumber: e.target.value }))} placeholder="PN-001" /></div>
                <div><label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Location</label><Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Shelf A2" /></div>
                <div><label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Quantity</label><Input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: Number(e.target.value) }))} /></div>
                <div><label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Reorder Level</label><Input type="number" value={form.reorderLevel} onChange={e => setForm(f => ({ ...f, reorderLevel: Number(e.target.value) }))} /></div>
                <div><label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Unit Cost ($)</label><Input type="number" step="0.01" value={form.unitCost} onChange={e => setForm(f => ({ ...f, unitCost: Number(e.target.value) }))} /></div>
              </div>
              <div className="flex gap-2">
                <Button onClick={create}>Save Part</Button>
                <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input className="pl-9" placeholder="Search parts..." value={search}
              onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetch_()} />
          </div>
          <Button variant="outline" size="sm" onClick={fetch_}><RefreshCw className="w-4 h-4" /></Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? <div className="py-12 text-center text-gray-400">Loading...</div> :
            parts.length === 0 ? (
              <div className="py-12 text-center text-gray-400">
                <Wrench className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No spare parts yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-gray-50">
                    {['Name', 'Part #', 'Qty', 'Reorder', 'Unit Cost', 'Location', 'Usages', 'Status'].map(h => (
                      <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {parts.map(p => (
                      <tr key={p.id} className={`border-b last:border-0 hover:bg-gray-50 ${isLowStock(p) ? 'bg-amber-50/40' : ''}`}>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Wrench className="w-3.5 h-3.5 text-gray-400" />
                            <p className="font-medium text-gray-900">{p.name}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-gray-500">{p.partNumber || '—'}</td>
                        <td className="py-3 px-4 font-bold">{p.quantity} {p.unit}</td>
                        <td className="py-3 px-4 text-gray-500">{p.reorderLevel} {p.unit}</td>
                        <td className="py-3 px-4 text-gray-600">${p.unitCost.toFixed(2)}</td>
                        <td className="py-3 px-4 text-gray-500 text-xs">{p.location || '—'}</td>
                        <td className="py-3 px-4 text-gray-500">{p._count?.usages || 0}</td>
                        <td className="py-3 px-4">
                          {isLowStock(p) ? (
                            <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-200">
                              <AlertTriangle className="w-3 h-3 mr-1" />Low Stock
                            </Badge>
                          ) : <Badge className="text-xs bg-green-100 text-green-700">In Stock</Badge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

