// @ts-nocheck
/**
 * DiagnosticsPanel — real-time performance & error monitor.
 *
 * What it captures:
 *  • Every fetch() call — URL, method, status, duration, "backend" vs "frontend"
 *  • Page navigation times (Next.js router events)
 *  • console.error / console.warn messages
 *  • window.onerror / unhandledrejection
 *  • React error-boundary crashes
 *
 * Toggle: floating button bottom-right corner  ·  Shift+Alt+D keyboard shortcut
 * Export: "Copy Report" button generates a full JSON diagnostic report.
 */
import React, {
  useState, useEffect, useRef, useCallback, Component, ReactNode,
} from 'react';
import { useRouter } from 'next/router';
import {
  Activity, AlertCircle, AlertTriangle, CheckCircle2, ChevronDown,
  ChevronUp, Clock, Copy, ExternalLink, Gauge, RefreshCw, Server,
  Trash2, Wifi, X, Zap, Info,
} from 'lucide-react';

// ─── Persistent in-module store (survives SPA page changes) ──────────────────
export interface ApiEntry {
  id: string;
  url: string;
  method: string;
  status: number | null;
  duration: number | null;
  ts: number;
  ok: boolean;
  error?: string;
  isInternal: boolean; // true = /api/… call (backend), false = external
  tag: 'fast' | 'slow' | 'critical' | 'error';
}

export interface ErrorEntry {
  id: string;
  type: 'js' | 'promise' | 'console' | 'react';
  message: string;
  stack?: string;
  url?: string;
  ts: number;
}

export interface NavEntry {
  id: string;
  from: string;
  to: string;
  duration: number;
  ts: number;
}

interface Store {
  apiCalls: ApiEntry[];
  errors: ErrorEntry[];
  navs: NavEntry[];
  listeners: Set<() => void>;
}

const store: Store = { apiCalls: [], errors: [], navs: [], listeners: new Set() };

const notify = () => store.listeners.forEach(fn => fn());

const addApi = (entry: ApiEntry) => {
  store.apiCalls = [entry, ...store.apiCalls].slice(0, 200);
  notify();
};
const addError = (entry: ErrorEntry) => {
  store.errors = [entry, ...store.errors].slice(0, 100);
  notify();
};
const addNav = (entry: NavEntry) => {
  store.navs = [entry, ...store.navs].slice(0, 50);
  notify();
};

let interceptInstalled = false;
let errorListenersInstalled = false;

// ─── Tag an API call by duration ─────────────────────────────────────────────
const tagByDuration = (ms: number | null, ok: boolean): ApiEntry['tag'] => {
  if (!ok) return 'error';
  if (ms === null) return 'error';
  if (ms < 400) return 'fast';
  if (ms < 1500) return 'slow';
  return 'critical';
};

// ─── Install fetch interceptor once (module-level guard) ─────────────────────
function installFetchInterceptor() {
  if (interceptInstalled || typeof window === 'undefined') return;
  interceptInstalled = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
    const url = typeof input === 'string' ? input
      : input instanceof URL ? input.href
      : (input as Request).url;
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
    const ts = Date.now();

    const entry: ApiEntry = {
      id: `${ts}-${Math.random().toString(36).slice(2, 7)}`,
      url,
      method: method.toUpperCase(),
      status: null,
      duration: null,
      ts,
      ok: false,
      isInternal: url.startsWith('/api/') || url.includes(window.location.host + '/api/'),
      tag: 'fast',
    };

    try {
      const res = await originalFetch(input, init);
      const duration = Date.now() - ts;
      entry.status = res.status;
      entry.duration = duration;
      entry.ok = res.ok;
      entry.tag = tagByDuration(duration, res.ok);
      addApi({ ...entry });
      return res;
    } catch (err: any) {
      const duration = Date.now() - ts;
      entry.duration = duration;
      entry.ok = false;
      entry.tag = 'error';
      entry.error = err?.message ?? String(err);
      addApi({ ...entry });
      throw err;
    }
  } as typeof window.fetch;
}

// ─── Install error listeners once ────────────────────────────────────────────
function installErrorListeners() {
  if (errorListenersInstalled || typeof window === 'undefined') return;
  errorListenersInstalled = true;

  window.addEventListener('error', (e) => {
    addError({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'js',
      message: e.message || 'Unknown JS error',
      stack: e.error?.stack,
      url: e.filename,
      ts: Date.now(),
    });
  });

  window.addEventListener('unhandledrejection', (e) => {
    addError({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'promise',
      message: e.reason?.message ?? String(e.reason ?? 'Unhandled promise rejection'),
      stack: e.reason?.stack,
      ts: Date.now(),
    });
  });

  // Patch console.error — suppress known-handled Supabase auth noise
  const IGNORED_PATTERNS = [
    'refresh_token_not_found',
    'AuthApiError',
    'Refresh Token Not Found',
    'Invalid Refresh Token',
    'supabase.co',           // raw Supabase network errors (handled by AuthContext)
    '__isAuthError',
  ];
  const origError = console.error.bind(console);
  console.error = (...args: any[]) => {
    origError(...args);
    const msg = args.map(a => {
      try { return typeof a === 'object' ? JSON.stringify(a) : String(a); } catch { return String(a); }
    }).join(' ');
    // Skip errors that are already handled elsewhere
    if (IGNORED_PATTERNS.some(p => msg.includes(p))) return;
    addError({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'console',
      message: msg.slice(0, 500),
      ts: Date.now(),
    });
  };
}

// ─── React Error Boundary ─────────────────────────────────────────────────────
class DiagErrorBoundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { crashed: false };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    addError({
      id: `${Date.now()}-react`,
      type: 'react',
      message: error.message,
      stack: (error.stack ?? '') + '\n\nComponent Stack:\n' + info.componentStack,
      ts: Date.now(),
    });
  }
  render() { return this.props.children; }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (ms: number | null) =>
  ms === null ? '—' : ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;

const relTime = (ts: number) => {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
};

const truncate = (s: string, n = 60) => s.length > n ? s.slice(0, n) + '…' : s;

const TAG_STYLES: Record<ApiEntry['tag'], string> = {
  fast:     'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30',
  slow:     'bg-amber-500/10  text-amber-400  border border-amber-500/30',
  critical: 'bg-orange-500/10 text-orange-400 border border-orange-500/30',
  error:    'bg-red-500/10    text-red-400    border border-red-500/30',
};
const TAG_LABEL: Record<ApiEntry['tag'], string> = {
  fast: '< 400ms', slow: '< 1.5s', critical: '> 1.5s', error: 'FAIL',
};

const ERR_ICON: Record<ErrorEntry['type'], React.ReactNode> = {
  js:      <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />,
  promise: <AlertTriangle className="h-3.5 w-3.5 text-orange-400 shrink-0" />,
  console: <Info className="h-3.5 w-3.5 text-amber-400 shrink-0" />,
  react:   <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />,
};

// ─── Health score (0-100) ─────────────────────────────────────────────────────
function calcHealth(apis: ApiEntry[], errors: ErrorEntry[]) {
  if (apis.length === 0 && errors.length === 0) return 100;
  const errorPenalty = Math.min(errors.length * 8, 40);
  const criticalApis = apis.filter(a => a.tag === 'critical').length;
  const failedApis   = apis.filter(a => a.tag === 'error').length;
  const slowApis     = apis.filter(a => a.tag === 'slow').length;
  const apiPenalty   = Math.min(failedApis * 10 + criticalApis * 6 + slowApis * 2, 50);
  return Math.max(0, 100 - errorPenalty - apiPenalty);
}

const scoreColor = (s: number) =>
  s >= 80 ? 'text-emerald-400' : s >= 50 ? 'text-amber-400' : 'text-red-400';
const scoreBg    = (s: number) =>
  s >= 80 ? 'from-emerald-500' : s >= 50 ? 'from-amber-500' : 'from-red-500';

// ─── Main component ───────────────────────────────────────────────────────────
export function DiagnosticsPanel() {
  const router = useRouter();
  const [open, setOpen]       = useState(false);
  const [tab, setTab]         = useState<'api' | 'errors' | 'nav' | 'report'>('api');
  const [, rerender]          = useState(0);
  const navStartRef           = useRef<{ path: string; ts: number } | null>(null);
  const [copied, setCopied]   = useState(false);
  const [filterTag, setFilterTag] = useState<ApiEntry['tag'] | 'all'>('all');

  // Subscribe to store changes
  useEffect(() => {
    const handler = () => rerender(n => n + 1);
    store.listeners.add(handler);
    return () => { store.listeners.delete(handler); };
  }, []);

  // Install interceptors once
  useEffect(() => {
    installFetchInterceptor();
    installErrorListeners();
  }, []);

  // Track page navigation times
  useEffect(() => {
    const onStart = (url: string) => {
      navStartRef.current = { path: url, ts: Date.now() };
    };
    const onComplete = (url: string) => {
      if (navStartRef.current) {
        const duration = Date.now() - navStartRef.current.ts;
        addNav({
          id: `${Date.now()}`,
          from: navStartRef.current.path,
          to: url,
          duration,
          ts: Date.now(),
        });
        navStartRef.current = null;
      }
    };
    router.events.on('routeChangeStart',    onStart);
    router.events.on('routeChangeComplete', onComplete);
    router.events.on('routeChangeError',    () => { navStartRef.current = null; });
    return () => {
      router.events.off('routeChangeStart',    onStart);
      router.events.off('routeChangeComplete', onComplete);
    };
  }, [router]);

  // Keyboard shortcut: Shift+Alt+D
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.shiftKey && e.altKey && e.key === 'D') setOpen(o => !o);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const clearAll = useCallback(() => {
    store.apiCalls = [];
    store.errors = [];
    store.navs = [];
    rerender(n => n + 1);
  }, []);

  const copyReport = useCallback(() => {
    const health = calcHealth(store.apiCalls, store.errors);
    const slowApis = store.apiCalls.filter(a => a.tag === 'slow' || a.tag === 'critical' || a.tag === 'error');
    const report = {
      generatedAt: new Date().toISOString(),
      page: router.pathname,
      healthScore: health,
      summary: {
        totalApiCalls: store.apiCalls.length,
        failedApiCalls: store.apiCalls.filter(a => a.tag === 'error').length,
        slowApiCalls: store.apiCalls.filter(a => a.tag === 'slow' || a.tag === 'critical').length,
        avgResponseMs: store.apiCalls.length
          ? Math.round(store.apiCalls.reduce((s, a) => s + (a.duration ?? 0), 0) / store.apiCalls.length)
          : 0,
        totalErrors: store.errors.length,
        totalNavigations: store.navs.length,
        avgNavMs: store.navs.length
          ? Math.round(store.navs.reduce((s, n) => s + n.duration, 0) / store.navs.length)
          : 0,
      },
      problematicApis: slowApis.map(a => ({
        url: a.url, method: a.method, status: a.status,
        duration: a.duration, tag: a.tag, error: a.error,
        isBackend: a.isInternal,
        timestamp: new Date(a.ts).toISOString(),
      })),
      allApiCalls: store.apiCalls.map(a => ({
        url: a.url, method: a.method, status: a.status,
        duration: a.duration, tag: a.tag, isBackend: a.isInternal,
        timestamp: new Date(a.ts).toISOString(),
      })),
      errors: store.errors.map(e => ({
        type: e.type, message: e.message,
        stack: e.stack?.slice(0, 500),
        url: e.url, timestamp: new Date(e.ts).toISOString(),
      })),
      pageNavigations: store.navs.map(n => ({
        from: n.from, to: n.to, duration: n.duration,
        timestamp: new Date(n.ts).toISOString(),
      })),
    };
    navigator.clipboard.writeText(JSON.stringify(report, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [router]);

  const apis    = store.apiCalls;
  const errors  = store.errors;
  const navs    = store.navs;
  const health  = calcHealth(apis, errors);
  const errCount = errors.length;
  const failCount = apis.filter(a => a.tag === 'error').length;
  const badge   = errCount + failCount;

  const filteredApis = filterTag === 'all' ? apis : apis.filter(a => a.tag === filterTag);

  return (
    <>
      {/* ── Floating toggle button ── */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Diagnostics Panel (Shift+Alt+D)"
        className="fixed bottom-4 left-4 z-[9999] flex items-center gap-2 rounded-full px-3.5 py-2.5
          bg-slate-900 border border-slate-700 shadow-2xl hover:bg-slate-800 transition-all duration-200
          text-slate-200 text-xs font-semibold select-none"
        style={{ backdropFilter: 'blur(12px)' }}
      >
        <Gauge className="h-4 w-4 text-blue-400" />
        <span className="hidden sm:inline">Monitor</span>
        {badge > 0 && (
          <span className={`ml-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold
            flex items-center justify-center
            ${errCount > 0 ? 'bg-red-500 text-white' : 'bg-amber-500 text-black'}`}>
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </button>

      {/* ── Panel ── */}
      {open && (
        <div
          className="fixed bottom-16 left-4 z-[9999] w-[min(96vw,560px)] rounded-2xl
            bg-slate-950/95 border border-slate-700/60 shadow-2xl flex flex-col overflow-hidden"
          style={{ backdropFilter: 'blur(20px)', maxHeight: '80vh' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/80 shrink-0">
            <div className="flex items-center gap-2.5">
              <Gauge className="h-4.5 w-4.5 text-blue-400" />
              <span className="text-sm font-bold text-slate-100">Performance Monitor</span>
              <span className={`text-xs font-bold ${scoreColor(health)}`}>
                {health}/100
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={clearAll}
                title="Clear all data"
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Health bar */}
          <div className="px-4 py-2.5 border-b border-slate-800/60 shrink-0">
            <div className="flex items-center justify-between mb-1.5 text-[11px] text-slate-400">
              <span>Health Score</span>
              <span className={`font-bold ${scoreColor(health)}`}>{health}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${scoreBg(health)} to-transparent transition-all duration-500`}
                style={{ width: `${health}%` }}
              />
            </div>
            <div className="flex gap-4 mt-2 text-[10px] text-slate-500">
              <span><span className="text-emerald-400 font-bold">{apis.filter(a => a.tag === 'fast').length}</span> fast</span>
              <span><span className="text-amber-400   font-bold">{apis.filter(a => a.tag === 'slow').length}</span> slow</span>
              <span><span className="text-orange-400  font-bold">{apis.filter(a => a.tag === 'critical').length}</span> critical</span>
              <span><span className="text-red-400     font-bold">{apis.filter(a => a.tag === 'error').length}</span> failed</span>
              <span><span className="text-red-400     font-bold">{errors.length}</span> errors</span>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex border-b border-slate-800/60 shrink-0">
            {([ ['api', 'API Calls'], ['errors', 'Errors'], ['nav', 'Navigation'], ['report', 'Report'] ] as const).map(([t, label]) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 text-[11px] font-semibold transition-colors relative
                  ${tab === t ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
              >
                {label}
                {t === 'errors' && errors.length > 0 && (
                  <span className="ml-1 bg-red-500 text-white rounded-full px-1 text-[9px]">
                    {errors.length}
                  </span>
                )}
                {tab === t && (
                  <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-blue-400 rounded-full" />
                )}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="overflow-y-auto flex-1 text-xs">
            {/* ── API CALLS tab ── */}
            {tab === 'api' && (
              <div>
                {/* Filter row */}
                <div className="flex gap-1.5 px-3 py-2 border-b border-slate-800/40 flex-wrap">
                  {(['all', 'fast', 'slow', 'critical', 'error'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setFilterTag(f)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors border
                        ${filterTag === f
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'}`}
                    >
                      {f === 'all' ? `All (${apis.length})` : f === 'fast' ? `Fast (${apis.filter(a=>a.tag==='fast').length})`
                        : f === 'slow' ? `Slow (${apis.filter(a=>a.tag==='slow').length})`
                        : f === 'critical' ? `Critical (${apis.filter(a=>a.tag==='critical').length})`
                        : `Failed (${apis.filter(a=>a.tag==='error').length})`}
                    </button>
                  ))}
                </div>

                {filteredApis.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-slate-600 gap-2">
                    <Wifi className="h-8 w-8 opacity-40" />
                    <p className="text-[11px]">No API calls captured yet</p>
                    <p className="text-[10px] text-slate-700">Navigate around the app to populate data</p>
                  </div>
                ) : (
                  filteredApis.map(a => (
                    <div
                      key={a.id}
                      className="px-3 py-2 border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${
                          a.method === 'GET' ? 'bg-blue-500/20 text-blue-400'
                          : a.method === 'POST' ? 'bg-green-500/20 text-green-400'
                          : a.method === 'PUT' || a.method === 'PATCH' ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-red-500/20 text-red-400'
                        }`}>{a.method}</span>
                        <span className="text-slate-300 font-mono truncate flex-1" title={a.url}>
                          {truncate(a.url, 50)}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${TAG_STYLES[a.tag]}`}>
                          {a.tag === 'error' ? `${a.status ?? 'ERR'}` : TAG_LABEL[a.tag]}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-slate-500">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span className={
                            a.tag === 'fast' ? 'text-emerald-400' :
                            a.tag === 'slow' ? 'text-amber-400' :
                            a.tag === 'critical' ? 'text-orange-400' : 'text-red-400'
                          }>{fmt(a.duration)}</span>
                        </span>
                        <span className={`flex items-center gap-1 ${a.isInternal ? 'text-purple-400' : 'text-cyan-400'}`}>
                          {a.isInternal ? <Server className="h-3 w-3" /> : <ExternalLink className="h-3 w-3" />}
                          {a.isInternal ? 'Backend API' : 'External'}
                        </span>
                        {a.status && (
                          <span className={a.ok ? 'text-emerald-500' : 'text-red-400'}>
                            HTTP {a.status}
                          </span>
                        )}
                        <span className="ml-auto">{relTime(a.ts)}</span>
                      </div>
                      {a.error && (
                        <div className="mt-1 text-red-400 font-mono text-[10px] bg-red-500/5 rounded px-2 py-1">
                          {truncate(a.error, 80)}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── ERRORS tab ── */}
            {tab === 'errors' && (
              <div>
                {errors.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-slate-600 gap-2">
                    <CheckCircle2 className="h-8 w-8 text-emerald-600 opacity-60" />
                    <p className="text-[11px] text-slate-500">No errors captured</p>
                  </div>
                ) : (
                  errors.map(e => (
                    <div key={e.id} className="px-3 py-2.5 border-b border-slate-800/40 hover:bg-slate-800/20">
                      <div className="flex items-start gap-2">
                        {ERR_ICON[e.type]}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                              e.type === 'react' || e.type === 'js' ? 'bg-red-500/20 text-red-400' :
                              e.type === 'promise' ? 'bg-orange-500/20 text-orange-400' :
                              'bg-amber-500/20 text-amber-400'
                            }`}>{e.type}</span>
                            <span className="text-slate-500 text-[10px]">{relTime(e.ts)}</span>
                          </div>
                          <p className="text-slate-300 mt-0.5 leading-snug break-words">{truncate(e.message, 200)}</p>
                          {e.url && <p className="text-slate-600 mt-0.5 font-mono text-[10px]">{truncate(e.url, 60)}</p>}
                          {e.stack && (
                            <details className="mt-1">
                              <summary className="text-slate-600 cursor-pointer hover:text-slate-400 text-[10px]">
                                Stack trace
                              </summary>
                              <pre className="text-[9px] text-slate-500 mt-1 bg-slate-900 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
                                {e.stack.slice(0, 600)}
                              </pre>
                            </details>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── NAVIGATION tab ── */}
            {tab === 'nav' && (
              <div>
                {navs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-slate-600 gap-2">
                    <Activity className="h-8 w-8 opacity-40" />
                    <p className="text-[11px]">No navigations yet</p>
                    <p className="text-[10px] text-slate-700">Switch between pages to measure load times</p>
                  </div>
                ) : (
                  navs.map(n => {
                    const tag = n.duration < 300 ? 'fast' : n.duration < 1000 ? 'slow' : 'critical';
                    return (
                      <div key={n.id} className="px-3 py-2 border-b border-slate-800/40 hover:bg-slate-800/20">
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${TAG_STYLES[tag]}`}>
                            {fmt(n.duration)}
                          </span>
                          <span className="text-slate-500 text-[10px] truncate flex-1">
                            <span className="text-slate-400">{truncate(n.to, 40)}</span>
                          </span>
                          <span className="text-slate-600 text-[10px] shrink-0">{relTime(n.ts)}</span>
                        </div>
                        <div className="text-slate-600 mt-0.5 text-[10px]">
                          from: {truncate(n.from, 50)}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* ── REPORT tab ── */}
            {tab === 'report' && (
              <div className="p-4 space-y-4">
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Click <strong className="text-slate-200">Copy Full Report</strong> to generate a complete JSON
                  diagnostic snapshot — paste it directly into the AI chat to get all issues diagnosed and fixed.
                </p>

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Health', value: `${health}/100`, color: scoreColor(health) },
                    { label: 'Total API calls', value: apis.length, color: 'text-slate-200' },
                    { label: 'Failed calls', value: failCount, color: failCount > 0 ? 'text-red-400' : 'text-emerald-400' },
                    { label: 'Slow calls', value: apis.filter(a => a.tag === 'slow' || a.tag === 'critical').length, color: 'text-amber-400' },
                    { label: 'JS errors', value: errors.filter(e => e.type !== 'console').length, color: errors.length > 0 ? 'text-red-400' : 'text-emerald-400' },
                    { label: 'Console errors', value: errors.filter(e => e.type === 'console').length, color: 'text-amber-400' },
                    { label: 'Avg API time', value: apis.length ? fmt(Math.round(apis.reduce((s, a) => s + (a.duration ?? 0), 0) / apis.length)) : '—', color: 'text-slate-200' },
                    { label: 'Navigations', value: navs.length, color: 'text-slate-200' },
                  ].map(s => (
                    <div key={s.label} className="bg-slate-800/60 rounded-lg px-3 py-2.5 border border-slate-700/40">
                      <div className="text-slate-500 text-[10px]">{s.label}</div>
                      <div className={`font-bold text-sm mt-0.5 ${s.color}`}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* Problematic APIs summary */}
                {apis.filter(a => a.tag !== 'fast').length > 0 && (
                  <div className="bg-slate-800/40 rounded-lg border border-slate-700/40 p-3">
                    <p className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider mb-2">
                      Issues Detected
                    </p>
                    {apis.filter(a => a.tag !== 'fast').slice(0, 10).map(a => (
                      <div key={a.id} className="flex items-center gap-2 py-1 border-b border-slate-800/60 last:border-0">
                        <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${TAG_STYLES[a.tag]}`}>
                          {a.tag.toUpperCase()}
                        </span>
                        <span className="text-slate-400 font-mono truncate flex-1 text-[10px]">{truncate(a.url, 45)}</span>
                        <span className={`text-[10px] font-bold ${
                          a.tag === 'fast' ? 'text-emerald-400' : a.tag === 'slow' ? 'text-amber-400' :
                          a.tag === 'critical' ? 'text-orange-400' : 'text-red-400'
                        }`}>{fmt(a.duration)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={copyReport}
                  className={`w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2
                    ${copied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
                >
                  {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Report Copied!' : 'Copy Full Report'}
                </button>
                <p className="text-slate-600 text-[10px] text-center">
                  Captures all API calls, errors, and navigations • Shift+Alt+D to toggle
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default DiagnosticsPanel;
