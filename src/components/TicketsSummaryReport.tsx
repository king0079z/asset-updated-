import React from 'react';
import { format } from 'date-fns';

enum TicketStatus {
  OPEN = "OPEN",
  IN_PROGRESS = "IN_PROGRESS",
  RESOLVED = "RESOLVED",
  CLOSED = "CLOSED"
}

enum TicketPriority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL"
}

interface Ticket {
  id: string;
  displayId: string | null;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  assetId: string | null;
  asset: { id: string; name: string; assetId: string } | null;
  createdAt: string;
  updatedAt: string;
}

interface TicketsSummaryReportProps {
  tickets: Ticket[];
}

const REPORT_STYLES = `
  .tickets-report { font-family: 'Inter', system-ui, -apple-system, sans-serif; max-width: 840px; margin: 0 auto; padding: 2rem 2.5rem; background: #fff; color: #1e293b; line-height: 1.5; }
  .tickets-report *, .tickets-report *::before, .tickets-report *::after { box-sizing: border-box; }
  .tickets-report h1 { margin: 0; font-size: 1.75rem; font-weight: 700; letter-spacing: -0.02em; color: #0f172a; }
  .tickets-report .report-generated { margin: 0.25rem 0 0 0; font-size: 0.875rem; color: #64748b; }
  .tickets-report .report-brand { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8125rem; font-weight: 600; color: #475569; }
  .tickets-report .report-brand svg { flex-shrink: 0; color: #6366f1; }
  .tickets-report .header-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.75rem; padding-bottom: 1.5rem; border-bottom: 2px solid #e2e8f0; }
  .tickets-report .metric-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem; }
  .tickets-report .metric-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.25rem; page-break-inside: avoid; }
  .tickets-report .metric-card.accent-total { background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%); border-color: #cbd5e1; }
  .tickets-report .metric-card.accent-open { background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border-color: #fecaca; }
  .tickets-report .metric-card.accent-progress { background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border-color: #fde68a; }
  .tickets-report .metric-card.accent-high { background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%); border-color: #fed7aa; }
  .tickets-report .metric-card .label { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 0.5rem; }
  .tickets-report .metric-card .value { font-size: 1.75rem; font-weight: 700; color: #0f172a; }
  .tickets-report .metric-card .sub { font-size: 0.8125rem; font-weight: 600; margin-top: 0.25rem; }
  .tickets-report .metric-card .sub.open { color: #b91c1c; }
  .tickets-report .metric-card .sub.high { color: #c2410c; }
  .tickets-report .section-title { font-size: 1.125rem; font-weight: 600; color: #0f172a; margin-bottom: 1rem; }
  .tickets-report .charts-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem; }
  .tickets-report .chart-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.25rem; page-break-inside: avoid; }
  .tickets-report .chart-row { display: flex; align-items: center; gap: 1rem; margin-bottom: 0.75rem; }
  .tickets-report .chart-row:last-child { margin-bottom: 0; }
  .tickets-report .chart-bar-wrap { flex: 1; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; }
  .tickets-report .chart-bar { height: 100%; border-radius: 4px; min-width: 4px; }
  .tickets-report .chart-bar.open { background: #ef4444; }
  .tickets-report .chart-bar.progress { background: #eab308; }
  .tickets-report .chart-bar.resolved { background: #22c55e; }
  .tickets-report .chart-bar.closed { background: #94a3b8; }
  .tickets-report .chart-bar.low { background: #3b82f6; }
  .tickets-report .chart-bar.medium { background: #eab308; }
  .tickets-report .chart-bar.high { background: #f97316; }
  .tickets-report .chart-bar.critical { background: #ef4444; }
  .tickets-report .chart-label { display: flex; align-items: center; gap: 0.375rem; font-size: 0.8125rem; color: #475569; min-width: 100px; }
  .tickets-report .chart-dot { width: 6px; height: 6px; border-radius: 50%; }
  .tickets-report .chart-count { font-size: 0.8125rem; font-weight: 600; color: #0f172a; min-width: 1.5rem; text-align: right; }
  .tickets-report .table-wrap { overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 2rem; }
  .tickets-report table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
  .tickets-report th { text-align: left; padding: 0.75rem 1rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; background: #f1f5f9; border-bottom: 1px solid #e2e8f0; }
  .tickets-report th:first-child { border-radius: 12px 0 0 0; padding-left: 1.25rem; }
  .tickets-report th:last-child { border-radius: 0 12px 0 0; padding-right: 1.25rem; }
  .tickets-report td { padding: 0.75rem 1rem; border-bottom: 1px solid #f1f5f9; color: #334155; }
  .tickets-report td:first-child { padding-left: 1.25rem; }
  .tickets-report td:last-child { padding-right: 1.25rem; }
  .tickets-report tr:last-child td { border-bottom: none; }
  .tickets-report tr:nth-child(even) { background: #fafafa; }
  .tickets-report tr:nth-child(odd) { background: #fff; }
  .tickets-report .badge { display: inline-flex; align-items: center; padding: 0.25rem 0.5rem; border-radius: 6px; font-size: 0.75rem; font-weight: 600; }
  .tickets-report .badge.open { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
  .tickets-report .badge.progress { background: #fefce8; color: #a16207; border: 1px solid #fde68a; }
  .tickets-report .badge.resolved { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
  .tickets-report .badge.closed { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }
  .tickets-report .badge.low { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
  .tickets-report .badge.medium { background: #fefce8; color: #a16207; border: 1px solid #fde68a; }
  .tickets-report .badge.high { background: #fff7ed; color: #c2410c; border: 1px solid #fed7aa; }
  .tickets-report .badge.critical { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
  .tickets-report .report-footer { margin-top: 2rem; padding-top: 1.25rem; border-top: 2px solid #e2e8f0; font-size: 0.75rem; color: #64748b; }
  .tickets-report .report-footer .footer-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
  .tickets-report .report-footer .compliance { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 0.75rem 1rem; margin-bottom: 0.75rem; }
  .tickets-report .report-footer .compliance-title { font-weight: 600; color: #1e40af; margin-bottom: 0.375rem; }
  .tickets-report .report-footer .compliance-badges { display: flex; flex-wrap: wrap; gap: 0.375rem; }
  .tickets-report .report-footer .compliance-badge { background: #dbeafe; color: #1d4ed8; padding: 0.2rem 0.5rem; border-radius: 4px; font-weight: 500; }
  @media print {
    .tickets-report { padding: 1rem 1.25rem; }
    .tickets-report .metric-card, .tickets-report .chart-card, .tickets-report .table-wrap { box-shadow: none; }
    .tickets-report tr { page-break-inside: avoid; }
    @page { size: A4; margin: 1.5cm; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
`;

const safeFormatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return "N/A";
  try {
    return format(new Date(dateString), 'MMM d, yyyy');
  } catch {
    return "Invalid Date";
  }
};

const formatStatusLabel = (status: TicketStatus): string => status.replace("_", " ");
const formatPriorityLabel = (priority: TicketPriority): string =>
  priority.charAt(0) + priority.slice(1).toLowerCase();

const BarChartIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v18h18" />
    <path d="M7 16v-5" />
    <path d="M12 16v-8" />
    <path d="M17 16v-11" />
  </svg>
);

const TicketsSummaryReport: React.FC<TicketsSummaryReportProps> = ({ tickets }) => {
  const statusCounts = {
    [TicketStatus.OPEN]: tickets.filter(t => t.status === TicketStatus.OPEN).length,
    [TicketStatus.IN_PROGRESS]: tickets.filter(t => t.status === TicketStatus.IN_PROGRESS).length,
    [TicketStatus.RESOLVED]: tickets.filter(t => t.status === TicketStatus.RESOLVED).length,
    [TicketStatus.CLOSED]: tickets.filter(t => t.status === TicketStatus.CLOSED).length,
  };
  const priorityCounts = {
    [TicketPriority.LOW]: tickets.filter(t => t.priority === TicketPriority.LOW).length,
    [TicketPriority.MEDIUM]: tickets.filter(t => t.priority === TicketPriority.MEDIUM).length,
    [TicketPriority.HIGH]: tickets.filter(t => t.priority === TicketPriority.HIGH).length,
    [TicketPriority.CRITICAL]: tickets.filter(t => t.priority === TicketPriority.CRITICAL).length,
  };
  const total = tickets.length;
  const openPct = total ? Math.round((statusCounts[TicketStatus.OPEN] / total) * 100) : 0;
  const highPct = total ? Math.round(((priorityCounts[TicketPriority.HIGH] + priorityCounts[TicketPriority.CRITICAL]) / total) * 100) : 0;
  const reportId = `TICKETS-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

  return (
    <div className="tickets-report">
      <style dangerouslySetInnerHTML={{ __html: REPORT_STYLES }} />
      <div className="header-row">
        <div>
          <h1>Tickets Summary Report</h1>
          <p className="report-generated">Generated on {format(new Date(), 'PPP')}</p>
        </div>
        <div className="report-brand">
          <BarChartIcon />
          <span>Enterprise Ticket Management</span>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-card accent-total">
          <div className="label">Total Tickets</div>
          <div className="value">{total}</div>
        </div>
        <div className="metric-card accent-open">
          <div className="label">Open</div>
          <div className="value">{statusCounts[TicketStatus.OPEN]}</div>
          <div className="sub open">{openPct}% of total</div>
        </div>
        <div className="metric-card accent-progress">
          <div className="label">In Progress</div>
          <div className="value">{statusCounts[TicketStatus.IN_PROGRESS]}</div>
        </div>
        <div className="metric-card accent-high">
          <div className="label">High Priority</div>
          <div className="value">{priorityCounts[TicketPriority.HIGH] + priorityCounts[TicketPriority.CRITICAL]}</div>
          <div className="sub high">{highPct}% of total</div>
        </div>
      </div>

      <div className="charts-row">
        <div className="chart-card">
          <div className="section-title">Status Distribution</div>
          {([TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED, TicketStatus.CLOSED] as const).map(status => {
            const count = statusCounts[status];
            const pct = total ? Math.round((count / total) * 100) : 0;
            return (
              <div key={status} className="chart-row">
                <div className="chart-bar-wrap">
                  <div className={`chart-bar ${status.toLowerCase().replace('_', '-')}`} style={{ width: `${pct}%` }} />
                </div>
                <span className="chart-label">
                  <span className={`chart-dot ${status === TicketStatus.OPEN ? 'open' : status === TicketStatus.IN_PROGRESS ? 'progress' : status === TicketStatus.RESOLVED ? 'resolved' : 'closed'}`} style={{ background: status === TicketStatus.OPEN ? '#ef4444' : status === TicketStatus.IN_PROGRESS ? '#eab308' : status === TicketStatus.RESOLVED ? '#22c55e' : '#94a3b8' }} />
                  {formatStatusLabel(status)}
                </span>
                <span className="chart-count">{count}</span>
              </div>
            );
          })}
        </div>
        <div className="chart-card">
          <div className="section-title">Priority Distribution</div>
          {([TicketPriority.LOW, TicketPriority.MEDIUM, TicketPriority.HIGH, TicketPriority.CRITICAL] as const).map(priority => {
            const count = priorityCounts[priority];
            const pct = total ? Math.round((count / total) * 100) : 0;
            return (
              <div key={priority} className="chart-row">
                <div className="chart-bar-wrap">
                  <div className={`chart-bar ${priority.toLowerCase()}`} style={{ width: `${pct}%` }} />
                </div>
                <span className="chart-label">{formatPriorityLabel(priority)}</span>
                <span className="chart-count">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="section-title">Ticket Details</div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Title</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Asset</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map(ticket => (
              <tr key={ticket.id}>
                <td style={{ fontWeight: 600 }}>{ticket.displayId || `ID-${ticket.id.slice(0, 8)}`}</td>
                <td>{ticket.title}</td>
                <td>
                  <span className={`badge ${ticket.status.toLowerCase().replace('_', '-')}`}>
                    {formatStatusLabel(ticket.status)}
                  </span>
                </td>
                <td>
                  <span className={`badge ${ticket.priority.toLowerCase()}`}>
                    {formatPriorityLabel(ticket.priority)}
                  </span>
                </td>
                <td>{ticket.asset ? ticket.asset.name : '—'}</td>
                <td>{safeFormatDate(ticket.createdAt)}</td>
              </tr>
            ))}
            {tickets.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>No tickets found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <footer className="report-footer">
        <div className="footer-row">
          <span>Enterprise Ticket Management</span>
          <span>Report ID: {reportId}</span>
        </div>
        <div className="compliance">
          <div className="compliance-title">Compliance &amp; Standards</div>
          <div className="compliance-badges">
            {['ISO 27001', 'GDPR', 'SOC2', 'ISO 9001'].map(s => <span key={s} className="compliance-badge">{s}</span>)}
          </div>
        </div>
        <div className="footer-row">
          <span>Document classification: Confidential</span>
          <span>Retention: 7 years</span>
        </div>
      </footer>
    </div>
  );
};

export default TicketsSummaryReport;
