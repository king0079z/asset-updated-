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
  CheckCircle2,
  Radio,
} from 'lucide-react';

type MissingReport = {
  id: string;
  timestamp: string;
  floorNumber: string | null;
  roomNumber: string | null;
  missingCount: number;
  wrongLocationCount?: number;
  extraCount?: number;
  totalScanned: number;
  totalInSystem: number;
  submittedByName: string | null;
  submittedAt: string | null;
  missingItems: Array<{ id: string; name?: string; barcode?: string; floorNumber?: string; roomNumber?: string }>;
  wrongLocationItems?: Array<{ id: string; name?: string; systemFloor?: string; systemRoom?: string }>;
  correctInRoomItems?: Array<{ id: string; name?: string; barcode?: string; floorNumber?: string; roomNumber?: string }>;
  extraItems?: Array<{ id: string; name?: string; barcode?: string; floorNumber?: string; roomNumber?: string }>;
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
        <title>Inventory reconciliation reports</title>
        <meta name="description" content="Handheld RFID inventory reports: missing, verified, wrong-room, unknown" />
      </Head>
      <div className="container max-w-4xl mx-auto py-6 px-4">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-12 w-12 rounded-2xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
            <ClipboardList className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Inventory reconciliation reports</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Full inventory reconciliation reports: missing, verified in room, wrong-room scans, and unknown tags.
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
                When a handheld inventory report is submitted, it will appear here with all sections.
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
                          <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                            Floor {report.floorNumber ?? '—'}, Room {report.roomNumber ?? '—'}
                            {report.missingCount > 0 && (
                              <Badge variant="secondary" className="bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100">
                                {report.missingCount} missing
                              </Badge>
                            )}
                            {(report.wrongLocationItems?.length ?? report.wrongLocationCount ?? 0) > 0 && (
                              <Badge variant="secondary" className="bg-orange-200 dark:bg-orange-900 text-orange-900 dark:text-orange-100">
                                {report.wrongLocationItems?.length ?? report.wrongLocationCount} wrong room
                              </Badge>
                            )}
                            {(report.correctInRoomItems?.length ?? 0) > 0 && (
                              <Badge variant="secondary" className="bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100">
                                {report.correctInRoomItems?.length} in room
                              </Badge>
                            )}
                            {(report.extraItems?.length ?? report.extraCount ?? 0) > 0 && (
                              <Badge variant="secondary" className="bg-red-200 dark:bg-red-900 text-red-900 dark:text-red-100">
                                {report.extraItems?.length ?? report.extraCount} unknown
                              </Badge>
                            )}
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
                    <CardContent className="pt-0 pb-4 space-y-4">
                      {report.missingItems.length > 0 && (
                      <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-800/80 overflow-hidden">
                        <div className="px-4 py-2 bg-amber-100/80 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800">
                          <p className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200">
                            Missing (expected in count room, not scanned)
                          </p>
                        </div>
                        <ul className="divide-y divide-slate-200 dark:divide-slate-700 max-h-64 overflow-y-auto">
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
                      )}

                      {(report.correctInRoomItems?.length ?? 0) > 0 && (
                      <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-800/80 overflow-hidden">
                        <div className="px-4 py-2 bg-emerald-100/80 dark:bg-emerald-900/30 border-b border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                          <p className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-200">
                            Scanned & registered in this room ({report.correctInRoomItems?.length})
                          </p>
                        </div>
                        <ul className="divide-y divide-slate-200 dark:divide-slate-700 max-h-64 overflow-y-auto">
                          {(report.correctInRoomItems || []).map((item) => (
                            <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
                              <div className="min-w-0 flex-1 flex items-center gap-3">
                                <Radio className="h-5 w-5 text-emerald-500 shrink-0" />
                                <div className="min-w-0">
                                  <p className="font-medium text-slate-900 dark:text-white truncate">{item.name || item.barcode || item.id}</p>
                                  {item.barcode && item.barcode !== item.name && (
                                    <p className="text-xs text-slate-500 font-mono">{item.barcode}</p>
                                  )}
                                </div>
                              </div>
                              <Button asChild variant="outline" size="sm" className="rounded-lg shrink-0">
                                <Link href={`/assets/${item.id}`} className="gap-1">
                                  <ExternalLink className="h-3.5 w-3.5" /> View
                                </Link>
                              </Button>
                            </li>
                          ))}
                        </ul>
                      </div>
                      )}

                      {(report.wrongLocationItems?.length ?? 0) > 0 && (
                      <div className="rounded-xl border-2 border-orange-300 dark:border-orange-700 bg-gradient-to-br from-orange-50/90 to-white dark:from-orange-950/30 dark:to-slate-800/80 overflow-hidden">
                        <div className="px-4 py-2 bg-orange-100/90 dark:bg-orange-900/40 border-b border-orange-200 dark:border-orange-800">
                          <p className="text-xs font-bold uppercase tracking-wider text-orange-900 dark:text-orange-100">
                            Scanned at count · registered elsewhere ({report.wrongLocationItems?.length})
                          </p>
                        </div>
                        <ul className="divide-y divide-orange-100 dark:divide-orange-900/50 max-h-72 overflow-y-auto">
                          {(report.wrongLocationItems || []).map((item) => (
                            <li key={item.id} className="px-4 py-3 space-y-2">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-900 dark:text-white">{item.name || item.id}</p>
                                  <div className="mt-2 rounded-lg bg-white/90 dark:bg-slate-900/60 border border-orange-200 dark:border-orange-800 px-3 py-2">
                                    <p className="text-[11px] font-bold text-orange-900 dark:text-orange-100 uppercase tracking-wide">Registered location</p>
                                    <p className="text-sm text-orange-950 dark:text-orange-50 mt-0.5 flex items-center gap-1">
                                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                                      Floor {item.systemFloor ?? '—'}, Room {item.systemRoom ?? '—'}
                                    </p>
                                  </div>
                                </div>
                                <Button asChild variant="outline" size="sm" className="rounded-lg shrink-0 border-orange-400">
                                  <Link href={`/assets/${item.id}`} className="gap-1">
                                    <ExternalLink className="h-3.5 w-3.5" /> Asset
                                  </Link>
                                </Button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                      )}

                      {(report.extraItems?.length ?? 0) > 0 && (
                      <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20 overflow-hidden">
                        <div className="px-4 py-2 bg-red-100/80 dark:bg-red-900/40 border-b border-red-200 dark:border-red-800">
                          <p className="text-xs font-bold uppercase tracking-wider text-red-900 dark:text-red-100">
                            Not in system ({report.extraItems?.length})
                          </p>
                        </div>
                        <ul className="divide-y divide-red-100 dark:divide-red-900/40 max-h-48 overflow-y-auto">
                          {(report.extraItems || []).map((item) => (
                            <li key={item.id} className="px-4 py-2.5 text-sm font-medium text-red-950 dark:text-red-100">
                              {item.name || item.barcode || item.id}
                            </li>
                          ))}
                        </ul>
                      </div>
                      )}
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
