// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  ArrowLeftRight, Clock, CheckCircle, AlertTriangle, Search,
  Plus, RotateCcw, Package, User, Calendar, MapPin, RefreshCw
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const STATUS_COLORS: Record<string, string> = {
  BORROWED: 'bg-blue-100 text-blue-700 border-blue-200',
  RETURNED: 'bg-green-100 text-green-700 border-green-200',
  OVERDUE:  'bg-red-100 text-red-700 border-red-200',
  CANCELLED:'bg-gray-100 text-gray-500 border-gray-200',
};

const STATUS_ICONS: Record<string, any> = {
  BORROWED: Clock,
  RETURNED: CheckCircle,
  OVERDUE:  AlertTriangle,
};

export default function BorrowingPage() {
  const { toast } = useToast();
  const [borrows, setBorrows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [returning, setReturning] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [stats, setStats] = useState({ total: 0, borrowed: 0, overdue: 0, returned: 0 });

  const fetchBorrows = async () => {
    setLoading(true);
    const res = await fetch('/api/borrowing').then(r => r.json()).catch(() => []);
    const list = Array.isArray(res) ? res : [];
    setBorrows(list);
    setStats({
      total: list.length,
      borrowed: list.filter((b: any) => b.status === 'BORROWED').length,
      overdue: list.filter((b: any) => b.status === 'OVERDUE').length,
      returned: list.filter((b: any) => b.status === 'RETURNED').length,
    });
    setLoading(false);
  };

  useEffect(() => { fetchBorrows(); }, []);

  const processReturn = async (borrowId: string, assetName: string) => {
    if (!confirm(`Confirm return of "${assetName}"?`)) return;
    setReturning(borrowId);
    const res = await fetch(`/api/borrowing/${borrowId}/return`, { method: 'POST' });
    setReturning(null);
    if (res.ok) {
      toast({ title: 'Asset returned successfully', description: `${assetName} status changed to RETURNED` });
      fetchBorrows();
    } else {
      toast({ variant: 'destructive', title: 'Return failed' });
    }
  };

  const filtered = borrows.filter(b => {
    const matchFilter = filter === 'all' || b.status === filter.toUpperCase();
    const matchSearch = !search || 
      b.asset?.name?.toLowerCase().includes(search.toLowerCase()) ||
      b.borrowedBy?.email?.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const isOverdue = (b: any) => b.status === 'BORROWED' && new Date(b.expectedReturnAt) < new Date();

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
              <ArrowLeftRight className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Asset Borrowing & Return</h1>
              <p className="text-sm text-gray-500">Track borrowed assets, expected returns, and overdue items</p>
            </div>
          </div>
          <Button onClick={fetchBorrows} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />Refresh
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Borrows', value: stats.total, icon: Package, color: 'text-gray-600', bg: 'bg-gray-50' },
            { label: 'Currently Borrowed', value: stats.borrowed, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Overdue', value: stats.overdue, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
            { label: 'Returned', value: stats.returned, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <Card key={label} className={`${bg} border-0`}>
              <CardContent className="pt-4 pb-3">
                <Icon className={`w-5 h-5 ${color} mb-2`} />
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-gray-500 mt-1">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input className="pl-9" placeholder="Search asset or borrower..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2">
            {['all', 'borrowed', 'overdue', 'returned'].map(f => (
              <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'}
                onClick={() => setFilter(f)} className="capitalize">{f}</Button>
            ))}
          </div>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-16 text-center text-gray-400">Loading borrow records...</div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center text-gray-400">
                <ArrowLeftRight className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No borrow records found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      {['Asset', 'Borrower', 'Borrowed On', 'Expected Return', 'Location', 'Status', 'Actions'].map(h => (
                        <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(b => {
                      const overdue = isOverdue(b);
                      const StatusIcon = STATUS_ICONS[overdue ? 'OVERDUE' : b.status] || Clock;
                      return (
                        <tr key={b.id} className={`border-b last:border-0 hover:bg-gray-50 ${overdue ? 'bg-red-50/40' : ''}`}>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                                <Package className="w-3.5 h-3.5 text-blue-600" />
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900">{b.asset?.name || 'N/A'}</p>
                                <p className="text-xs text-gray-400">{b.asset?.assetId}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                              <span className="text-gray-700">{b.borrowedBy?.email || 'N/A'}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1 text-gray-600">
                              <Calendar className="w-3.5 h-3.5 text-gray-400" />
                              {new Date(b.borrowedAt).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`font-medium ${overdue ? 'text-red-600' : 'text-gray-700'}`}>
                              {new Date(b.expectedReturnAt).toLocaleDateString()}
                              {overdue && <span className="ml-1 text-xs">(OVERDUE)</span>}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1 text-gray-500 text-xs">
                              <MapPin className="w-3 h-3" />
                              {b.borrowLocation || '—'}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <Badge className={`border ${STATUS_COLORS[overdue ? 'OVERDUE' : b.status] || ''} flex items-center gap-1 w-fit`}>
                              <StatusIcon className="w-3 h-3" />
                              {overdue ? 'OVERDUE' : b.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            {b.status === 'BORROWED' && (
                              <Button size="sm" variant="outline"
                                className="text-green-700 border-green-300 hover:bg-green-50"
                                disabled={returning === b.id}
                                onClick={() => processReturn(b.id, b.asset?.name)}>
                                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                                {returning === b.id ? 'Returning...' : 'Return'}
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
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

