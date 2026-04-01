// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, AlertTriangle, CheckCircle, Clock, BarChart2, RefreshCw, Zap } from 'lucide-react';
import * as XLSX from 'xlsx';

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-blue-100 text-blue-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
};

export default function SLACompliancePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const fetch_ = async () => {
    setLoading(true);
    const res = await fetch(`/api/sla/compliance?days=${days}`).then(r => r.json()).catch(() => null);
    setData(res);
    setLoading(false);
  };

  useEffect(() => { fetch_(); }, [days]);

  const exportReport = () => {
    if (!data) return;
    const wb = XLSX.utils.book_new();

    const summaryData = [
      ['SLA Compliance Report'],
      [`Period: Last ${days} days`],
      [''],
      ['Metric', 'Value'],
      ['Total Tickets', data.summary.total],
      ['SLA Breached', data.summary.breached],
      ['Escalated', data.summary.escalated],
      ['Resolved', data.summary.resolved],
      ['Compliance Rate', `${data.summary.complianceRate}%`],
      ['Avg Resolution Time', data.summary.avgResolutionHours ? `${data.summary.avgResolutionHours}h` : 'N/A'],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), 'Summary');

    if (data.byCategory?.length) {
      const catData = [['Category', 'Total', 'Breached', 'Compliance %'], ...data.byCategory.map((c: any) => [c.category, c.total, c.breached, c.complianceRate])];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(catData), 'By Category');
    }

    XLSX.writeFile(wb, `sla_compliance_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const getComplianceColor = (rate: number) =>
    rate >= 95 ? 'text-green-600' : rate >= 80 ? 'text-yellow-600' : 'text-red-600';

  const getComplianceBg = (rate: number) =>
    rate >= 95 ? 'bg-green-500' : rate >= 80 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">SLA Compliance Dashboard</h1>
              <p className="text-sm text-gray-500">Monitor SLA performance, breaches, and escalations</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-2">
              {[7, 30, 90].map(d => (
                <Button key={d} size="sm" variant={days === d ? 'default' : 'outline'} onClick={() => setDays(d)}>
                  {d}d
                </Button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={fetch_}><RefreshCw className="w-4 h-4" /></Button>
            <Button variant="outline" size="sm" onClick={exportReport}>Export</Button>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-gray-400">Loading compliance data...</div>
        ) : !data ? (
          <div className="py-20 text-center text-gray-400">Failed to load data.</div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { label: 'Total Tickets', value: data.summary.total, icon: BarChart2, color: 'text-gray-700' },
                { label: 'SLA Compliant', value: data.summary.total - data.summary.breached, icon: CheckCircle, color: 'text-green-600' },
                { label: 'SLA Breached', value: data.summary.breached, icon: AlertTriangle, color: 'text-red-600' },
                { label: 'Escalated', value: data.summary.escalated, icon: Zap, color: 'text-orange-600' },
                { label: 'Resolved', value: data.summary.resolved, icon: CheckCircle, color: 'text-blue-600' },
                { label: 'Avg Resolution', value: data.summary.avgResolutionHours ? `${data.summary.avgResolutionHours}h` : 'N/A', icon: Clock, color: 'text-purple-600' },
              ].map(({ label, value, icon: Icon, color }) => (
                <Card key={label} className="text-center py-4">
                  <Icon className={`w-5 h-5 mx-auto mb-1 ${color}`} />
                  <p className={`text-xl font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-gray-500 mt-1">{label}</p>
                </Card>
              ))}
            </div>

            {/* Overall Compliance Rate */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Overall SLA Compliance Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="text-5xl font-black">
                    <span className={getComplianceColor(data.summary.complianceRate)}>{data.summary.complianceRate}%</span>
                  </div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${getComplianceBg(data.summary.complianceRate)}`}
                        style={{ width: `${data.summary.complianceRate}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>0%</span>
                      <span className="text-green-600 font-semibold">Target: ≥95%</span>
                      <span>100%</span>
                    </div>
                  </div>
                  <Badge className={`text-sm px-3 py-1 ${data.summary.complianceRate >= 95 ? 'bg-green-100 text-green-700' : data.summary.complianceRate >= 80 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                    {data.summary.complianceRate >= 95 ? 'Excellent' : data.summary.complianceRate >= 80 ? 'Needs Attention' : 'Critical'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* By Category */}
            {data.byCategory?.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">SLA Compliance by Category</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {data.byCategory.sort((a: any, b: any) => a.complianceRate - b.complianceRate).map((cat: any) => (
                    <div key={cat.category}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">{cat.category || 'Uncategorized'}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">{cat.total} tickets · {cat.breached} breached</span>
                          <span className={`text-sm font-bold ${getComplianceColor(cat.complianceRate)}`}>{cat.complianceRate}%</span>
                        </div>
                      </div>
                      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${getComplianceBg(cat.complianceRate)}`}
                          style={{ width: `${cat.complianceRate}%` }} />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* By Priority */}
            {data.byPriority?.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">SLA Compliance by Priority</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {data.byPriority.map((p: any) => (
                      <div key={p.priority} className="text-center p-4 bg-gray-50 rounded-xl">
                        <Badge className={`text-xs mb-2 ${PRIORITY_COLORS[p.priority] || 'bg-gray-100 text-gray-600'}`}>{p.priority}</Badge>
                        <p className={`text-3xl font-black ${getComplianceColor(p.complianceRate)}`}>{p.complianceRate}%</p>
                        <p className="text-xs text-gray-400 mt-1">{p.total} tickets · {p.breached} breached</p>
                        <div className="h-1.5 bg-gray-200 rounded-full mt-2 overflow-hidden">
                          <div className={`h-full rounded-full ${getComplianceBg(p.complianceRate)}`} style={{ width: `${p.complianceRate}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

