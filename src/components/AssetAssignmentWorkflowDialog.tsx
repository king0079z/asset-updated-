// @ts-nocheck
'use client';
import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import {
  Ticket, User, CheckCircle, ArrowRight, PenLine, Download,
  Loader2, Plus, X, FileCheck, Mail, Shield, ChevronRight,
  Sparkles, Clock, Star, AlertCircle, Package, FileSignature,
} from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

type Step = 'ticket' | 'signature' | 'done';

interface WorkflowResult {
  ticketId: string | null;
  signatureDataUrl: string;
  pdfDataUrl: string;
  newTicketTitle?: string;
}

interface AssetAssignmentWorkflowDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  assetFormData: Record<string, any>;
  assignee: { id: string; email: string; name: string };
  userTickets: any[];
  onComplete: (result: WorkflowResult) => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  HIGH: 'bg-red-100 text-red-700 border-red-200',
  MEDIUM: 'bg-amber-100 text-amber-700 border-amber-200',
  LOW: 'bg-green-100 text-green-700 border-green-200',
  URGENT: 'bg-red-200 text-red-800 border-red-300',
};

export function AssetAssignmentWorkflowDialog({
  open, onOpenChange, assetFormData, assignee, userTickets, onComplete,
}: AssetAssignmentWorkflowDialogProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('ticket');

  // Ticket step state
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [showNewTicketForm, setShowNewTicketForm] = useState(false);
  const [newTicket, setNewTicket] = useState({
    title: `Asset Assignment: ${assetFormData?.name || 'Asset'}`,
    description: `Asset assignment workflow for ${assetFormData?.name || 'Asset'} (${assetFormData?.type || ''}).`,
    priority: 'MEDIUM',
  });
  const [createdTicket, setCreatedTicket] = useState<any>(null);
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  // Signature step state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const [hasSig, setHasSig] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const activeTicket = createdTicket ?? userTickets.find(t => t.id === selectedTicketId);

  // Reset when opened
  useEffect(() => {
    if (open) {
      setStep('ticket');
      setSelectedTicketId(null);
      setShowNewTicketForm(false);
      setCreatedTicket(null);
      setHasSig(false);
      setNewTicket({
        title: `Asset Assignment: ${assetFormData?.name || 'Asset'}`,
        description: `Asset assignment workflow for ${assetFormData?.name || 'Asset'} (${assetFormData?.type || ''}).`,
        priority: 'MEDIUM',
      });
    }
  }, [open]);

  // Init canvas when signature step opens
  useEffect(() => {
    if (step !== 'signature' || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    canvas.width = canvas.offsetWidth * window.devicePixelRatio;
    canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = document.documentElement.classList.contains('dark') ? '#e2e8f0' : '#1e293b';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setHasSig(false);
  }, [step]);

  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: any) => {
    e.preventDefault();
    isDrawing.current = true;
    const pos = getPos(e);
    const ctx = canvasRef.current!.getContext('2d')!;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    lastPos.current = pos;
  };

  const draw = (e: any) => {
    e.preventDefault();
    if (!isDrawing.current) return;
    const pos = getPos(e);
    const ctx = canvasRef.current!.getContext('2d')!;
    if (lastPos.current) {
      const mx = (lastPos.current.x + pos.x) / 2;
      const my = (lastPos.current.y + pos.y) / 2;
      ctx.quadraticCurveTo(lastPos.current.x, lastPos.current.y, mx, my);
    }
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
    setHasSig(true);
  };

  const stopDraw = () => { isDrawing.current = false; lastPos.current = null; };

  const clearSignature = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSig(false);
  };

  // Build the high-res signed form PNG
  const generateSignedForm = async (signatureDataUrl: string): Promise<string> => {
    const W = 794, H = 1060;
    const dpr = 2;
    const canvas = document.createElement('canvas');
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    // Header gradient
    const grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, '#4f46e5');
    grad.addColorStop(1, '#0284c7');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, 88);

    // Header text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText('ASSET ASSIGNMENT AGREEMENT', 40, 36);
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.80)';
    ctx.fillText('AssetXAI — Official Signed Document', 40, 58);
    ctx.fillText(`Generated: ${new Date().toLocaleString()}`, 40, 76);

    const drawDivider = (y: number) => {
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(40, y, W - 80, 1);
    };
    const drawSectionHeader = (title: string, y: number) => {
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(40, y, W - 80, 28);
      ctx.fillStyle = '#1e40af';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillText(title, 52, y + 19);
      return y + 28;
    };
    const drawField = (label: string, value: string, x: number, y: number) => {
      ctx.fillStyle = '#64748b';
      ctx.font = '10px system-ui, sans-serif';
      ctx.fillText(label.toUpperCase(), x, y);
      ctx.fillStyle = '#0f172a';
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillText(value?.slice(0, 50) || '—', x, y + 16);
    };

    let y = 108;

    // Asset section
    y = drawSectionHeader('ASSET INFORMATION', y);
    y += 14;
    drawField('Name', assetFormData?.name || '—', 52, y);
    drawField('Type', assetFormData?.type || '—', 320, y);
    drawField('Floor / Room', `${assetFormData?.floorNumber || '—'} / ${assetFormData?.roomNumber || '—'}`, 560, y);
    y += 42;
    if (assetFormData?.description) drawField('Description', assetFormData.description, 52, y);
    if (assetFormData?.purchaseAmount) drawField('Purchase Amount', `QAR ${assetFormData.purchaseAmount}`, 320, y);
    y += 40;
    drawDivider(y); y += 14;

    // Assignee section
    y = drawSectionHeader('ASSIGNED TO', y);
    y += 14;
    drawField('Full Name', assignee.name || assignee.email.split('@')[0] || '—', 52, y);
    drawField('Email Address', assignee.email || '—', 320, y);
    drawField('Assignment Date', new Date().toLocaleDateString(), 560, y);
    y += 42;
    drawDivider(y); y += 14;

    // Ticket section
    if (activeTicket) {
      y = drawSectionHeader('LINKED SUPPORT TICKET', y);
      y += 14;
      drawField('Ticket ID', activeTicket.displayId || activeTicket.id?.slice(0, 8) || '—', 52, y);
      drawField('Title', activeTicket.title || '—', 320, y);
      drawField('Priority', activeTicket.priority || '—', 560, y);
      y += 42;
      drawDivider(y); y += 14;
    }

    // Terms
    y = drawSectionHeader('TERMS & CONDITIONS', y);
    y += 16;
    const terms = [
      '1. The assignee acknowledges receipt of the above asset in satisfactory condition.',
      '2. The assignee agrees to use the asset solely for authorized organizational purposes.',
      '3. Any damage, loss, or unauthorized use must be reported immediately to the asset manager.',
      '4. The asset remains the property of the organization and must be returned upon request.',
      '5. The assignee is responsible for the proper safekeeping and care of the asset.',
    ];
    ctx.fillStyle = '#374151';
    ctx.font = '11px system-ui, sans-serif';
    terms.forEach((term, i) => {
      ctx.fillText(term, 52, y + i * 20);
    });
    y += terms.length * 20 + 20;
    drawDivider(y); y += 14;

    // Signature section
    y = drawSectionHeader('DIGITAL SIGNATURE', y);
    y += 14;

    // Signature box
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(52, y, 320, 130);
    ctx.setLineDash([]);

    // Draw signature image
    await new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => { ctx.drawImage(img, 52, y, 320, 130); resolve(); };
      img.onerror = resolve;
      img.src = signatureDataUrl;
    });

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillText('Authorized Signature', 52, y + 146);
    ctx.fillText(assignee.name || assignee.email, 52, y + 162);
    ctx.fillText(new Date().toISOString(), 52, y + 178);

    // Verified stamp
    ctx.fillStyle = 'rgba(16,185,129,0.08)';
    const rx = 420, ry = y + 12, rw = 330, rh = 100;
    ctx.beginPath();
    ctx.moveTo(rx + 10, ry); ctx.lineTo(rx + rw - 10, ry);
    ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + 10);
    ctx.lineTo(rx + rw, ry + rh - 10);
    ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - 10, ry + rh);
    ctx.lineTo(rx + 10, ry + rh); ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - 10);
    ctx.lineTo(rx, ry + 10); ctx.quadraticCurveTo(rx, ry, rx + 10, ry);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#10b981'; ctx.lineWidth = 1.5; ctx.stroke();

    ctx.fillStyle = '#065f46';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText('✓ DIGITALLY SIGNED', rx + 18, ry + 30);
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillStyle = '#047857';
    ctx.fillText(new Date().toISOString(), rx + 18, ry + 52);
    ctx.fillText('Method: Manual Canvas Signature', rx + 18, ry + 70);
    ctx.fillText('Platform: AssetXAI', rx + 18, ry + 88);

    // Footer
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, H - 44, W, 44);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px system-ui, sans-serif';
    ctx.fillText('This document is electronically generated by AssetXAI and is legally binding upon signature.', 40, H - 26);
    ctx.fillText(`Document ID: ${Date.now().toString(36).toUpperCase()} | AssetXAI Platform | Confidential`, 40, H - 12);

    return canvas.toDataURL('image/png', 1.0);
  };

  // Step 1: Ticket helpers
  const handleCreateTicket = async () => {
    if (!newTicket.title.trim()) {
      toast({ variant: 'destructive', title: 'Ticket title is required' });
      return;
    }
    setCreatingTicket(true);
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTicket.title,
          description: newTicket.description,
          priority: newTicket.priority,
          assignedToId: assignee.id,
        }),
      });
      if (res.ok) {
        const t = await res.json();
        setCreatedTicket(t);
        setShowNewTicketForm(false);
        toast({ title: 'Ticket created', description: `Ticket ${t.displayId || t.id?.slice(0, 8)} created successfully.` });
      } else {
        toast({ variant: 'destructive', title: 'Failed to create ticket' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Failed to create ticket' });
    } finally {
      setCreatingTicket(false);
    }
  };

  const handleTicketContinue = async () => {
    setSendingEmail(true);
    // Send notification email to assignee
    try {
      await fetch('/api/notifications/assignment-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assigneeEmail: assignee.email,
          assigneeName: assignee.name,
          assetName: assetFormData?.name,
          assetType: assetFormData?.type,
          ticketId: createdTicket?.id || selectedTicketId,
          ticketTitle: createdTicket?.title || activeTicket?.title,
        }),
      });
    } catch { /* email is best-effort */ }
    setSendingEmail(false);
    setStep('signature');
  };

  // Step 2: Complete
  const handleComplete = async () => {
    if (!hasSig) {
      toast({ variant: 'destructive', title: 'Signature required', description: 'Please draw your signature before completing.' });
      return;
    }
    setSubmitting(true);
    const signatureDataUrl = canvasRef.current!.toDataURL('image/png');
    const pdfDataUrl = await generateSignedForm(signatureDataUrl);
    setSubmitting(false);
    onComplete({
      ticketId: createdTicket?.id || selectedTicketId || null,
      signatureDataUrl,
      pdfDataUrl,
      newTicketTitle: createdTicket?.title || activeTicket?.title,
    });
  };

  const STEPS = ['ticket', 'signature'] as const;
  const stepIdx = STEPS.indexOf(step as any);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Asset Assignment Workflow</DialogTitle>
          <DialogDescription>Complete ticket linkage and signature to assign the asset</DialogDescription>
        </DialogHeader>

        {/* Top gradient bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-sky-500 rounded-t-lg" />

        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b bg-gradient-to-br from-indigo-50 to-sky-50 dark:from-indigo-950/30 dark:to-sky-950/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 flex items-center justify-center shadow-md">
              <FileSignature className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Asset Assignment Workflow</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Secure, auditable, and signature-verified assignment</p>
            </div>
          </div>

          {/* Step indicators */}
          <div className="flex items-center gap-2">
            {[{ key: 'ticket', label: 'Link Ticket', icon: Ticket },
              { key: 'signature', label: 'Sign Agreement', icon: PenLine }].map((s, i) => {
              const active = step === s.key;
              const done = stepIdx > i;
              return (
                <React.Fragment key={s.key}>
                  {i > 0 && (
                    <div className={`flex-1 h-0.5 rounded-full transition-colors ${done || active ? 'bg-indigo-400' : 'bg-gray-200 dark:bg-gray-700'}`} />
                  )}
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    active ? 'bg-indigo-600 text-white shadow-md' :
                    done ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' :
                    'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500'
                  }`}>
                    {done ? <CheckCircle className="w-3 h-3" /> : <s.icon className="w-3 h-3" />}
                    {s.label}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          {/* ── STEP 1: TICKET ── */}
          {step === 'ticket' && (
            <div className="space-y-5">
              {/* Assignee info */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-800">
                <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                  <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{assignee.name || assignee.email}</p>
                  <p className="text-xs text-gray-500 truncate">{assignee.email}</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/50 px-2 py-1 rounded-full">
                  <Package className="w-3 h-3" />{assetFormData?.name}
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1">Is this assignment related to a support ticket?</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Linking a ticket creates an auditable trail for this assignment. You can also skip this step.</p>
              </div>

              {/* Existing tickets */}
              {userTickets.length > 0 && !showNewTicketForm && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Open tickets for this user</p>
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {userTickets.map(t => (
                      <div
                        key={t.id}
                        onClick={() => setSelectedTicketId(prev => prev === t.id ? null : t.id)}
                        className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                          selectedTicketId === t.id
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40'
                            : 'border-gray-200 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Ticket className="w-4 h-4 text-purple-500 shrink-0" />
                          <span className="text-xs font-mono text-gray-400">{t.displayId || t.id?.slice(0, 8)}</span>
                          <Badge className={`text-[10px] px-1.5 border ${PRIORITY_COLORS[t.priority] || 'bg-gray-100 text-gray-600'}`}>{t.priority}</Badge>
                          {selectedTicketId === t.id && <CheckCircle className="w-4 h-4 text-indigo-500 ml-auto" />}
                        </div>
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-100 mt-1 truncate">{t.title}</p>
                        {t.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{t.description}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Created ticket */}
              {createdTicket && (
                <div className="p-3 rounded-xl border-2 border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Ticket Created</span>
                    <span className="text-xs text-emerald-500 font-mono ml-auto">{createdTicket.displayId || createdTicket.id?.slice(0, 8)}</span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-200 mt-1">{createdTicket.title}</p>
                </div>
              )}

              {/* New ticket form */}
              {showNewTicketForm && !createdTicket && (
                <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-950/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-200">New Ticket Details</p>
                    <button onClick={() => setShowNewTicketForm(false)} className="text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Ticket Title</label>
                    <Input value={newTicket.title} onChange={e => setNewTicket(p => ({ ...p, title: e.target.value }))} placeholder="Ticket title" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Priority</label>
                    <Select value={newTicket.priority} onValueChange={v => setNewTicket(p => ({ ...p, priority: v }))}>
                      <SelectTrigger className="bg-white dark:bg-gray-900"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LOW">Low</SelectItem>
                        <SelectItem value="MEDIUM">Medium</SelectItem>
                        <SelectItem value="HIGH">High</SelectItem>
                        <SelectItem value="URGENT">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Description</label>
                    <textarea
                      className="w-full border rounded-lg px-3 py-2 text-sm resize-none bg-white dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                      rows={2}
                      value={newTicket.description}
                      onChange={e => setNewTicket(p => ({ ...p, description: e.target.value }))}
                    />
                  </div>
                  <Button onClick={handleCreateTicket} disabled={creatingTicket} size="sm" className="w-full bg-indigo-600 hover:bg-indigo-700">
                    {creatingTicket ? <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />Creating…</> : <><Plus className="w-3.5 h-3.5 mr-2" />Create Ticket</>}
                  </Button>
                </div>
              )}

              {/* Create ticket button */}
              {!showNewTicketForm && !createdTicket && (
                <Button variant="outline" size="sm" onClick={() => setShowNewTicketForm(true)} className="w-full border-dashed">
                  <Plus className="w-4 h-4 mr-2" />Create New Ticket
                </Button>
              )}

              {/* Email notice */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 text-xs text-sky-700 dark:text-sky-300">
                <Mail className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>A notification email will be sent to <strong>{assignee.email}</strong> with the asset and ticket details before proceeding to the signature step.</span>
              </div>

              <div className="flex gap-3 pt-1">
                <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">Cancel</Button>
                <Button
                  onClick={handleTicketContinue}
                  disabled={sendingEmail}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white"
                >
                  {sendingEmail
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending notification…</>
                    : <><Mail className="w-4 h-4 mr-2" />Send Notification & Continue <ArrowRight className="w-4 h-4 ml-1" /></>
                  }
                </Button>
              </div>
            </div>
          )}

          {/* ── STEP 2: SIGNATURE ── */}
          {step === 'signature' && (
            <div className="space-y-5">
              {/* Form preview card */}
              <div className="rounded-xl border bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-600 to-sky-600 px-4 py-3 text-white">
                  <div className="flex items-center gap-2">
                    <FileCheck className="w-4 h-4" />
                    <span className="font-bold text-sm">Asset Assignment Agreement</span>
                  </div>
                  <p className="text-xs text-white/70 mt-0.5">Please review the details and sign below</p>
                </div>
                <div className="p-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[10px] uppercase font-semibold text-gray-400">Asset</p>
                    <p className="font-medium text-gray-900 dark:text-white">{assetFormData?.name}</p>
                    <p className="text-xs text-gray-500">{assetFormData?.type} · Floor {assetFormData?.floorNumber || '—'}, Room {assetFormData?.roomNumber || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-semibold text-gray-400">Assigned To</p>
                    <p className="font-medium text-gray-900 dark:text-white">{assignee.name || assignee.email}</p>
                    <p className="text-xs text-gray-500">{assignee.email}</p>
                  </div>
                  {activeTicket && (
                    <div className="col-span-2">
                      <p className="text-[10px] uppercase font-semibold text-gray-400">Linked Ticket</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Ticket className="w-3.5 h-3.5 text-purple-500" />
                        <span className="text-xs font-mono text-gray-400">{activeTicket.displayId || activeTicket.id?.slice(0, 8)}</span>
                        <span className="font-medium text-gray-800 dark:text-gray-200">{activeTicket.title}</span>
                      </div>
                    </div>
                  )}
                  <div className="col-span-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-[10px] uppercase font-semibold text-gray-400 mb-1">Terms Summary</p>
                    <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">By signing, I confirm receipt of the above asset in good condition and agree to use it solely for authorized purposes. I accept responsibility for its safekeeping and will report any damage or loss immediately.</p>
                  </div>
                </div>
              </div>

              {/* Signature canvas */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <PenLine className="w-4 h-4 text-indigo-600" />
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">Draw Your Signature</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={clearSignature} className="h-7 px-2 text-xs text-gray-500">
                    <X className="w-3 h-3 mr-1" />Clear
                  </Button>
                </div>
                <div className={`relative rounded-xl border-2 transition-colors overflow-hidden ${
                  hasSig ? 'border-indigo-400 dark:border-indigo-500' : 'border-dashed border-gray-300 dark:border-gray-600'
                } bg-white dark:bg-gray-950`} style={{ height: '150px' }}>
                  {!hasSig && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-gray-300 dark:text-gray-600">
                      <PenLine className="w-8 h-8 mb-1.5" />
                      <span className="text-sm">Sign here with mouse or finger</span>
                    </div>
                  )}
                  <canvas
                    ref={canvasRef}
                    style={{ width: '100%', height: '100%', touchAction: 'none', cursor: 'crosshair' }}
                    onMouseDown={startDraw}
                    onMouseMove={draw}
                    onMouseUp={stopDraw}
                    onMouseLeave={stopDraw}
                    onTouchStart={startDraw}
                    onTouchMove={draw}
                    onTouchEnd={stopDraw}
                  />
                </div>
                {!hasSig && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />Signature is required to complete the assignment
                  </p>
                )}
              </div>

              {/* Shield notice */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300">
                <Shield className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>Your signature will be recorded with a timestamp, stored securely, and attached as a signed PDF to this asset's files. A confirmation email will be sent automatically.</span>
              </div>

              <div className="flex gap-3 pt-1">
                <Button variant="outline" onClick={() => setStep('ticket')} className="flex-1">
                  ← Back
                </Button>
                <Button
                  onClick={handleComplete}
                  disabled={submitting || !hasSig}
                  className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
                >
                  {submitting
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating…</>
                    : <><Sparkles className="w-4 h-4 mr-2" />Sign & Complete Assignment</>
                  }
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
