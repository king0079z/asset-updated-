// @ts-nocheck
import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  MapPin,
  Package,
  FileText,
  Loader2,
  ExternalLink,
  ClipboardList,
} from 'lucide-react';

type MissingReport = {
  id: string;
  timestamp: string;
  floorNumber: string | null;
  roomNumber: string | null;
  missingCount: number;
  totalScanned: number;
  totalInSystem: number;
  submittedByName: string | null;
  submittedAt: string | null;
  missingItems: Array<{ id: string; name?: string; barcode?: string; floorNumber?: string; roomNumber?: string }>;
};

export default function MissingInventoryReportPage() {
  const [reports, setReports] = useState<MissingReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/inventory/missing-reports', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        setReports(Array.isArray(data) ? data : []);
      })
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardLayout>
      <Head>
        <title>Missing inventory reports</title>
        <meta name="description" content="Reports of assets missing from handheld inventory counts" />
      </Head>
      <div className="container max-w-4xl mx-auto py-6 px-4">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-12 w-12 rounded-2xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
            <ClipboardList className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Missing inventory reports</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Items expected in a room but not scanned. No move was recorded for these assets.
            </p>
          </div>
        </div>

        {loading ? (
          <Card className="border-slate-200 dark:border-slate-700">
            <CardContent className="flex items-center justify-center py-16">
              <Loader2 className="h-10 w-10 animate-spin text-violet-500" />
            </CardContent>
          </Card>
        ) : reports.length === 0 ? (
          <Card className="border-slate-200 dark:border-slate-700">
            <CardContent className="py-16 text-center">
              <FileText className="h-14 w-14 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">No missing-item reports</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-sm mx-auto">
                When a handheld inventory reconciliation is submitted with missing items, it will appear here.
              </p>
              <Button asChild variant="outline" className="mt-6 rounded-xl">
                <Link href="/dashboard">Back to dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => {
              const isExpanded = expandedId === report.id;
              const loc = [report.floorNumber, report.roomNumber].filter(Boolean).join(', ') || '—';
              return (
                <Card
                  key={report.id}
                  className="overflow-hidden border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50/80 to-white dark:from-amber-950/20 dark:to-slate-800"
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-amber-500 flex items-center justify-center shrink-0">
                          <AlertCircle className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            Floor {report.floorNumber ?? '—'}, Room {report.roomNumber ?? '—'}
                            <Badge variant="secondary" className="bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100">
                              {report.missingCount} missing
                            </Badge>
                          </CardTitle>
                          <CardDescription className="text-xs mt-1 flex items-center gap-2 flex-wrap">
                            <span>{new Date(report.timestamp).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                            {report.submittedByName && <span>· {report.submittedByName}</span>}
                            <span>· Scanned {report.totalScanned}, system expected {report.totalInSystem}</span>
                          </CardDescription>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-xl shrink-0"
                        onClick={() => setExpandedId(isExpanded ? null : report.id)}
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        {isExpanded ? 'Hide' : 'View'} items
                      </Button>
                    </div>
                  </CardHeader>
                  {isExpanded && (
                    <CardContent className="pt-0 pb-4">
                      <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-800/80 overflow-hidden">
                        <div className="px-4 py-2 bg-amber-100/80 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800">
                          <p className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200">
                            Missing items (expected in this room but not scanned)
                          </p>
                        </div>
                        <ul className="divide-y divide-slate-200 dark:divide-slate-700 max-h-80 overflow-y-auto">
                          {report.missingItems.map((item) => (
                            <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
                              <div className="min-w-0 flex-1 flex items-center gap-3">
                                <Package className="h-5 w-5 text-slate-400 shrink-0" />
                                <div className="min-w-0">
                                  <p className="font-medium text-slate-900 dark:text-white truncate">{item.name || item.barcode || item.id}</p>
                                  {item.barcode && item.barcode !== item.name && (
                                    <p className="text-xs text-slate-500 font-mono">{item.barcode}</p>
                                  )}
                                  {(item.floorNumber != null || item.roomNumber != null) && (
                                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                      <MapPin className="h-3 w-3" /> {[item.floorNumber, item.roomNumber].filter(Boolean).join(', ')}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <Button asChild variant="outline" size="sm" className="rounded-lg shrink-0">
                                <Link href={`/assets/${item.id}`} className="gap-1">
                                  <ExternalLink className="h-3.5 w-3.5" /> View asset
                                </Link>
                              </Button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
