// @ts-nocheck
/**
 * Outlook Add-in Task Pane — full-featured hub.
 * Screens: Home → Submit Ticket | Request Clearance | My Tickets | My Assets
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import Head from 'next/head';
import Script from 'next/script';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  Ticket, Send, Loader2, LogIn, AlertCircle, CheckCircle2,
  ArrowUp, Minus, ArrowDown, Mail, Wrench, HelpCircle, FileText,
  Users, LogOut, ArrowLeft, Package, List, ShieldCheck,
  Clock, RefreshCw, ChevronRight, XCircle, CheckCircle,
  Search, Tag, MapPin, MessageCircle,
} from 'lucide-react';

/* ── Constants ─────────────────────────────────────────────────────────────── */
const OUTLOOK_AUTH_MESSAGE = 'OUTLOOK_AUTH';
const STORAGE_KEY = 'outlook_addin_access_token';

/* ── Types ──────────────────────────────────────────────────────────────────── */
type Screen = 'home' | 'ticket' | 'clearance' | 'mytickets' | 'myassets';
type TicketMode = '' | 'normal' | 'hwsw';
type TicketStep = 'mode' | 'type' | 'details' | 'hwcat' | 'hwsub' | 'hwdetails';

/* ── Ticket type config ─────────────────────────────────────────────────────── */
const TICKET_TYPES = [
  { value: 'ISSUE',      label: 'Issue',      desc: 'Something broken or not working', icon: Wrench,     color: 'text-red-600',    selBg: 'bg-red-50 border-red-400',    iconBg: 'bg-red-100' },
  { value: 'REQUEST',    label: 'Request',    desc: 'Need something new or changed',   icon: FileText,   color: 'text-blue-600',   selBg: 'bg-blue-50 border-blue-400',  iconBg: 'bg-blue-100' },
  { value: 'INQUIRY',    label: 'Inquiry',    desc: 'Have a question or need info',    icon: HelpCircle, color: 'text-violet-600', selBg: 'bg-violet-50 border-violet-400', iconBg: 'bg-violet-100' },
  { value: 'MANAGEMENT', label: 'Management', desc: 'Admin or management task',        icon: Users,      color: 'text-slate-700',  selBg: 'bg-slate-100 border-slate-400',  iconBg: 'bg-slate-200' },
] as const;

const PRIORITIES = [
  { value: 'LOW',      label: 'Low',      icon: ArrowDown, color: 'text-emerald-600 bg-emerald-50 border-emerald-300' },
  { value: 'MEDIUM',   label: 'Medium',   icon: Minus,     color: 'text-amber-600 bg-amber-50 border-amber-300' },
  { value: 'HIGH',     label: 'High',     icon: ArrowUp,   color: 'text-orange-600 bg-orange-50 border-orange-300' },
  { value: 'CRITICAL', label: 'Critical', icon: ArrowUp,   color: 'text-red-600 bg-red-50 border-red-300' },
] as const;

/* ── HW/SW Category tree ────────────────────────────────────────────────────── */
const HW_CATEGORIES = [
  { key: 'Devices',         label: 'Devices',          icon: '🖥️',  subs: ['Desktop Computer','Laptop','Computer Peripherals (Accessories)','Change Printer Toner','Device Movement','Maintenance','Monitor','Mobile Devices','Printer','TV & IP TV STB','Events','PAM Secure Access','Return an Asset','Report Lost/Stolen/Confiscated Assets','IP Phone'] },
  { key: 'Access',          label: 'Access',            icon: '🔑',  subs: ['VPN Access','System Access Request','Email Account','Application Access','Network Access','Remote Access'] },
  { key: 'Digital Request', label: 'Digital Request',   icon: '💻',  subs: ['Software Installation','Cloud Storage','Digital Certificate','Website Request'] },
  { key: 'NG Deployments',  label: 'NG Deployments',   icon: '🚀',  subs: ['Server Deployment','Network Configuration','Infrastructure Request'] },
  { key: 'Service Desk',    label: 'Service Desk',      icon: '🎧',  subs: ['Feedback','Inquiry','Report an Issue','Return an Asset','Report Lost/Stolen/Confiscated Assets'] },
  { key: 'Software',        label: 'Software',          icon: '📦',  subs: ['License Request','Software Bug Report','Feature Request','Software Upgrade'] },
  { key: 'Asset Management',label: 'Asset Management',  icon: '🏷️',  subs: ['Asset Request','Not My Asset','Report Lost/Stolen/Confiscated Assets','Return an Asset','Project Status Report (Assets)'] },
  { key: 'SAP',             label: 'SAP',               icon: '📊',  subs: ['SAP System Access','SAP Report Request','SAP Issue','SAP Training'] },
] as const;

const CLEARANCE_REASONS = [
  { value: 'TERMINATED', label: 'Terminated' },
  { value: 'RESIGNED',   label: 'Resigned' },
  { value: 'TRANSFERRED',label: 'Transferred' },
  { value: 'SUSPENDED',  label: 'Suspended' },
  { value: 'OTHER',      label: 'Other' },
] as const;

const STATUS_CFG: Record<string, { label: string; dot: string; text: string }> = {
  OPEN:        { label: 'Open',        dot: 'bg-blue-500',    text: 'text-blue-700' },
  IN_PROGRESS: { label: 'In Progress', dot: 'bg-amber-500',   text: 'text-amber-700' },
  RESOLVED:    { label: 'Resolved',    dot: 'bg-emerald-500', text: 'text-emerald-700' },
  CLOSED:      { label: 'Closed',      dot: 'bg-slate-400',   text: 'text-slate-600' },
};

const PRI_CFG: Record<string, { label: string; color: string }> = {
  LOW:      { label: 'Low',      color: 'text-emerald-600' },
  MEDIUM:   { label: 'Medium',   color: 'text-amber-600' },
  HIGH:     { label: 'High',     color: 'text-orange-600' },
  CRITICAL: { label: 'Critical', color: 'text-red-600' },
};

/* ── Helpers ─────────────────────────────────────────────────────────────────── */
function getToken() {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(STORAGE_KEY);
}
function getAuthHeaders(): HeadersInit {
  const t = getToken();
  return t ? { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` } : { 'Content-Type': 'application/json' };
}
function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

/* ── Office.js ready hook ────────────────────────────────────────────────────── */
function useOfficeReady() {
  const [mailContext, setMailContext] = useState<{ subject: string; body: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      const Office = (window as any).Office;
      if (!Office) return;
      await new Promise<void>(r => Office.onReady(() => r()));
      if (cancelled) return;
      try {
        const item = Office.context?.mailbox?.item;
        if (!item) return;
        if (typeof item.subject?.getAsync === 'function') {
          const subject = await new Promise<string>(r => item.subject.getAsync((x: any) => r(x.value ?? ''))).catch(() => '');
          const body = await new Promise<string>(r => item.body?.getAsync('text', (x: any) => r(x.value?.slice(0, 2000) ?? ''))).catch(() => '');
          if (!cancelled && (subject || body)) setMailContext({ subject, body });
        } else if (typeof item.subject === 'string' && item.subject) {
          if (!cancelled) setMailContext({ subject: item.subject, body: '' });
        }
      } catch { /* no mail context */ }
    };
    if ((window as any).Office) init();
    else (window as any).__outlookTaskPaneInit = init;
    return () => { cancelled = true; };
  }, []);

  return { mailContext };
}

/* ── Native app detection helper ─────────────────────────────────────────────── */
function inNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window as any).ReactNativeWebView;
}

/** Tell native to show its login screen immediately (hides web page first). */
function triggerNativeLogin() {
  if (typeof window === 'undefined') return;
  try {
    document.documentElement.style.cssText =
      'visibility:hidden!important;opacity:0!important;pointer-events:none!important;';
  } catch (_) {}
  if ((window as any).AssetXAI?.signOut) {
    (window as any).AssetXAI.signOut();
  } else if ((window as any).ReactNativeWebView) {
    (window as any).ReactNativeWebView.postMessage(JSON.stringify({ type: 'signout' }));
  }
}

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════════════════ */
export default function OutlookTaskPane() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [screen, setScreen] = useState<Screen>('home');
  const nativeSignoutSentRef = React.useRef(false);

  /* ── ticket form ── */
  const [ticketStep, setTicketStep] = useState<TicketStep>('mode');
  const [ticketMode, setTicketMode] = useState<TicketMode>('');
  const [hwCategory, setHwCategory] = useState('');
  const [hwSubcategory, setHwSubcategory] = useState('');
  const [ticketForm, setTicketForm] = useState({ title: '', description: '', priority: 'MEDIUM', ticketType: '' });
  const [ticketSubmitting, setTicketSubmitting] = useState(false);
  const [ticketResult, setTicketResult] = useState<'idle' | 'success' | 'error'>('idle');
  const [ticketError, setTicketError] = useState('');

  /* ── clearance form ── */
  const [clForm, setClForm] = useState({ staffName: '', staffEmail: '', reason: 'TERMINATED', notes: '' });
  const [clSubmitting, setClSubmitting] = useState(false);
  const [clResult, setClResult] = useState<'idle' | 'success' | 'error'>('idle');
  const [clError, setClError] = useState('');

  /* ── my tickets ── */
  const [myTickets, setMyTickets] = useState<any[]>([]);
  const [myTicketsLoading, setMyTicketsLoading] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [ticketHistory, setTicketHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [commentSending, setCommentSending] = useState(false);
  const [commentResult, setCommentResult] = useState<'idle' | 'success' | 'error'>('idle');
  const historyEndRef = useRef<HTMLDivElement>(null);

  /* ── notifications ── */
  const [notifications, setNotifications] = useState<any[]>([]);

  /* ── my assets ── */
  const [myAssets, setMyAssets] = useState<any[]>([]);
  const [myAssetsLoading, setMyAssetsLoading] = useState(false);

  const { mailContext } = useOfficeReady();

  /* ── Auth check: instant when token exists, lightweight validation in background ── */
  const checkAuth = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setAuthenticated(false);
      return;
    }
    setAuthenticated(true);
    try {
      const res = await fetch('/api/outlook/auth-check', { method: 'GET', credentials: 'include', headers: getAuthHeaders() });
      if (!res.ok) setAuthenticated(false);
    } catch { setAuthenticated(false); }
  }, []);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  /**
   * When running inside the native mobile app AND the page reaches
   * authenticated=false (no token / expired token), immediately redirect
   * to the native login screen instead of showing the web login form.
   * This prevents the Outlook Office.js auth popup from ever being triggered
   * (which causes "Could not communicate with the task pane" in a WebView).
   */
  useEffect(() => {
    if (authenticated !== false) return;   // null = still loading, true = logged in
    if (!inNativeApp()) return;            // only for native WebView
    if (nativeSignoutSentRef.current) return; // send once
    nativeSignoutSentRef.current = true;
    triggerNativeLogin();
  }, [authenticated]);

  /* ── postMessage listener (web opener) ──────────────────────────────────── */
  useEffect(() => {
    const h = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === OUTLOOK_AUTH_MESSAGE && e.data?.accessToken) {
        sessionStorage.setItem(STORAGE_KEY, e.data.accessToken);
        setAuthenticated(true);
      }
    };
    window.addEventListener('message', h);
    return () => window.removeEventListener('message', h);
  }, []);

  /* ── Email prefill ───────────────────────────────────────────────────────── */
  useEffect(() => {
    if (mailContext && !ticketForm.title && mailContext.subject)
      setTicketForm(f => ({ ...f, title: mailContext.subject }));
    if (mailContext && !ticketForm.description && mailContext.body)
      setTicketForm(f => ({ ...f, description: mailContext.body }));
  }, [mailContext]);

  /* ── Sign in dialog ──────────────────────────────────────────────────────── */
  const openLoginDialog = () => {
    const loginUrl = `${window.location.origin}/login?outlook=1&redirect=${encodeURIComponent('/outlook/auth-callback')}`;
    const Office = (window as any).Office;
    if (Office?.context?.ui?.displayDialogAsync) {
      Office.context.ui.displayDialogAsync(loginUrl, { height: 55, width: 35, displayInIframe: false }, (result: any) => {
        if (result.status !== Office.AsyncResultStatus.Succeeded) return;
        const dialog = result.value;
        dialog.addEventHandler(Office.EventType.DialogMessageReceived, (evt: any) => {
          try {
            const data = JSON.parse(evt.message ?? '{}');
            if (data.type === OUTLOOK_AUTH_MESSAGE && data.accessToken) {
              sessionStorage.setItem(STORAGE_KEY, data.accessToken);
              setAuthenticated(true);
            }
          } catch { }
          dialog.close();
        });
        dialog.addEventHandler(Office.EventType.DialogEventReceived, () => dialog.close());
      });
    } else {
      window.open(loginUrl, '_blank', 'width=420,height=560');
    }
  };

  const signOut = () => {
    // When running inside the native mobile app:
    // call AssetXAI.signOut() FIRST — it immediately hides the page and
    // posts the signout message so the native login screen appears before
    // React re-renders and shows this page's own login form.
    const isInNativeApp =
      typeof window !== 'undefined' &&
      ((window as any).AssetXAI || (window as any).ReactNativeWebView);

    if (isInNativeApp) {
      if ((window as any).AssetXAI?.signOut) {
        (window as any).AssetXAI.signOut();
      } else {
        // Immediately hide page to prevent login form flash
        try {
          document.documentElement.style.cssText =
            'visibility:hidden!important;opacity:0!important;pointer-events:none!important;';
        } catch (_) {}
        (window as any).ReactNativeWebView.postMessage(JSON.stringify({ type: 'signout' }));
      }
      // Don't update React state — native app will unmount this WebView
      return;
    }

    // Web-only (non-native) path: update local state normally
    sessionStorage.removeItem(STORAGE_KEY);
    setAuthenticated(false);
    setScreen('home');
    resetAll();
  };

  const resetAll = () => {
    setTicketForm({ title: '', description: '', priority: 'MEDIUM', ticketType: '' });
    setTicketStep('mode'); setTicketMode(''); setTicketResult('idle'); setTicketError('');
    setHwCategory(''); setHwSubcategory('');
    setClForm({ staffName: '', staffEmail: '', reason: 'TERMINATED', notes: '' });
    setClResult('idle'); setClError('');
  };

  /* ── Fetch notifications ─────────────────────────────────────────────────── */
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', { credentials: 'include', headers: getAuthHeaders() });
      if (res.ok) setNotifications(await res.json() || []);
    } catch { }
  }, []);

  /* ── Computed: unread count per ticket ───────────────────────────────────── */
  const ticketUnreads: Record<string, number> = notifications
    .filter((n: any) => !n.readAt && n.ticketId)
    .reduce((acc: Record<string, number>, n: any) => {
      acc[n.ticketId] = (acc[n.ticketId] || 0) + 1;
      return acc;
    }, {});
  const totalTicketUpdates = Object.keys(ticketUnreads).length;

  /* ── Fetch my tickets ────────────────────────────────────────────────────── */
  const fetchMyTickets = useCallback(async () => {
    setMyTicketsLoading(true);
    try {
      const [ticketRes] = await Promise.all([
        fetch('/api/tickets', { credentials: 'include', headers: getAuthHeaders() }),
        fetchNotifications(),
      ]);
      if (ticketRes.ok) {
        const data = await ticketRes.json();
        // Show most recent 20 tickets
        const all = (data.tickets ?? data ?? []).slice(0, 20);
        setMyTickets(all);
      }
    } catch { } finally { setMyTicketsLoading(false); }
  }, [fetchNotifications]);

  useEffect(() => {
    if (screen === 'mytickets' && authenticated) { fetchMyTickets(); setSelectedTicket(null); }
  }, [screen, authenticated]);

  // Fetch notifications also when hitting Home so the badge is visible
  useEffect(() => {
    if (screen === 'home' && authenticated) fetchNotifications();
  }, [screen, authenticated, fetchNotifications]);

  /* ── Open ticket detail ──────────────────────────────────────────────────── */
  const openTicketDetail = useCallback(async (t: any) => {
    setSelectedTicket(t);
    setTicketHistory([]);
    setComment('');
    setCommentResult('idle');
    setHistoryLoading(true);

    // Mark all unread notifications for this ticket as read (optimistic UI + API call)
    const unreadIds = notifications.filter((n: any) => !n.readAt && n.ticketId === t.id).map((n: any) => n.id);
    if (unreadIds.length > 0) {
      setNotifications((prev: any[]) => prev.map((n: any) => n.ticketId === t.id ? { ...n, readAt: new Date().toISOString() } : n));
      fetch('/api/notifications', {
        method: 'PATCH', credentials: 'include',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: unreadIds }),
      }).catch(() => {});
    }

    try {
      const res = await fetch(`/api/tickets/${t.id}/history`, { credentials: 'include', headers: getAuthHeaders() });
      if (res.ok) setTicketHistory(await res.json() || []);
    } catch { } finally { setHistoryLoading(false); }
  }, [notifications]);

  /* ── Scroll history to end ───────────────────────────────────────────────── */
  useEffect(() => {
    if (ticketHistory.length > 0) setTimeout(() => historyEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, [ticketHistory]);

  /* ── Post comment ────────────────────────────────────────────────────────── */
  const postComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim() || !selectedTicket) return;
    setCommentSending(true); setCommentResult('idle');
    try {
      const res = await fetch(`/api/tickets/${selectedTicket.id}`, {
        method: 'PATCH', credentials: 'include', headers: getAuthHeaders(),
        body: JSON.stringify({ comment: comment.trim() }),
      });
      if (!res.ok) throw new Error();
      setComment('');
      setCommentResult('success');
      // Reload history
      const hr = await fetch(`/api/tickets/${selectedTicket.id}/history`, { credentials: 'include', headers: getAuthHeaders() });
      if (hr.ok) setTicketHistory(await hr.json() || []);
      // Also refresh ticket list
      fetchMyTickets();
    } catch { setCommentResult('error'); }
    finally { setCommentSending(false); setTimeout(() => setCommentResult('idle'), 3000); }
  };

  /* ── Fetch my assets ─────────────────────────────────────────────────────── */
  const fetchMyAssets = useCallback(async () => {
    setMyAssetsLoading(true);
    try {
      // /api/assets/mine uses requireAuth which supports Bearer tokens (add-in auth)
      const res = await fetch('/api/assets/mine', { credentials: 'include', headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setMyAssets(data.assets ?? []);
      }
    } catch { } finally { setMyAssetsLoading(false); }
  }, []);

  useEffect(() => { if (screen === 'myassets' && authenticated) fetchMyAssets(); }, [screen, authenticated]);

  /* ── Submit ticket ───────────────────────────────────────────────────────── */
  const [ticketNeedsDlm, setTicketNeedsDlm] = useState(false);
  const submitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (ticketMode === 'normal' && !ticketForm.ticketType) { setTicketResult('error'); setTicketError('Please select a ticket type.'); return; }
    if (!ticketForm.title.trim()) { setTicketResult('error'); setTicketError('Please enter a summary.'); return; }
    if (ticketForm.description.trim().length < 10) { setTicketResult('error'); setTicketError('Description must be at least 10 characters.'); return; }
    setTicketSubmitting(true); setTicketResult('idle'); setTicketError(''); setTicketNeedsDlm(false);
    try {
      const body: any = {
        title: ticketForm.title.trim(), description: ticketForm.description.trim(),
        priority: ticketForm.priority, source: 'OUTLOOK',
      };
      if (ticketMode === 'normal') { body.ticketType = ticketForm.ticketType; }
      if (ticketMode === 'hwsw')   { body.ticketType = 'REQUEST'; body.category = hwCategory; body.subcategory = hwSubcategory; }
      const res = await fetch('/api/tickets', { method: 'POST', credentials: 'include', headers: getAuthHeaders(), body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.error || d?.message || `Error ${res.status}`); }
      // Check if DLM approval is required from the API response
      const responseData = await res.json().catch(() => ({}));
      const needsDlm = responseData?.dlmApprovalStatus === 'PENDING_DLM';
      setTicketNeedsDlm(needsDlm);
      setTicketResult('success');
      setTicketForm({ title: '', description: '', priority: 'MEDIUM', ticketType: '' });
      setHwCategory(''); setHwSubcategory('');
      setTicketStep('mode'); setTicketMode('');
    } catch (err) { setTicketResult('error'); setTicketError(err instanceof Error ? err.message : 'Failed to submit'); }
    finally { setTicketSubmitting(false); }
  };

  /* ── Submit clearance request ────────────────────────────────────────────── */
  const submitClearance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clForm.staffName.trim() || !clForm.staffEmail.trim()) { setClResult('error'); setClError('Please enter staff name and email.'); return; }
    setClSubmitting(true); setClResult('idle'); setClError('');
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST', credentials: 'include', headers: getAuthHeaders(),
        body: JSON.stringify({
          title: `Asset Clearance Request — ${clForm.staffName}`,
          description: `Clearance requested for: ${clForm.staffName} (${clForm.staffEmail})\nReason: ${clForm.reason}${clForm.notes ? `\nNotes: ${clForm.notes}` : ''}`,
          priority: 'HIGH', ticketType: 'MANAGEMENT', category: 'CLEARANCE_REQUEST',
          requesterName: clForm.staffName, contactDetails: clForm.staffEmail, source: 'OUTLOOK',
        }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.error || `Error ${res.status}`); }
      setClResult('success');
      setClForm({ staffName: '', staffEmail: '', reason: 'TERMINATED', notes: '' });
    } catch (err) { setClResult('error'); setClError(err instanceof Error ? err.message : 'Failed to submit'); }
    finally { setClSubmitting(false); }
  };

  /* ── Office.js Script ────────────────────────────────────────────────────── */
  const officeScript = (
    <Script src="https://appsforoffice.microsoft.com/lib/1/hosted/office.js" strategy="afterInteractive"
      onLoad={() => {
        if (typeof (window as any).__outlookTaskPaneInit === 'function') {
          (window as any).__outlookTaskPaneInit();
          delete (window as any).__outlookTaskPaneInit;
        }
      }}
    />
  );

  /* ══ RENDER: Loading ══════════════════════════════════════════════════════ */
  if (authenticated === null) {
    return (
      <>
        <Head><title>Asset AI — Outlook</title></Head>
        {officeScript}
        <div className="min-h-screen bg-slate-50 dark:bg-background flex items-center justify-center">
          <Loader2 className="h-8 w-8 text-indigo-600 dark:text-indigo-400 animate-spin" />
        </div>
      </>
    );
  }

  /* ══ RENDER: Sign In / Loading ══════════════════════════════════════════ */

  /* authenticated === null means the initial auth check is still running */
  if (authenticated === null) {
    return (
      <>
        <Head><title>Asset AI</title></Head>
        {officeScript}
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex flex-col items-center justify-center p-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 flex items-center justify-center shadow-lg mb-4 animate-pulse">
            <Ticket className="h-7 w-7 text-white" />
          </div>
          <p className="text-sm text-slate-400 dark:text-muted-foreground">Loading AssetXAI…</p>
        </div>
      </>
    );
  }

  if (!authenticated) {
    /* ── Inside native mobile WebView: never show the Outlook popup auth.
       The effect above already called triggerNativeLogin() which hid the
       page and posted signout to native. Show a blank screen here. ── */
    if (inNativeApp()) {
      return (
        <>
          <Head><title>AssetXAI</title></Head>
          {officeScript}
          <div style={{ minHeight: '100vh', background: '#1e1b4b' }} />
        </>
      );
    }

    /* ── Outlook / web browser: show the normal sign-in form ── */
    return (
      <>
        <Head><title>Sign In — Asset AI</title></Head>
        {officeScript}
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-indigo-900/40 mb-5">
            <Ticket className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-xl font-black text-slate-900 dark:text-foreground mb-1">Asset AI</h1>
          <p className="text-slate-500 dark:text-muted-foreground text-sm mb-7 max-w-[260px]">
            Sign in to submit tickets, request clearance, and manage your assets.
          </p>
          <button
            onClick={openLoginDialog}
            className="inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3 text-sm font-bold text-white shadow-sm hover:from-indigo-700 hover:to-violet-700 transition-all"
          >
            <LogIn className="h-4 w-4" /> Sign In
          </button>
        </div>
      </>
    );
  }

  /* ══ SHARED CHROME ════════════════════════════════════════════════════════ */
  const Header = ({ title, onBack }: { title: string; onBack?: () => void }) => (
    <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200/80 dark:border-border bg-white/80 dark:bg-card/90 backdrop-blur-sm shrink-0">
      <div className="flex items-center gap-2.5">
        {onBack ? (
          <button onClick={onBack} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-500 dark:text-muted-foreground hover:text-slate-800 dark:hover:text-foreground hover:bg-slate-100 dark:hover:bg-muted transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
        ) : (
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-sm shrink-0">
            <Ticket className="h-4 w-4 text-white" />
          </div>
        )}
        <p className="text-sm font-bold text-slate-900 dark:text-foreground">{title}</p>
      </div>
      <div className="flex items-center gap-1">
        <div className="rounded-md border border-slate-200/80 dark:border-border bg-slate-50/80 dark:bg-muted/50 p-0.5">
          <ThemeToggle />
        </div>
        {/* Sign-out hidden in native app — native top bar owns this action */}
        {!inNativeApp() && (
          <button onClick={signOut} title="Sign out" className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-foreground hover:bg-slate-100 dark:hover:bg-muted transition-colors">
            <LogOut className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </header>
  );

  /* ══ HOME ════════════════════════════════════════════════════════════════ */
  if (screen === 'home') {
    const actions = [
      { key: 'ticket',    label: 'Submit Ticket',     desc: 'Report an issue or make a request', icon: Ticket,      grad: 'from-indigo-500 to-violet-600', shadow: 'shadow-indigo-100' },
      { key: 'clearance', label: 'Request Clearance', desc: 'Initiate asset clearance for staff', icon: ShieldCheck, grad: 'from-amber-500 to-orange-600',  shadow: 'shadow-amber-100' },
      { key: 'mytickets', label: 'My Tickets',        desc: 'View tickets you have submitted',   icon: List,        grad: 'from-blue-500 to-cyan-600',     shadow: 'shadow-blue-100' },
      { key: 'myassets',  label: 'My Assets',         desc: 'Assets currently assigned to you',  icon: Package,     grad: 'from-emerald-500 to-teal-600',  shadow: 'shadow-emerald-100' },
    ] as const;
    return (
      <>
        <Head><title>Asset AI — Outlook</title></Head>
        {officeScript}
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex flex-col">
          <Header title="Asset AI" />
          <main className="flex-1 p-4 space-y-3">
            {/* Welcome */}
            <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 p-4 text-white shadow-lg shadow-indigo-200">
              <p className="text-xs font-semibold text-indigo-200 uppercase tracking-wider mb-1">Outlook Add-in</p>
              <p className="text-base font-black">What do you need today?</p>
              <p className="text-xs text-indigo-200 mt-0.5">Select an action below to get started</p>
            </div>

            {/* Action grid */}
            <div className="grid grid-cols-2 gap-3">
              {actions.map(a => {
                const Icon = a.icon;
                const showBadge = a.key === 'mytickets' && totalTicketUpdates > 0;
                return (
                  <button key={a.key} onClick={() => setScreen(a.key as Screen)}
                    className="group relative flex flex-col gap-3 rounded-2xl border border-slate-100 dark:border-border bg-white dark:bg-card p-4 text-left shadow-sm hover:shadow-md hover:border-slate-200 dark:hover:border-border transition-all">
                    {showBadge && (
                      <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm animate-pulse z-10">
                        {totalTicketUpdates}
                      </span>
                    )}
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${a.grad} flex items-center justify-center shadow-sm ${a.shadow}`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-foreground leading-snug group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors">{a.label}</p>
                      <p className="text-[10px] text-slate-400 dark:text-muted-foreground mt-0.5 leading-snug">{a.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Email context notice */}
            {mailContext?.subject && (
              <div className="flex items-center gap-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900 px-3 py-2 text-xs text-indigo-700 dark:text-indigo-300">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="line-clamp-1">Email context: <strong>{mailContext.subject}</strong></span>
              </div>
            )}
          </main>
        </div>
      </>
    );
  }

  /* ══ SUBMIT TICKET ═══════════════════════════════════════════════════════ */
  if (screen === 'ticket') {
    const selectedType = TICKET_TYPES.find(t => t.value === ticketForm.ticketType);
    const hwCat = HW_CATEGORIES.find(c => c.key === hwCategory);

    const DetailsForm = () => (
      <div className="space-y-4">
        {mailContext && (
          <div className="flex items-center gap-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900 px-3 py-2 text-xs text-indigo-700 dark:text-indigo-300">
            <Mail className="h-3.5 w-3.5 shrink-0" /> Prefilled from current email
          </div>
        )}
        {ticketResult === 'success' && (
          ticketNeedsDlm ? (
            <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 border border-amber-300 px-3 py-3 text-sm text-amber-900 shadow-sm shadow-amber-100">
              <div className="h-6 w-6 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                <Clock className="h-3.5 w-3.5 text-amber-600 animate-pulse" />
              </div>
              <div>
                <p className="font-bold text-amber-800">Sent to your manager for approval</p>
                <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">Your IT request has been submitted and is now <strong>awaiting approval from your Direct Line Manager</strong> before it reaches the IT team. You'll be notified once reviewed.</p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2.5 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-3 text-sm text-emerald-800">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
              <div><p className="font-bold">Ticket submitted!</p><p className="text-xs text-emerald-600 mt-0.5">Our team will review it shortly.</p></div>
            </div>
          )
        )}
        {ticketResult === 'error' && ticketError && (
          <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" /> {ticketError}
          </div>
        )}
        <form onSubmit={submitTicket} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-muted-foreground uppercase tracking-wider mb-1.5">Summary <span className="text-red-400">*</span></label>
            <input type="text" value={ticketForm.title} onChange={e => setTicketForm(f => ({ ...f, title: e.target.value }))} placeholder="Brief one-line summary"
              className="w-full rounded-xl border border-slate-200 dark:border-border bg-white dark:bg-background px-3.5 py-2.5 text-sm text-slate-800 dark:text-foreground placeholder:text-slate-400 focus:border-indigo-500 dark:focus:border-primary focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-primary/30 outline-none transition" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-muted-foreground uppercase tracking-wider mb-1.5">Description <span className="text-red-400">*</span></label>
            <textarea value={ticketForm.description} onChange={e => setTicketForm(f => ({ ...f, description: e.target.value }))} placeholder="Provide as much detail as possible…" rows={4}
              className="w-full rounded-xl border border-slate-200 dark:border-border bg-white dark:bg-background px-3.5 py-2.5 text-sm text-slate-800 dark:text-foreground placeholder:text-slate-400 focus:border-indigo-500 dark:focus:border-primary focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-primary/30 outline-none resize-none transition" />
            <p className="mt-1 text-[10px] text-slate-400 dark:text-muted-foreground text-right">{ticketForm.description.length} chars</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-muted-foreground uppercase tracking-wider mb-2">Priority</label>
            <div className="grid grid-cols-2 gap-2">
              {PRIORITIES.map(p => {
                const Icon = p.icon;
                return (
                  <button key={p.value} type="button" onClick={() => setTicketForm(f => ({ ...f, priority: p.value }))}
                    className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-left text-sm font-semibold transition-all ${ticketForm.priority === p.value ? p.color + ' border-current shadow-sm' : 'border-slate-200 dark:border-border bg-white dark:bg-card text-slate-500 dark:text-muted-foreground hover:border-slate-300 dark:hover:border-border'}`}>
                    <Icon className="h-4 w-4 shrink-0" /> {p.label}
                  </button>
                );
              })}
            </div>
          </div>
          <button type="submit" disabled={ticketSubmitting}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-sm font-bold text-white shadow-sm hover:from-indigo-700 hover:to-violet-700 disabled:opacity-50 disabled:pointer-events-none transition-all">
            {ticketSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {ticketSubmitting ? 'Submitting…' : 'Submit Ticket'}
          </button>
        </form>
      </div>
    );

    return (
      <>
        <Head><title>Submit Ticket — Asset AI</title></Head>
        {officeScript}
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex flex-col">
          <Header title="Submit Ticket" onBack={() => { setScreen('home'); resetAll(); }} />

          <main className="flex-1 overflow-auto p-4">

            {/* ── Step: Choose mode ── */}
            {ticketStep === 'mode' && (
              <div className="space-y-3">
                <p className="text-sm font-bold text-slate-900 dark:text-foreground mb-4">What kind of ticket do you want to submit?</p>

                {/* Normal ticket */}
                <button type="button" onClick={() => { setTicketMode('normal'); setTicketStep('type'); setTicketResult('idle'); }}
                  className="w-full flex items-center gap-4 rounded-2xl border-2 border-slate-200 dark:border-border bg-white dark:bg-card px-4 py-4 text-left hover:border-indigo-400 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/30 hover:shadow-md transition-all group">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shrink-0 group-hover:scale-105 transition-transform">
                    <Ticket className="h-6 w-6 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-900 dark:text-foreground">Normal Ticket</p>
                    <p className="text-xs text-slate-500 dark:text-muted-foreground mt-0.5">Report an issue, submit a request, ask a question, or management task</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-300 dark:text-slate-600 group-hover:text-indigo-500 shrink-0 transition-colors" />
                </button>

                {/* HW/SW ticket */}
                <button type="button" onClick={() => { setTicketMode('hwsw'); setTicketStep('hwcat'); setTicketResult('idle'); }}
                  className="w-full flex items-center gap-4 rounded-2xl border-2 border-slate-200 dark:border-border bg-white dark:bg-card px-4 py-4 text-left hover:border-blue-400 hover:bg-blue-50/40 dark:hover:bg-blue-950/30 hover:shadow-md transition-all group">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-md shrink-0 group-hover:scale-105 transition-transform">
                    <Wrench className="h-6 w-6 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-900 dark:text-foreground">HW/SW Ticket</p>
                    <p className="text-xs text-slate-500 dark:text-muted-foreground mt-0.5">Hardware, software, access, deployments, SAP and IT service requests</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-300 dark:text-slate-600 group-hover:text-blue-500 shrink-0 transition-colors" />
                </button>

                {ticketResult === 'success' && (
                  ticketNeedsDlm ? (
                    <div className="mt-2 flex items-start gap-3 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 px-4 py-4 shadow-md shadow-amber-100">
                      <div className="h-9 w-9 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center shrink-0">
                        <Clock className="h-5 w-5 text-amber-600 animate-pulse" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="font-black text-amber-900 text-sm">Pending Manager Approval</p>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-800">DLM REVIEW</span>
                        </div>
                        <p className="text-xs text-amber-700 leading-relaxed">Your HW/SW request has been submitted and is awaiting your <strong>Direct Line Manager's approval</strong> before the IT team can process it. A notification email has been sent to your manager.</p>
                        <p className="text-[10px] text-amber-600 mt-2 font-semibold">✓ Request logged  ·  ✓ Manager notified  ·  ⏳ Awaiting DLM decision</p>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 flex items-start gap-2.5 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-3 text-sm text-emerald-800">
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
                      <div><p className="font-bold">Ticket submitted!</p><p className="text-xs text-emerald-600 mt-0.5">Our team will review it shortly.</p></div>
                    </div>
                  )
                )}
              </div>
            )}

            {/* ── Normal: Step 1 — select type ── */}
            {ticketStep === 'type' && ticketMode === 'normal' && (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 mb-3">
                  <button onClick={() => { setTicketStep('mode'); setTicketMode(''); setTicketResult('idle'); }} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                    <ArrowLeft className="h-3.5 w-3.5" /> Back
                  </button>
                  <p className="text-sm font-bold text-slate-900">What type of ticket?</p>
                </div>
                {TICKET_TYPES.map(t => {
                  const Icon = t.icon; const sel = ticketForm.ticketType === t.value;
                  return (
                    <button key={t.value} type="button" onClick={() => { setTicketForm(f => ({ ...f, ticketType: t.value })); setTicketResult('idle'); }}
                      className={`w-full flex items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-left transition-all ${sel ? `${t.selBg} shadow-sm` : 'border-slate-200 dark:border-border bg-white dark:bg-card hover:border-slate-300 dark:hover:border-border hover:shadow-sm'}`}>
                      <div className={`h-10 w-10 rounded-xl ${sel ? t.iconBg : 'bg-slate-100'} flex items-center justify-center shrink-0 transition-colors`}>
                        <Icon className={`h-5 w-5 ${sel ? t.color : 'text-slate-400'} transition-colors`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-bold ${sel ? t.color : 'text-slate-700'}`}>{t.label}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{t.desc}</p>
                      </div>
                      {sel && <CheckCircle2 className={`h-5 w-5 shrink-0 ${t.color}`} />}
                    </button>
                  );
                })}
                <button type="button" disabled={!ticketForm.ticketType} onClick={() => setTicketStep('details')}
                  className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-sm font-bold text-white shadow-sm hover:from-indigo-700 hover:to-violet-700 disabled:opacity-40 disabled:pointer-events-none transition-all">
                  Continue <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* ── Normal: Step 2 — details ── */}
            {ticketStep === 'details' && ticketMode === 'normal' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <button onClick={() => { setTicketStep('type'); setTicketResult('idle'); }} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                    <ArrowLeft className="h-3.5 w-3.5" /> Back
                  </button>
                  {selectedType && (
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold border-2 ${selectedType.selBg}`}>
                      <selectedType.icon className={`h-3.5 w-3.5 ${selectedType.color}`} />
                      <span className={selectedType.color}>{selectedType.label}</span>
                    </span>
                  )}
                </div>
                {DetailsForm()}
              </div>
            )}

            {/* ── HW/SW: Step 1 — select category ── */}
            {ticketStep === 'hwcat' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <button onClick={() => { setTicketStep('mode'); setTicketMode(''); }} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                    <ArrowLeft className="h-3.5 w-3.5" /> Back
                  </button>
                  <p className="text-sm font-bold text-slate-900">Select a category</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {HW_CATEGORIES.map(cat => {
                    const sel = hwCategory === cat.key;
                    return (
                      <button key={cat.key} type="button"
                        onClick={() => { setHwCategory(cat.key); setHwSubcategory(''); setTicketStep('hwsub'); }}
                        className={`flex items-center gap-2.5 rounded-2xl border-2 px-3 py-3 text-left transition-all hover:shadow-sm ${sel ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/40' : 'border-slate-200 dark:border-border bg-white dark:bg-card hover:border-slate-300 dark:hover:border-border'}`}>
                        <span className="text-xl shrink-0">{cat.icon}</span>
                        <p className={`text-xs font-bold leading-tight ${sel ? 'text-blue-700' : 'text-slate-700'}`}>{cat.label}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── HW/SW: Step 2 — select service type ── */}
            {ticketStep === 'hwsub' && hwCat && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <button onClick={() => { setTicketStep('hwcat'); setHwSubcategory(''); }} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                    <ArrowLeft className="h-3.5 w-3.5" /> Back
                  </button>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-bold text-blue-700">
                    <span>{hwCat.icon}</span> {hwCat.label}
                  </span>
                </div>
                <p className="text-sm font-bold text-slate-900">Select service type</p>
                <div className="space-y-1.5">
                  {hwCat.subs.map(sub => {
                    const sel = hwSubcategory === sub;
                    return (
                      <button key={sub} type="button"
                        onClick={() => {
                          setHwSubcategory(sub);
                          setTicketForm(f => ({ ...f, title: sub }));
                          setTicketStep('hwdetails');
                          setTicketResult('idle');
                        }}
                        className={`w-full flex items-center justify-between rounded-xl border-2 px-4 py-3 text-left text-sm font-semibold transition-all ${sel ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300' : 'border-slate-200 dark:border-border bg-white dark:bg-card text-slate-700 dark:text-foreground hover:border-slate-300 dark:hover:border-border hover:bg-slate-50 dark:hover:bg-muted/50'}`}>
                        {sub}
                        <ChevronRight className={`h-4 w-4 shrink-0 ${sel ? 'text-blue-500' : 'text-slate-300'}`} />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── HW/SW: Step 3 — details ── */}
            {ticketStep === 'hwdetails' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <button onClick={() => { setTicketStep('hwsub'); setTicketResult('idle'); }} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                    <ArrowLeft className="h-3.5 w-3.5" /> Back
                  </button>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-1 text-[10px] font-bold text-blue-700">
                      {hwCat?.icon} {hwCategory}
                    </span>
                    {hwSubcategory && (
                      <span className="inline-flex items-center rounded-full bg-slate-100 border border-slate-200 px-2.5 py-1 text-[10px] font-bold text-slate-600">
                        {hwSubcategory}
                      </span>
                    )}
                  </div>
                </div>
                {DetailsForm()}
              </div>
            )}

          </main>
        </div>
      </>
    );
  }

  /* ══ REQUEST CLEARANCE ═══════════════════════════════════════════════════ */
  if (screen === 'clearance') {
    return (
      <>
        <Head><title>Request Clearance — Asset AI</title></Head>
        {officeScript}
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex flex-col">
          <Header title="Request Clearance" onBack={() => { setScreen('home'); setClResult('idle'); }} />
          <main className="flex-1 overflow-auto p-4">
            {/* Info banner */}
            <div className="mb-4 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="h-4 w-4 text-amber-600 shrink-0" />
                <p className="text-sm font-bold text-amber-800">Asset Clearance Request</p>
              </div>
              <p className="text-xs text-amber-700">Submit a clearance request for a staff member. An admin will review and process the asset handover.</p>
            </div>

            {clResult === 'success' && (
              <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-3 text-sm text-emerald-800">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
                <div><p className="font-bold">Clearance request submitted!</p><p className="text-xs text-emerald-600 mt-0.5">An admin will review and initiate the asset handover process.</p></div>
              </div>
            )}
            {clResult === 'error' && clError && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" /> {clError}
              </div>
            )}

            <form onSubmit={submitClearance} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Staff Member Name <span className="text-red-400">*</span></label>
                <input type="text" value={clForm.staffName} onChange={e => setClForm(f => ({ ...f, staffName: e.target.value }))} placeholder="Full name"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Staff Email <span className="text-red-400">*</span></label>
                <input type="email" value={clForm.staffEmail} onChange={e => setClForm(f => ({ ...f, staffEmail: e.target.value }))} placeholder="email@company.com"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Reason <span className="text-red-400">*</span></label>
                <div className="grid grid-cols-2 gap-2">
                  {CLEARANCE_REASONS.map(r => (
                    <button key={r.value} type="button" onClick={() => setClForm(f => ({ ...f, reason: r.value }))}
                      className={`rounded-xl border-2 px-3 py-2.5 text-xs font-semibold text-left transition-all ${clForm.reason === r.value ? 'border-amber-400 bg-amber-50 text-amber-700 shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Additional Notes</label>
                <textarea value={clForm.notes} onChange={e => setClForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any additional context or instructions for the admin…" rows={3}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none resize-none transition" />
              </div>
              <button type="submit" disabled={clSubmitting}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-3 text-sm font-bold text-white shadow-sm hover:from-amber-600 hover:to-orange-700 disabled:opacity-50 disabled:pointer-events-none transition-all">
                {clSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {clSubmitting ? 'Submitting…' : 'Submit Clearance Request'}
              </button>
            </form>
          </main>
        </div>
      </>
    );
  }

  /* ══ MY TICKETS ══════════════════════════════════════════════════════════ */
  if (screen === 'mytickets') {
    /* ─── Ticket Detail View ─── */
    if (selectedTicket) {
      const t = selectedTicket;
      const sc = STATUS_CFG[t.status] ?? STATUS_CFG.OPEN;
      const pc = PRI_CFG[t.priority] ?? PRI_CFG.MEDIUM;
      const STEPS = ['OPEN','IN_PROGRESS','RESOLVED','CLOSED'] as const;
      const stepIdx = STEPS.indexOf(t.status);
      const stepLabels: Record<string, string> = { OPEN:'Open', IN_PROGRESS:'In Progress', RESOLVED:'Resolved', CLOSED:'Closed' };
      const stepColors: Record<string, string> = { OPEN:'bg-blue-500', IN_PROGRESS:'bg-amber-500', RESOLVED:'bg-emerald-500', CLOSED:'bg-slate-400' };

      return (
        <>
          <Head><title>{t.title} — Asset AI</title></Head>
          {officeScript}
          <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* Header */}
            <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200/80 bg-white/90 backdrop-blur-sm shrink-0">
              <button onClick={() => setSelectedTicket(null)} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors">
                <ArrowLeft className="h-3.5 w-3.5" /> My Tickets
              </button>
              <div className="flex items-center gap-1.5">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${sc.text}`} style={{ background: 'transparent' }}>
                  <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />{sc.label}
                </span>
                {!inNativeApp() && (
                  <button onClick={signOut} className="rounded-lg p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </header>

            {/* Scrollable body */}
            <div className="flex-1 overflow-auto">

              {/* Ticket hero card */}
              <div className="bg-white dark:bg-card border-b border-slate-100 dark:border-border px-4 py-4">
                <div className="flex items-center gap-1.5 flex-wrap mb-2">
                  <span className="font-mono text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-muted rounded-md px-2 py-0.5">{t.displayId || '#' + t.id.slice(0, 8)}</span>
                  <span className={`text-[10px] font-bold ${pc.color}`}>{pc.label} Priority</span>
                  {t.category && <span className="text-[10px] font-medium text-slate-400 dark:text-muted-foreground bg-slate-50 dark:bg-muted border border-slate-200 dark:border-border rounded-md px-1.5 py-0.5">{t.category}</span>}
                  {t.subcategory && <span className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900 rounded-md px-1.5 py-0.5">{t.subcategory}</span>}
                </div>
                <h2 className="text-base font-black text-slate-900 dark:text-foreground leading-snug">{t.title}</h2>
                {t.description && <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-muted-foreground line-clamp-3">{t.description}</p>}

                {/* Meta */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1.5 rounded-xl bg-slate-50 dark:bg-muted/50 border border-slate-100 dark:border-border px-3 py-2">
                    <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <div><p className="text-[9px] uppercase tracking-wider font-bold text-slate-400">Created</p><p className="text-xs font-semibold text-slate-700 dark:text-foreground">{timeAgo(t.createdAt)}</p></div>
                  </div>
                  {t.assignedTo?.email ? (
                    <div className="flex items-center gap-1.5 rounded-xl bg-violet-50 dark:bg-violet-950/40 border border-violet-100 dark:border-violet-900 px-3 py-2">
                      <Users className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                      <div><p className="text-[9px] uppercase tracking-wider font-bold text-violet-400">Assigned To</p><p className="text-xs font-semibold text-violet-700 dark:text-violet-300 truncate">{t.assignedTo.email.split('@')[0]}</p></div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 rounded-xl bg-slate-50 dark:bg-muted/50 border border-slate-100 dark:border-border px-3 py-2">
                      <Users className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                      <div><p className="text-[9px] uppercase tracking-wider font-bold text-slate-400">Assigned To</p><p className="text-xs text-slate-400 dark:text-muted-foreground">Unassigned</p></div>
                    </div>
                  )}
                </div>
              </div>

              {/* Progress tracker */}
              <div className="bg-white dark:bg-card border-b border-slate-100 dark:border-border px-4 py-3">
                <p className="text-[9px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 mb-2.5">Ticket Progress</p>
                <div className="flex items-center gap-1">
                  {STEPS.map((step, i) => {
                    const done = i <= stepIdx; const active = i === stepIdx;
                    return (
                      <div key={step} className="flex flex-1 flex-col items-center gap-1">
                        <div className={`h-1.5 w-full rounded-full transition-all duration-500 ${done ? stepColors[step] : 'bg-slate-100 dark:bg-slate-800'} ${active ? 'ring-1 ring-offset-1 ring-current dark:ring-offset-background opacity-100' : ''}`} />
                        <span className={`text-[9px] font-bold text-center leading-tight ${done ? (step === 'OPEN' ? 'text-blue-600 dark:text-blue-400' : step === 'IN_PROGRESS' ? 'text-amber-600 dark:text-amber-400' : step === 'RESOLVED' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400') : 'text-slate-300 dark:text-slate-600'}`}>
                          {stepLabels[step]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Activity timeline */}
              <div className="px-4 py-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[9px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500">Activity & Messages</p>
                  <button onClick={() => openTicketDetail(t)} className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors">Refresh</button>
                </div>

                {historyLoading ? (
                  <div className="space-y-3">
                    {[1,2,3].map(i => (
                      <div key={i} className="flex gap-2.5">
                        <div className="h-7 w-7 rounded-full bg-slate-100 animate-pulse shrink-0" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-2.5 w-24 rounded bg-slate-100 animate-pulse" />
                          <div className="h-10 w-full rounded-lg bg-slate-100 animate-pulse" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : ticketHistory.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-8 text-center rounded-2xl bg-slate-50 dark:bg-muted/30 border border-dashed border-slate-200 dark:border-border">
                    <MessageCircle className="h-8 w-8 text-slate-200 dark:text-slate-600" />
                    <p className="text-xs font-semibold text-slate-400 dark:text-muted-foreground">No activity yet</p>
                    <p className="text-[10px] text-slate-300 dark:text-slate-600">Comments from the support team will appear here</p>
                  </div>
                ) : (
                  <div className="relative space-y-0">
                    <div className="absolute bottom-2 left-3.5 top-2 w-px bg-slate-100 dark:bg-border" />
                    {[...ticketHistory].reverse().map((h: any, idx: number) => {
                      const isStaff = h.user?.email && h.user.email !== t.userId;
                      return (
                        <div key={h.id} className="relative flex gap-2.5 pb-4 last:pb-0">
                          {/* Avatar dot */}
                          <div className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-2 ring-white dark:ring-card text-[10px] font-black shadow-sm ${isStaff ? 'bg-gradient-to-br from-violet-500 to-indigo-600 text-white' : 'bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-600 dark:to-slate-700 text-slate-600 dark:text-slate-200'}`}>
                            {(h.user?.email?.[0] || '?').toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1 pt-0.5">
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 flex-wrap mb-1">
                              <span className={`font-bold ${isStaff ? 'text-violet-700' : 'text-slate-700'}`}>
                                {h.user?.email?.split('@')[0] || 'Unknown'}
                              </span>
                              {isStaff && <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-bold text-violet-600">Staff</span>}
                              <span className="text-slate-300">·</span>
                              <span>{timeAgo(h.createdAt)}</span>
                              {h.status && (
                                <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${STATUS_CFG[h.status]?.text ?? 'text-slate-500'}`}>
                                  <span className={`h-1 w-1 rounded-full ${STATUS_CFG[h.status]?.dot ?? 'bg-slate-400'}`} />
                                  {STATUS_CFG[h.status]?.label ?? h.status}
                                </span>
                              )}
                            </div>
                            <div className={`rounded-xl px-3 py-2 text-xs text-slate-700 leading-relaxed ${isStaff ? 'bg-violet-50 border border-violet-100' : 'bg-white border border-slate-100 shadow-sm'}`}>
                              {h.comment}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={historyEndRef} />
                  </div>
                )}
              </div>

              {/* Spacer for fixed comment box */}
              <div className="h-32" />
            </div>

            {/* Fixed comment box */}
            <div className="border-t border-slate-200 dark:border-border bg-white/95 dark:bg-card/95 backdrop-blur-sm px-4 py-3 shrink-0">
              {commentResult === 'success' && (
                <div className="mb-2 flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 text-xs text-emerald-700 font-semibold">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> Comment sent!
                </div>
              )}
              {commentResult === 'error' && (
                <div className="mb-2 flex items-center gap-1.5 rounded-lg bg-red-50 border border-red-200 px-2.5 py-1.5 text-xs text-red-700 font-semibold">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" /> Failed to send. Try again.
                </div>
              )}
              <form onSubmit={postComment} className="flex gap-2">
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Add a message or provide more info…"
                  rows={2}
                  className="flex-1 resize-none rounded-xl border border-slate-200 dark:border-border bg-slate-50 dark:bg-background px-3 py-2 text-xs text-slate-800 dark:text-foreground placeholder:text-slate-400 focus:border-indigo-400 dark:focus:border-primary focus:ring-2 focus:ring-indigo-400/20 dark:focus:ring-primary/30 outline-none transition"
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) postComment(e as any); }}
                />
                <button type="submit" disabled={commentSending || !comment.trim()}
                  className="self-end inline-flex items-center justify-center h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-sm hover:from-indigo-700 hover:to-violet-700 disabled:opacity-40 disabled:pointer-events-none transition-all">
                  {commentSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </form>
              <p className="mt-1 text-[9px] text-slate-400 text-center">Ctrl + Enter to send</p>
            </div>
          </div>
        </>
      );
    }

    /* ─── Ticket List View ─── */
    return (
      <>
        <Head><title>My Tickets — Asset AI</title></Head>
        {officeScript}
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex flex-col">
          <Header title="My Tickets" onBack={() => setScreen('home')} />
          <main className="flex-1 overflow-auto p-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-slate-500">{myTickets.length > 0 ? `${myTickets.length} recent ticket${myTickets.length !== 1 ? 's' : ''}` : 'No tickets yet'}</p>
              <button onClick={fetchMyTickets} disabled={myTicketsLoading} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors">
                {myTicketsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              </button>
            </div>

            {myTicketsLoading ? (
              <div className="space-y-2">
                {[1,2,3].map(i => (
                  <div key={i} className="h-20 animate-pulse rounded-xl bg-white border border-slate-100">
                    <div className="p-3 space-y-2">
                      <div className="h-3 w-3/4 rounded bg-slate-100" />
                      <div className="h-2.5 w-1/2 rounded bg-slate-100" />
                    </div>
                  </div>
                ))}
              </div>
            ) : myTickets.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <div className="h-16 w-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <List className="h-8 w-8 text-slate-300" />
                </div>
                <p className="font-semibold text-slate-600 text-sm">No tickets yet</p>
                <p className="text-xs text-slate-400">Tickets you submit will appear here</p>
                <button onClick={() => setScreen('ticket')} className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-xs font-bold text-white hover:from-indigo-700 hover:to-violet-700 transition-all">
                  <Ticket className="h-3.5 w-3.5" /> Submit a Ticket
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {myTickets.map((t: any) => {
                  const sc = STATUS_CFG[t.status] ?? STATUS_CFG.OPEN;
                  const pc = PRI_CFG[t.priority] ?? PRI_CFG.MEDIUM;
                  const hasAssignee = !!t.assignedTo?.email;
                  const unread = ticketUnreads[t.id] || 0;
                  const isPendingDlm = t.dlmApprovalStatus === 'PENDING_DLM';
                  const isRejectedDlm = t.dlmApprovalStatus === 'DLM_REJECTED';
                  const isApprovedDlm = t.dlmApprovalStatus === 'DLM_APPROVED';

                  return (
                    <div key={t.id} className="flex flex-col">
                      <button type="button" onClick={() => openTicketDetail(t)}
                        className={`relative w-full text-left shadow-sm hover:shadow-md transition-all group ${
                          isPendingDlm
                            ? 'rounded-t-2xl rounded-b-none border-2 border-b-0 border-amber-400 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 hover:border-amber-500'
                            : isRejectedDlm
                            ? 'rounded-t-2xl rounded-b-none border-2 border-b-0 border-red-300 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/40 dark:to-rose-950/30 hover:border-red-400'
                            : unread > 0
                            ? 'rounded-2xl border border-blue-300 dark:border-blue-700 bg-blue-50/40 dark:bg-blue-950/30 hover:border-blue-400'
                            : 'rounded-2xl border border-slate-100 dark:border-border bg-white dark:bg-card hover:border-indigo-200 dark:hover:border-indigo-800 hover:bg-indigo-50/20 dark:hover:bg-indigo-950/20'
                        } px-4 py-3.5`}>
                        {unread > 0 && (
                          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm animate-pulse z-10">
                            {unread}
                          </span>
                        )}
                        {isPendingDlm && (
                          <div className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 shadow-sm z-10">
                            <Clock className="h-3 w-3 text-white animate-pulse" />
                          </div>
                        )}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`font-mono text-[10px] font-bold ${isPendingDlm ? 'text-amber-600' : isRejectedDlm ? 'text-red-500' : 'text-slate-400'}`}>{t.displayId || '#' + t.id.slice(0, 8)}</span>
                            {isPendingDlm ? (
                              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-amber-100 border border-amber-300 text-amber-800">
                                <Clock className="h-2.5 w-2.5 animate-pulse" /> Pending DLM
                              </span>
                            ) : isRejectedDlm ? (
                              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-red-100 border border-red-300 text-red-700">
                                <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Rejected by DLM
                              </span>
                            ) : (
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${sc.text}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />{sc.label}
                              </span>
                            )}
                            <span className={`text-[10px] font-bold ${pc.color}`}>{pc.label}</span>
                            {unread > 0 && (
                              <span className="inline-flex items-center rounded-md bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-700">New update</span>
                            )}
                            {isApprovedDlm && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">✓ DLM Approved</span>
                            )}
                          </div>
                          <ChevronRight className={`h-4 w-4 shrink-0 transition-colors ${isPendingDlm ? 'text-amber-400 group-hover:text-amber-600' : isRejectedDlm ? 'text-red-300 group-hover:text-red-500' : unread > 0 ? 'text-blue-400' : 'text-slate-300 group-hover:text-indigo-400'}`} />
                        </div>
                        <p className={`text-sm font-bold line-clamp-2 leading-snug ${isPendingDlm ? 'text-amber-900' : isRejectedDlm ? 'text-red-900' : 'text-slate-800 dark:text-foreground'}`}>{t.title}</p>
                        {t.description && <p className={`text-xs mt-0.5 line-clamp-1 ${isPendingDlm ? 'text-amber-700' : isRejectedDlm ? 'text-red-600' : 'text-slate-400'}`}>{t.description}</p>}
                        <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400">
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{timeAgo(t.createdAt)}</span>
                          {hasAssignee && (
                            <span className="flex items-center gap-1 text-violet-600 font-semibold">
                              <Users className="h-3 w-3" />{t.assignedTo.email.split('@')[0]}
                            </span>
                          )}
                          {t.category && <span className="truncate">{t.category}</span>}
                        </div>
                      </button>

                      {/* DLM status footer strip */}
                      {isPendingDlm && (
                        <div className="flex items-center gap-2 rounded-b-2xl border-2 border-t-0 border-amber-400 bg-amber-100 px-4 py-2">
                          <Clock className="h-3.5 w-3.5 text-amber-600 flex-shrink-0 animate-pulse" />
                          <span className="text-[11px] font-bold text-amber-800 flex-1">Awaiting your manager's approval</span>
                          <span className="text-[10px] text-amber-600 bg-amber-200 px-1.5 py-0.5 rounded-full font-semibold">DLM REVIEW</span>
                        </div>
                      )}
                      {isRejectedDlm && (
                        <div className="flex items-center gap-2 rounded-b-2xl border-2 border-t-0 border-red-300 bg-red-100 px-4 py-2">
                          <span className="text-[11px] font-bold text-red-700 flex-1">❌ Rejected by manager — contact your DLM for details</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </main>
        </div>
      </>
    );
  }

  /* ══ MY ASSETS ═══════════════════════════════════════════════════════════ */
  if (screen === 'myassets') {
    const assetStatusDot: Record<string, string> = {
      ACTIVE: 'bg-emerald-500', INACTIVE: 'bg-slate-400', MAINTENANCE: 'bg-amber-500', DISPOSED: 'bg-red-500',
    };
    return (
      <>
        <Head><title>My Assets — Asset AI</title></Head>
        {officeScript}
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex flex-col">
          <Header title="My Assets" onBack={() => setScreen('home')} />
          <main className="flex-1 overflow-auto p-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-slate-500">{myAssets.length} asset{myAssets.length !== 1 ? 's' : ''} assigned to you</p>
              <button onClick={fetchMyAssets} disabled={myAssetsLoading} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors">
                {myAssetsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              </button>
            </div>

            {myAssetsLoading ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />)}
              </div>
            ) : myAssets.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <Package className="h-10 w-10 text-slate-300" />
                <p className="font-semibold text-slate-600 text-sm">No assets assigned</p>
                <p className="text-xs text-slate-400">Assets assigned to you will appear here</p>
              </div>
            ) : (
              <div className="space-y-2">
                {myAssets.map((a: any) => (
                  <div key={a.id} className="rounded-xl border border-slate-100 dark:border-border bg-white dark:bg-card overflow-hidden shadow-sm">
                    <div className="flex items-center gap-3 px-3 py-3">
                      {/* thumbnail */}
                      <div className="h-12 w-12 shrink-0 rounded-xl bg-slate-100 overflow-hidden">
                        {a.imageUrl
                          ? <img src={a.imageUrl} alt={a.name} className="h-full w-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          : <div className="flex h-full items-center justify-center"><Package className="h-5 w-5 text-slate-300" /></div>
                        }
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-800 line-clamp-1">{a.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">{a.assetId || a.id?.slice(0, 8)}</p>
                        <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-500">
                          <span className={`h-1.5 w-1.5 rounded-full ${assetStatusDot[a.status] ?? 'bg-slate-400'}`} />
                          {a.status}
                          {a.type && <><span>·</span><Tag className="h-2.5 w-2.5" />{a.type}</>}
                        </div>
                      </div>
                    </div>
                    {(a.floorNumber || a.roomNumber) && (
                      <div className="border-t border-slate-50 px-3 py-1.5 flex items-center gap-1 text-[10px] text-slate-400">
                        <MapPin className="h-3 w-3" />
                        Floor {a.floorNumber}{a.roomNumber ? ` · Room ${a.roomNumber}` : ''}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </main>
        </div>
      </>
    );
  }

  return null;
}
