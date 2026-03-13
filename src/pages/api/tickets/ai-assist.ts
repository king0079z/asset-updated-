import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/util/supabase/require-auth';
import prisma from '@/lib/prisma';
import { TicketStatus, TicketPriority } from '@prisma/client';

// AI analysis using keyword patterns + statistical heuristics
// (no external API dependency — runs instantly server-side)

const URGENCY_KEYWORDS = {
  critical: ['urgent', 'critical', 'emergency', 'down', 'broken', 'not working', 'failed', 'crash', 'error', 'blocked', 'cannot login', 'data loss', 'security', 'breach', 'hack'],
  high: ['asap', 'important', 'needed', 'required', 'slow', 'intermittent', 'issue', 'problem', 'failing', 'wrong', 'incorrect'],
  low: ['question', 'how to', 'wondering', 'curious', 'when possible', 'no rush', 'fyi', 'info'],
};

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'DEVICES': ['laptop', 'computer', 'monitor', 'printer', 'phone', 'device', 'hardware', 'screen', 'keyboard', 'mouse', 'tablet', 'toner'],
  'ACCESS': ['access', 'login', 'password', 'vpn', 'permission', 'account', 'credentials', 'locked out', 'reset', 'authentication'],
  'SOFTWARE': ['software', 'application', 'app', 'install', 'update', 'upgrade', 'license', 'bug', 'feature'],
  'SERVICE_DESK': ['feedback', 'inquiry', 'question', 'report', 'stolen', 'lost', 'return'],
  'ASSET_MANAGEMENT': ['asset', 'equipment', 'inventory', 'request equipment', 'new device'],
};

function analyzePriority(title: string, description: string): { priority: TicketPriority; confidence: number; reason: string } {
  const text = `${title} ${description}`.toLowerCase();
  
  for (const kw of URGENCY_KEYWORDS.critical) {
    if (text.includes(kw)) return { priority: TicketPriority.CRITICAL, confidence: 92, reason: `Detected critical keyword: "${kw}"` };
  }
  for (const kw of URGENCY_KEYWORDS.high) {
    if (text.includes(kw)) return { priority: TicketPriority.HIGH, confidence: 78, reason: `Detected high-urgency keyword: "${kw}"` };
  }
  for (const kw of URGENCY_KEYWORDS.low) {
    if (text.includes(kw)) return { priority: TicketPriority.LOW, confidence: 75, reason: `Detected low-urgency indicator: "${kw}"` };
  }
  return { priority: TicketPriority.MEDIUM, confidence: 65, reason: 'No strong urgency indicators found — defaulting to Medium' };
}

function analyzeCategory(title: string, description: string): { category: string; confidence: number } {
  const text = `${title} ${description}`.toLowerCase();
  let best = { category: 'SERVICE_DESK', score: 0 };
  
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = keywords.filter(kw => text.includes(kw)).length;
    if (score > best.score) best = { category: cat, score };
  }
  
  return { category: best.category, confidence: best.score > 0 ? Math.min(60 + best.score * 10, 95) : 50 };
}

function analyzeSentiment(text: string): { sentiment: string; score: number; emoji: string } {
  const lower = text.toLowerCase();
  const frustrated = ['frustrated', 'annoyed', 'cannot', 'not working', 'still broken', 'again', 'ridiculous', 'terrible', 'awful', 'useless', 'waste'];
  const positive = ['thank', 'please', 'appreciate', 'help', 'kindly', 'grateful'];
  
  const frustScore = frustrated.filter(w => lower.includes(w)).length;
  const posScore = positive.filter(w => lower.includes(w)).length;
  
  if (frustScore >= 2) return { sentiment: 'Frustrated', score: -frustScore, emoji: '😤' };
  if (frustScore === 1) return { sentiment: 'Concerned', score: -1, emoji: '😟' };
  if (posScore >= 1) return { sentiment: 'Polite', score: posScore, emoji: '😊' };
  return { sentiment: 'Neutral', score: 0, emoji: '😐' };
}

async function suggestAssignee(ticketType: string, category: string, priority: string) {
  // Find staff with lowest workload in the relevant category
  const staff = await prisma.user.findMany({
    where: { role: { in: ['STAFF', 'MANAGER'] } },
    select: {
      id: true,
      email: true,
      assignedTickets: {
        where: { status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] } },
        select: { id: true, priority: true, category: true },
      },
    },
  });

  const scored = staff.map(s => {
    const active = s.assignedTickets.length;
    const categoryMatch = s.assignedTickets.filter(t => t.category === category).length;
    // Lower score = better candidate
    const score = active * 3 - categoryMatch * 2;
    return { ...s, activeCount: active, score };
  });

  scored.sort((a, b) => a.score - b.score);
  const best = scored[0];
  
  return best ? {
    id: best.id,
    email: best.email,
    name: best.email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
    activeTickets: best.activeCount,
    reason: best.activeCount === 0
      ? 'No current workload — ideal for immediate assignment'
      : `Lowest current workload (${best.activeCount} active tickets)`,
  } : null;
}

function estimateSLA(priority: TicketPriority, category: string): { target: string; targetMs: number } {
  const slaMap: Record<string, Record<string, number>> = {
    CRITICAL: { default: 4, DEVICES: 2, ACCESS: 2, SOFTWARE: 4 },
    HIGH:     { default: 8, DEVICES: 4, ACCESS: 4, SOFTWARE: 8 },
    MEDIUM:   { default: 24, DEVICES: 16, ACCESS: 12, SOFTWARE: 24 },
    LOW:      { default: 72, DEVICES: 48, ACCESS: 48, SOFTWARE: 72 },
  };
  const hours = slaMap[priority]?.[category] ?? slaMap[priority]?.default ?? 24;
  return { target: hours < 24 ? `${hours}h` : `${hours / 24}d`, targetMs: hours * 3600000 };
}

function generateInsights(ticket: any, stats: any): string[] {
  const insights: string[] = [];
  const ageMs = Date.now() - new Date(ticket.createdAt).getTime();
  const ageHours = ageMs / 3600000;
  const sla = estimateSLA(ticket.priority, ticket.category || 'default');

  if (ticket.status === 'OPEN' && ageMs > sla.targetMs) {
    insights.push(`⚠️ SLA Breach: This ${ticket.priority} ticket has been open for ${Math.round(ageHours)}h (target: ${sla.target})`);
  }
  if (ticket.priority === 'CRITICAL' && ticket.status === 'OPEN') {
    insights.push('🚨 Critical Priority: Immediate action required — assign to available staff now');
  }
  if (!ticket.assignedToId && ticket.status === 'OPEN') {
    insights.push('👤 Unassigned: This ticket has no assignee — use AI suggestion to route it');
  }
  if (ticket.status === 'IN_PROGRESS' && ageHours > 48) {
    insights.push('🕐 Long in-progress: Ticket has been in progress for over 48h — consider escalation');
  }
  if (stats?.avgResolutionFormatted && stats.avgResolutionFormatted !== 'N/A') {
    insights.push(`📊 Team benchmark: Average resolution time for similar tickets is ${stats.avgResolutionFormatted}`);
  }
  return insights;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireAuth(req, res);
  if (!auth) return;

  if (req.method === 'POST') {
    const { action, ticketId, title, description, ticketType, category, priority } = req.body;

    try {
      if (action === 'analyze') {
        // Analyze a ticket's text for priority, category, sentiment
        const priorityAnalysis = analyzePriority(title || '', description || '');
        const categoryAnalysis = analyzeCategory(title || '', description || '');
        const sentiment = analyzeSentiment(description || '');
        const sla = estimateSLA(priorityAnalysis.priority, categoryAnalysis.category);
        const suggestedAssignee = await suggestAssignee(ticketType || 'ISSUE', categoryAnalysis.category, priorityAnalysis.priority);

        return res.status(200).json({
          priority: priorityAnalysis,
          category: categoryAnalysis,
          sentiment,
          sla,
          suggestedAssignee,
        });
      }

      if (action === 'insights' && ticketId) {
        const ticket = await prisma.ticket.findUnique({
          where: { id: ticketId },
          include: {
            history: { orderBy: { createdAt: 'desc' }, take: 10 },
            assignedTo: { select: { id: true, email: true } },
          },
        });
        if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

        // Get similar resolved tickets for benchmarking
        const similar = await prisma.ticket.findMany({
          where: {
            category: ticket.category || undefined,
            priority: ticket.priority,
            status: { in: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
          },
          select: { createdAt: true, updatedAt: true },
          take: 20,
        });

        const avgResMs = similar.length > 0
          ? similar.reduce((acc, t) => acc + (t.updatedAt.getTime() - t.createdAt.getTime()), 0) / similar.length
          : null;
        const formatDuration = (ms: number | null) => {
          if (!ms) return 'N/A';
          const h = ms / 3600000;
          if (h < 1) return `${Math.round(ms / 60000)}m`;
          if (h < 24) return `${Math.round(h)}h`;
          return `${Math.floor(h / 24)}d ${Math.round(h % 24)}h`;
        };

        const insights = generateInsights(ticket, {
          avgResolutionFormatted: formatDuration(avgResMs),
        });
        const sentiment = analyzeSentiment(ticket.description);
        const sla = estimateSLA(ticket.priority, ticket.category || 'SERVICE_DESK');
        const suggestedAssignee = !ticket.assignedToId
          ? await suggestAssignee(ticket.ticketType || 'ISSUE', ticket.category || 'SERVICE_DESK', ticket.priority)
          : null;

        const ageMs = Date.now() - ticket.createdAt.getTime();
        const slaBreached = ageMs > sla.targetMs && ticket.status !== TicketStatus.RESOLVED && ticket.status !== TicketStatus.CLOSED;
        const slaProgress = Math.min(Math.round((ageMs / sla.targetMs) * 100), 100);

        return res.status(200).json({
          insights,
          sentiment,
          sla: { ...sla, breached: slaBreached, progressPct: slaProgress },
          suggestedAssignee,
          benchmark: { avgResolutionFormatted: formatDuration(avgResMs), sampleSize: similar.length },
          commentCount: ticket.history.length,
        });
      }

      if (action === 'bulk-analyze') {
        // Analyze all open tickets for a dashboard summary
        const openTickets = await prisma.ticket.findMany({
          where: { status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] } },
          select: {
            id: true, priority: true, category: true, status: true,
            assignedToId: true, createdAt: true, title: true,
          },
          take: 100,
        });

        const slaBreach = openTickets.filter(t => {
          const sla = estimateSLA(t.priority as TicketPriority, t.category || 'SERVICE_DESK');
          return Date.now() - t.createdAt.getTime() > sla.targetMs;
        });

        const unassigned = openTickets.filter(t => !t.assignedToId);
        const critical = openTickets.filter(t => t.priority === 'CRITICAL');

        return res.status(200).json({
          summary: {
            total: openTickets.length,
            slaBreached: slaBreach.length,
            unassigned: unassigned.length,
            critical: critical.length,
          },
          slaBreachedTickets: slaBreach.slice(0, 5).map(t => ({ id: t.id, title: t.title, priority: t.priority })),
          recommendations: [
            ...(critical.length > 0 ? [`🚨 ${critical.length} critical ticket(s) need immediate attention`] : []),
            ...(unassigned.length > 0 ? [`👤 ${unassigned.length} ticket(s) are unassigned — assign now`] : []),
            ...(slaBreach.length > 0 ? [`⚠️ ${slaBreach.length} ticket(s) have breached their SLA target`] : []),
            ...(openTickets.length === 0 ? ['✅ All tickets are resolved — great work!'] : []),
          ],
        });
      }

      return res.status(400).json({ error: 'Unknown action' });
    } catch (error) {
      console.error('AI assist error:', error);
      return res.status(500).json({ error: 'AI analysis failed' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
