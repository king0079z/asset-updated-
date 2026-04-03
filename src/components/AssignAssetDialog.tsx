// @ts-nocheck
import { useState, useEffect, useCallback, useRef } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import {
  UserCheck, Search, Loader2, X, Check, User, Mail, UserX, Building2,
  Ticket, ArrowRight, PenLine, FileSignature, Shield, CheckCircle,
  Sparkles, AlertCircle, Plus, ChevronRight,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface SystemUser {
  id: string;
  email: string;
  name?: string | null;
  role?: string;
  isAdmin?: boolean;
}

interface AssignAssetDialogProps {
  asset: { id: string; name: string; type?: string; assetId?: string; floorNumber?: string; roomNumber?: string; assignedToName?: string | null; assignedToEmail?: string | null } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssigned: () => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  HIGH: 'bg-red-100 text-red-700', MEDIUM: 'bg-amber-100 text-amber-700',
  LOW: 'bg-green-100 text-green-700', URGENT: 'bg-red-200 text-red-800',
};

type Step = 'select' | 'sign';

async function generateSignedFormPng(
  signatureDataUrl: string,
  asset: any,
  assignee: { name: string; email: string },
  ticket: any | null,
): Promise<string> {
  const W = 794, H = 900;
  const dpr = 1; // keep at 1× to limit payload size
  const canvas = document.createElement('canvas');
  canvas.width = W * dpr; canvas.height = H * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, '#4f46e5'); grad.addColorStop(1, '#0284c7');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, 88);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 20px system-ui,sans-serif';
  ctx.fillText('ASSET ASSIGNMENT AGREEMENT', 40, 34);
  ctx.font = '12px system-ui,sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText('AssetXAI — Official Signed Document', 40, 56);
  ctx.fillText(`Generated: ${new Date().toLocaleString()}`, 40, 74);

  const drawDiv = (y: number) => { ctx.fillStyle = '#e2e8f0'; ctx.fillRect(40, y, W - 80, 1); };
  const drawSec = (t: string, y: number) => {
    ctx.fillStyle = '#f1f5f9'; ctx.fillRect(40, y, W - 80, 28);
    ctx.fillStyle = '#1e40af'; ctx.font = 'bold 11px system-ui,sans-serif'; ctx.fillText(t, 52, y + 19); return y + 28;
  };
  const drawF = (l: string, v: string, x: number, y: number) => {
    ctx.fillStyle = '#64748b'; ctx.font = '9px system-ui,sans-serif'; ctx.fillText(l.toUpperCase(), x, y);
    ctx.fillStyle = '#0f172a'; ctx.font = '12px system-ui,sans-serif'; ctx.fillText((v || '—').slice(0, 50), x, y + 14);
  };

  let y = 108;
  y = drawSec('ASSET INFORMATION', y); y += 12;
  drawF('Name', asset?.name, 52, y); drawF('Type', asset?.type, 320, y);
  drawF('Asset ID', asset?.assetId, 560, y); y += 40;
  drawDiv(y); y += 12;
  y = drawSec('ASSIGNED TO', y); y += 12;
  drawF('Name', assignee.name || assignee.email, 52, y);
  drawF('Email', assignee.email, 320, y);
  drawF('Date', new Date().toLocaleDateString(), 560, y); y += 40;
  drawDiv(y); y += 12;
  if (ticket) {
    y = drawSec('LINKED TICKET', y); y += 12;
    drawF('Ticket', ticket.displayId || ticket.id?.slice(0, 8), 52, y);
    drawF('Title', ticket.title, 320, y);
    drawF('Priority', ticket.priority, 560, y); y += 40; drawDiv(y); y += 12;
  }
  y = drawSec('TERMS & CONDITIONS', y); y += 12;
  const terms = [
    '1. The assignee acknowledges receipt of the asset in satisfactory condition.',
    '2. The asset shall be used only for authorized organizational purposes.',
    '3. Any damage or loss must be reported immediately to the asset manager.',
    '4. The asset remains organization property and must be returned on request.',
  ];
  ctx.fillStyle = '#374151'; ctx.font = '11px system-ui,sans-serif';
  terms.forEach((t, i) => ctx.fillText(t, 52, y + i * 20));
  y += terms.length * 20 + 20; drawDiv(y); y += 12;
  y = drawSec('DIGITAL SIGNATURE', y); y += 12;
  ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
  ctx.strokeRect(52, y, 300, 120); ctx.setLineDash([]);
  await new Promise<void>(r => { const i = new Image(); i.onload = () => { ctx.drawImage(i, 52, y, 300, 120); r(); }; i.onerror = r; i.src = signatureDataUrl; });
  ctx.fillStyle = '#94a3b8'; ctx.font = '9px system-ui,sans-serif';
  ctx.fillText('Authorized Signature', 52, y + 134); ctx.fillText(assignee.name || assignee.email, 52, y + 148);
  ctx.fillText(new Date().toISOString(), 52, y + 162);
  ctx.fillStyle = 'rgba(16,185,129,0.08)'; ctx.strokeStyle = '#10b981'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(420, y + 12); ctx.lineTo(720, y + 12); ctx.quadraticCurveTo(730, y + 12, 730, y + 22);
  ctx.lineTo(730, y + 102); ctx.quadraticCurveTo(730, y + 112, 720, y + 112); ctx.lineTo(420, y + 112);
  ctx.quadraticCurveTo(410, y + 112, 410, y + 102); ctx.lineTo(410, y + 22); ctx.quadraticCurveTo(410, y + 12, 420, y + 12);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#065f46'; ctx.font = 'bold 12px system-ui,sans-serif'; ctx.fillText('✓ DIGITALLY SIGNED', 428, y + 36);
  ctx.fillStyle = '#047857'; ctx.font = '10px system-ui,sans-serif';
  ctx.fillText(new Date().toISOString(), 428, y + 54); ctx.fillText('Platform: AssetXAI', 428, y + 70);
  ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, H - 40, W, 40);
  ctx.fillStyle = '#94a3b8'; ctx.font = '9px system-ui,sans-serif';
  ctx.fillText('Electronically generated by AssetXAI. Legally binding upon signature.', 40, H - 18);
  // Use JPEG at 80% quality for much smaller file size vs PNG
  return canvas.toDataURL('image/jpeg', 0.8);
}

export function AssignAssetDialog({ asset, open, onOpenChange, onAssigned }: AssignAssetDialogProps) {
  const { toast } = useToast();
  const dialogOpenedAt = useRef<number>(0);
  useEffect(() => { if (open) dialogOpenedAt.current = Date.now(); }, [open]);
  const preventRecentOutsideClose = useCallback((e: Event) => { if (Date.now() - dialogOpenedAt.current < 900) e.preventDefault(); }, []);

  const [tab, setTab] = useState<'system' | 'manual'>('system');
  const [step, setStep] = useState<Step>('select');
  const [searchQuery, setSearchQuery] = useState('');
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [unassigning, setUnassigning] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SystemUser | null>(null);
  const [manualName, setManualName] = useState('');
  const [manualEmail, setManualEmail] = useState('');

  // Signature step state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const [hasSig, setHasSig] = useState(false);
  const [userTickets, setUserTickets] = useState<any[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [newTicket, setNewTicket] = useState({ title: '', description: '', priority: 'MEDIUM' });
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [createdTicket, setCreatedTicket] = useState<any>(null);

  const activeTicket = createdTicket ?? userTickets.find(t => t.id === selectedTicketId);
  const assigneeName = tab === 'system' ? (selectedUser?.name || selectedUser?.email || '') : manualName;

  useEffect(() => {
    if (!open) {
      setStep('select'); setSearchQuery(''); setSelectedUser(null);
      setManualName(''); setManualEmail(''); setTab('system');
      setHasSig(false); setSelectedTicketId(null); setCreatedTicket(null);
      setShowNewTicket(false); setUserTickets([]);
    }
  }, [open]);

  useEffect(() => {
    if (open && tab === 'system') {
      setLoadingUsers(true);
      fetch('/api/users?limit=50').then(r => r.ok ? r.json() : [])
        .then(data => setSystemUsers(Array.isArray(data) ? data : data.users || []))
        .catch(() => setSystemUsers([])).finally(() => setLoadingUsers(false));
    }
  }, [open, tab]);

  // Init canvas on sign step — cap DPR at 2 to keep signature JPEG small
  useEffect(() => {
    if (step !== 'sign' || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    setHasSig(false);
  }, [step]);

  const filteredUsers = systemUsers.filter(u => {
    const q = searchQuery.toLowerCase();
    return !q || (u.email || '').toLowerCase().includes(q) || (u.role || '').toLowerCase().includes(q);
  });

  const getPos = (e: any) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    if (e.touches) return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const startDraw = (e: any) => { e.preventDefault(); isDrawing.current = true; const p = getPos(e); const ctx = canvasRef.current!.getContext('2d')!; ctx.beginPath(); ctx.moveTo(p.x, p.y); lastPos.current = p; };
  const draw = (e: any) => { e.preventDefault(); if (!isDrawing.current) return; const p = getPos(e); const ctx = canvasRef.current!.getContext('2d')!; if (lastPos.current) { const mx = (lastPos.current.x + p.x) / 2, my = (lastPos.current.y + p.y) / 2; ctx.quadraticCurveTo(lastPos.current.x, lastPos.current.y, mx, my); } ctx.lineTo(p.x, p.y); ctx.stroke(); lastPos.current = p; setHasSig(true); };
  const stopDraw = () => { isDrawing.current = false; lastPos.current = null; };
  const clearSig = () => { const c = canvasRef.current!; c.getContext('2d')!.clearRect(0, 0, c.width, c.height); setHasSig(false); };

  const handleContinueToSign = async () => {
    if (tab === 'system' && !selectedUser) return;
    if (tab === 'manual' && !manualName.trim()) return;
    setLoadingTickets(true);
    // Use dedicated endpoint to fetch tickets raised by OR assigned to this user
    if (selectedUser?.id) {
      try {
        const r = await fetch(`/api/tickets/for-user?userId=${encodeURIComponent(selectedUser.id)}`, { credentials: 'include' });
        if (r.ok) {
          const data = await r.json();
          setUserTickets(data.tickets || []);
        } else {
          setUserTickets([]);
        }
      } catch { setUserTickets([]); }
    } else {
      setUserTickets([]);
    }
    setLoadingTickets(false);
    const assigneeName = tab === 'system' ? (selectedUser!.name || selectedUser!.email) : manualName;
    setNewTicket(p => ({
      ...p,
      title: `Asset Assignment: ${asset?.name || 'Asset'}`,
      description: `Assignment of ${asset?.name} to ${assigneeName}. Please review and acknowledge receipt.`,
    }));
    setStep('sign');
  };

  const handleCreateTicket = async () => {
    if (!newTicket.title.trim()) { toast({ variant: 'destructive', title: 'Title required' }); return; }
    setCreatingTicket(true);
    try {
      const body = {
        title: newTicket.title.trim(),
        description: newTicket.description.trim() || `Asset assignment ticket for ${assigneeName}.`,
        priority: newTicket.priority,
        assetId: asset?.id || undefined,
        assignedToId: selectedUser?.id || undefined,
        ticketType: 'REQUEST',
        category: 'ASSET_ASSIGNMENT',
      };
      const r = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      });
      if (r.ok) {
        const t = await r.json();
        setCreatedTicket(t);
        setSelectedTicketId(null);
        setShowNewTicket(false);
        toast({ title: '✓ Ticket created', description: `Ticket "${body.title}" has been created and linked.` });
      } else {
        const err = await r.json().catch(() => ({}));
        toast({ variant: 'destructive', title: 'Failed to create ticket', description: err.error || 'Please try again.' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Failed to create ticket' });
    } finally { setCreatingTicket(false); }
  };

  const handleSignAndAssign = async () => {
    if (!hasSig) { toast({ variant: 'destructive', title: 'Signature required', description: 'Please draw your signature before completing.' }); return; }
    if (!asset) return;
    // Compress signature to a small JPEG regardless of device DPR
    const rawCanvas = canvasRef.current!;
    const sigCanvas = document.createElement('canvas');
    sigCanvas.width = 400;
    sigCanvas.height = 130;
    const sigCtx = sigCanvas.getContext('2d')!;
    sigCtx.fillStyle = '#ffffff';
    sigCtx.fillRect(0, 0, 400, 130);
    sigCtx.drawImage(rawCanvas, 0, 0, rawCanvas.width, rawCanvas.height, 0, 0, 400, 130);
    const signatureDataUrl = sigCanvas.toDataURL('image/jpeg', 0.85);
    const assignee = tab === 'system'
      ? { name: selectedUser!.name || selectedUser!.email, email: selectedUser!.email, id: selectedUser!.id }
      : { name: manualName, email: manualEmail, id: null };
    const linkedTicketId = createdTicket?.id || selectedTicketId || null;
    if (!linkedTicketId) {
      toast({ variant: 'destructive', title: 'Ticket required', description: 'Please select an existing ticket or create a new one before signing.' });
      setSaving(false);
      return;
    }

    setSaving(true);
    try {
      // ── Step 1: Generate signed form (client-side, stays in browser) ──────
      const pdfDataUrl = await generateSignedFormPng(signatureDataUrl, asset, assignee, activeTicket || null);

      // ── Step 2: Core assignment API — send only small fields, NO blobs ────
      const res = await fetch(`/api/assets/${asset.id}/assign-with-signature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignedToName:  assignee.name,
          assignedToEmail: assignee.email,
          assignedToId:    assignee.id,
          ticketId:        linkedTicketId,
          signatureDataUrl,                  // small canvas PNG only
          signedAt:        new Date().toISOString(),
          // pdfDataUrl intentionally NOT sent here — uploaded separately below
        }),
        credentials: 'include',
      });

      if (!res.ok) {
        // Safe error parsing — server might return HTML on fatal crash
        let errMsg = `Server error (${res.status})`;
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const errData = await res.json().catch(() => ({}));
          errMsg = errData.error || errData.detail || errMsg;
        }
        throw new Error(errMsg);
      }

      // ── Step 3: Offer immediate client-side download of the signed form ───
      try {
        const a = document.createElement('a');
        a.href = pdfDataUrl;
        a.download = `Assignment-Agreement-${asset.name?.replace(/\s+/g, '-') || 'Asset'}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch { /* non-critical */ }

      // ── Step 4: Upload PDF to asset documents (background, non-critical) ──
      try {
        const blob = await (await fetch(pdfDataUrl)).blob();
        const fd = new FormData();
        fd.append('document', blob, `Assignment-Agreement-${asset.assetId || asset.id}.jpg`);
        fd.append('assetId', asset.id);
        await fetch('/api/assets/documents/upload', {
          method: 'POST',
          body: fd,
          credentials: 'include',
        });
      } catch (uploadErr) {
        console.warn('[AssignAssetDialog] PDF upload to documents failed (non-critical):', uploadErr);
      }

      toast({ title: '✓ Asset assigned & signed', description: `${asset.name} has been assigned to ${assignee.name}. Signed agreement downloaded and stored.` });
      onAssigned();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Assignment failed', description: err.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const handleUnassign = async () => {
    if (!asset) return;
    setUnassigning(true);
    try {
      const res = await fetch(`/api/assets/${asset.id}/assign`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to unassign');
      toast({ title: 'Asset unassigned', description: `${asset.name} is now unassigned.` });
      onAssigned(); onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Failed to unassign', description: err.message, variant: 'destructive' });
    } finally { setUnassigning(false); }
  };

  if (!asset) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden max-h-[92vh] overflow-y-auto" onPointerDownOutside={preventRecentOutsideClose} onInteractOutside={preventRecentOutsideClose}>
        {/* Gradient top bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-sky-500" />

        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b bg-gradient-to-br from-slate-900 to-indigo-950">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-white text-lg">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center">
                {step === 'select' ? <UserCheck className="h-4 w-4 text-white" /> : <FileSignature className="h-4 w-4 text-white" />}
              </div>
              {step === 'select' ? 'Assign Asset' : 'Sign & Assign'}
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-sm">
              {step === 'select'
                ? <>Select recipient for <strong className="text-slate-200">{asset.name}</strong></>
                : <>Review details and provide digital signature</>}
            </DialogDescription>
          </DialogHeader>

          {/* Step indicators */}
          <div className="flex items-center gap-2 mt-4">
            {[{ key: 'select', label: 'Select User', icon: User }, { key: 'sign', label: 'Sign Agreement', icon: PenLine }].map((s, i) => {
              const active = step === s.key;
              const done = step === 'sign' && i === 0;
              return (
                <div key={s.key} className="flex items-center gap-2">
                  {i > 0 && <div className={`w-8 h-0.5 rounded-full ${done || active ? 'bg-indigo-400' : 'bg-slate-700'}`} />}
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${active ? 'bg-indigo-600 text-white' : done ? 'bg-emerald-800/60 text-emerald-300' : 'bg-slate-800 text-slate-500'}`}>
                    {done ? <CheckCircle className="w-3 h-3" /> : <s.icon className="w-3 h-3" />}{s.label}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Current assignment banner */}
          {asset.assignedToName && step === 'select' && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-amber-950/50 border border-amber-700/40 px-4 py-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-amber-400 shrink-0" />
                <div>
                  <p className="text-xs text-amber-400 font-semibold uppercase tracking-widest">Currently Assigned To</p>
                  <p className="text-sm font-bold text-amber-200">{asset.assignedToName}</p>
                  {asset.assignedToEmail && <p className="text-xs text-amber-400/70">{asset.assignedToEmail}</p>}
                </div>
              </div>
              <button onClick={handleUnassign} disabled={unassigning}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold transition-colors disabled:opacity-50">
                {unassigning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserX className="h-3.5 w-3.5" />}Unassign
              </button>
            </div>
          )}
        </div>

        {/* ── STEP 1: SELECT ── */}
        {step === 'select' && (
          <>
            <div className="px-6 pt-4 flex gap-1 border-b border-slate-200 dark:border-slate-700 pb-0 bg-white dark:bg-slate-950">
              {[{ key: 'system', icon: User, label: 'System Users' }, { key: 'manual', icon: Building2, label: 'Staff / Manual' }].map(t => (
                <button key={t.key} onClick={() => setTab(t.key as any)}
                  className={`px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${tab === t.key ? 'border-indigo-500 text-indigo-600 dark:text-indigo-300' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}>
                  <t.icon className="h-4 w-4 inline mr-1.5" />{t.label}
                </button>
              ))}
            </div>

            <div className="px-6 py-4 space-y-4 bg-white dark:bg-slate-950">
              {tab === 'system' ? (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input type="text" placeholder="Search by email or role..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 text-sm focus:outline-none focus:border-indigo-400" />
                    {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="h-3.5 w-3.5" /></button>}
                  </div>
                  <ScrollArea className="h-52">
                    {loadingUsers ? (
                      <div className="flex items-center justify-center h-32 text-slate-400"><Loader2 className="h-5 w-5 animate-spin mr-2" />Loading users...</div>
                    ) : filteredUsers.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-32 text-slate-500"><User className="h-8 w-8 mb-2 opacity-40" /><p className="text-sm">No users found</p></div>
                    ) : (
                      <div className="space-y-1.5 pr-2">
                        {filteredUsers.filter(u => u?.id).map(u => {
                          const initials = (u.email ?? '?').slice(0, 2).toUpperCase();
                          const roleLabel = u.isAdmin ? 'Admin' : (u.role || 'Staff');
                          return (
                            <button key={u.id} onClick={() => setSelectedUser(selectedUser?.id === u.id ? null : u)}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${selectedUser?.id === u.id ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-600'}`}>
                              <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-300 font-bold text-sm shrink-0">{initials}</div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm truncate">{u.email}</p>
                                <span className={`text-[10px] uppercase font-bold tracking-wide ${u.isAdmin ? 'text-rose-500' : u.role === 'MANAGER' ? 'text-amber-500' : 'text-indigo-500'}`}>{roleLabel}</span>
                              </div>
                              {selectedUser?.id === u.id && <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center shrink-0"><Check className="h-3 w-3 text-white" /></div>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </ScrollArea>
                  {selectedUser && (
                    <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-700 px-4 py-3 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-sm font-bold shrink-0">{(selectedUser.email ?? '?').slice(0, 2).toUpperCase()}</div>
                      <div><p className="text-xs text-indigo-500 dark:text-indigo-400 font-semibold uppercase tracking-widest">Selected</p><p className="text-sm font-bold text-slate-800 dark:text-white truncate">{selectedUser.email}</p></div>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Full Name *</label>
                    <input type="text" value={manualName} onChange={e => setManualName(e.target.value)} placeholder="e.g. Ahmed Al-Rashid"
                      className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-indigo-400" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Email Address</label>
                    <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input type="email" value={manualEmail} onChange={e => setManualEmail(e.target.value)} placeholder="e.g. ahmed@company.com"
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-indigo-400" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 pb-6 flex justify-between gap-3 border-t border-slate-200 dark:border-slate-700 pt-4 bg-white dark:bg-slate-950">
              <button onClick={() => onOpenChange(false)} className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Cancel</button>
              <button onClick={handleContinueToSign} disabled={loadingTickets || (tab === 'system' && !selectedUser) || (tab === 'manual' && !manualName.trim())}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white text-sm font-bold transition-colors disabled:opacity-50">
                {loadingTickets ? <Loader2 className="h-4 w-4 animate-spin" /> : <><FileSignature className="h-4 w-4" />Continue to Sign <ArrowRight className="h-4 w-4" /></>}
              </button>
            </div>
          </>
        )}

        {/* ── STEP 2: SIGN ── */}
        {step === 'sign' && (
          <div className="px-6 py-5 space-y-5 bg-white dark:bg-slate-950">
            {/* Summary card */}
            <div className="rounded-xl border bg-slate-50 dark:bg-slate-900 overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-600 to-sky-600 px-4 py-3 text-white">
                <div className="flex items-center gap-2"><FileSignature className="w-4 h-4" /><span className="font-bold text-sm">Asset Assignment Agreement</span></div>
              </div>
              <div className="p-4 grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-[10px] uppercase font-semibold text-slate-400">Asset</p><p className="font-semibold text-slate-900 dark:text-white">{asset.name}</p><p className="text-xs text-slate-500">{asset.type}</p></div>
                <div><p className="text-[10px] uppercase font-semibold text-slate-400">Assigned To</p>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {tab === 'system' ? (selectedUser?.name || selectedUser?.email) : manualName}
                  </p>
                  <p className="text-xs text-slate-500">{tab === 'system' ? selectedUser?.email : manualEmail || '—'}</p>
                </div>
                {activeTicket && (
                  <div className="col-span-2"><p className="text-[10px] uppercase font-semibold text-slate-400">Linked Ticket</p>
                    <div className="flex items-center gap-2 mt-0.5"><Ticket className="w-3.5 h-3.5 text-purple-500" /><span className="text-xs font-mono text-slate-400">{activeTicket.displayId || activeTicket.id?.slice(0, 8)}</span><span className="font-medium text-slate-800 dark:text-slate-200">{activeTicket.title}</span></div>
                  </div>
                )}
              </div>
            </div>

            {/* ── TICKET SECTION — MANDATORY ───────────────────────────────── */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-3 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <Ticket className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide">Link to Ticket</span>
                  <span className="text-[9px] bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400 px-1.5 py-0.5 rounded-full font-bold uppercase">Required</span>
                </div>
                {loadingTickets && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
              </div>

              <div className="p-3 space-y-2.5">
                {/* Active selection display */}
                {(createdTicket || selectedTicketId) && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg border-2 border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 truncate">
                        {createdTicket?.title || userTickets.find(t => t.id === selectedTicketId)?.title}
                      </p>
                      <p className="text-[10px] text-emerald-600 font-mono">
                        {createdTicket ? (createdTicket.displayId || 'New ticket') : userTickets.find(t => t.id === selectedTicketId)?.displayId || '—'}
                        {createdTicket && <span className="ml-1 text-emerald-500">• Just created</span>}
                      </p>
                    </div>
                    <button onClick={() => { setCreatedTicket(null); setSelectedTicketId(null); }}
                      className="p-0.5 rounded-md text-emerald-500 hover:text-emerald-700 hover:bg-emerald-100 transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Existing tickets list */}
                {!createdTicket && !showNewTicket && (
                  <>
                    {loadingTickets ? (
                      <div className="flex items-center justify-center py-6 text-slate-400">
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        <span className="text-xs">Loading tickets for this user…</span>
                      </div>
                    ) : userTickets.length > 0 ? (
                      <>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wide">
                          {userTickets.length} ticket{userTickets.length !== 1 ? 's' : ''} found for this user — select one:
                        </p>
                        <div className="space-y-1.5 max-h-44 overflow-y-auto pr-0.5">
                          {userTickets.map(t => {
                            const isSelected = selectedTicketId === t.id;
                            const statusColor: Record<string, string> = {
                              OPEN: 'bg-blue-100 text-blue-700', IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
                              PENDING: 'bg-orange-100 text-orange-700', RESOLVED: 'bg-green-100 text-green-700',
                              CLOSED: 'bg-slate-100 text-slate-500', ESCALATED: 'bg-red-100 text-red-700',
                            };
                            return (
                              <button key={t.id} onClick={() => setSelectedTicketId(isSelected ? null : t.id)}
                                className={`w-full text-left flex items-start gap-2.5 p-2.5 rounded-lg border-2 transition-all ${isSelected ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 shadow-sm' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'}`}>
                                <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-all ${isSelected ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300 dark:border-slate-600'}`}>
                                  {isSelected && <Check className="w-3 h-3 text-white" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                    {t.displayId && <span className="text-[10px] font-mono text-slate-400">{t.displayId}</span>}
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${statusColor[t.status] || 'bg-gray-100 text-gray-600'}`}>{t.status}</span>
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${PRIORITY_COLORS[t.priority] || 'bg-gray-100 text-gray-600'}`}>{t.priority}</span>
                                  </div>
                                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{t.title}</p>
                                  {t.asset && <p className="text-[10px] text-slate-400 mt-0.5">Asset: {t.asset.name}</p>}
                                  <p className="text-[10px] text-slate-400">{new Date(t.createdAt).toLocaleDateString()}</p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center py-4 text-center">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-2">
                          <Ticket className="w-5 h-5 text-slate-400" />
                        </div>
                        <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">No open tickets for this user</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Create a new ticket below to proceed with the assignment</p>
                      </div>
                    )}

                    {/* Create new ticket button */}
                    {!selectedTicketId && (
                      <button onClick={() => setShowNewTicket(true)}
                        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border-2 border-dashed border-indigo-300 dark:border-indigo-600 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-all">
                        <Plus className="w-3.5 h-3.5" />
                        {userTickets.length > 0 ? 'Or create a new ticket instead' : 'Create a New Ticket'}
                      </button>
                    )}
                  </>
                )}

                {/* New ticket form */}
                {showNewTicket && !createdTicket && (
                  <div className="p-3 rounded-xl border border-indigo-200 dark:border-indigo-700 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Plus className="w-3.5 h-3.5 text-indigo-600" />
                        <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">Create New Ticket</span>
                      </div>
                      <button onClick={() => setShowNewTicket(false)} className="p-0.5 rounded text-slate-400 hover:text-slate-600">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-semibold text-slate-500 block mb-1">Title *</label>
                      <Input value={newTicket.title} onChange={e => setNewTicket(p => ({ ...p, title: e.target.value }))}
                        placeholder="e.g. Asset assignment for new employee" className="h-8 text-xs" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-semibold text-slate-500 block mb-1">Description</label>
                      <Input value={newTicket.description} onChange={e => setNewTicket(p => ({ ...p, description: e.target.value }))}
                        placeholder="Brief description…" className="h-8 text-xs" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-semibold text-slate-500 block mb-1">Priority</label>
                      <Select value={newTicket.priority} onValueChange={v => setNewTicket(p => ({ ...p, priority: v }))}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="LOW">Low</SelectItem>
                          <SelectItem value="MEDIUM">Medium</SelectItem>
                          <SelectItem value="HIGH">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setShowNewTicket(false)}
                        className="flex-1 py-1.5 rounded-lg border border-slate-300 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-colors">
                        Cancel
                      </button>
                      <button onClick={handleCreateTicket} disabled={creatingTicket || !newTicket.title.trim()}
                        className="flex-1 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors">
                        {creatingTicket ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                        {creatingTicket ? 'Creating…' : 'Create & Link Ticket'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Signature canvas */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5"><PenLine className="w-4 h-4 text-indigo-600" /><span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Draw Signature</span></div>
                <button onClick={clearSig} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"><X className="w-3 h-3" />Clear</button>
              </div>
              <div className={`relative rounded-xl border-2 overflow-hidden transition-colors ${hasSig ? 'border-indigo-400' : 'border-dashed border-slate-300 dark:border-slate-600'} bg-white dark:bg-slate-900`} style={{ height: '130px' }}>
                {!hasSig && <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-slate-300 dark:text-slate-600"><PenLine className="w-7 h-7 mb-1" /><span className="text-xs">Sign here with mouse or finger</span></div>}
                <canvas ref={canvasRef} style={{ width: '100%', height: '100%', touchAction: 'none', cursor: 'crosshair' }}
                  onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
                  onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw} />
              </div>
              {!hasSig && <p className="text-xs text-amber-600 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />Signature is required</p>}
            </div>

            {/* Shield notice */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300">
              <Shield className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>Signature will be stored in the asset's history with timestamp. A confirmation email will be sent automatically.</span>
            </div>

            <div className="flex gap-3 border-t border-slate-200 dark:border-slate-700 pt-4">
              <button onClick={() => setStep('select')} className="flex-1 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">← Back</button>
              <button onClick={handleSignAndAssign} disabled={saving || !hasSig || (!createdTicket && !selectedTicketId)}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-sm font-bold transition-colors disabled:opacity-50"
                title={!createdTicket && !selectedTicketId ? 'Select or create a ticket first' : !hasSig ? 'Draw your signature first' : ''}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {saving ? 'Processing…' : (!createdTicket && !selectedTicketId) ? 'Select a Ticket First' : !hasSig ? 'Draw Signature First' : 'Sign & Assign Asset'}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
