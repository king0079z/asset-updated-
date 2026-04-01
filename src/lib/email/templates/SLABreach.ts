import { baseLayout } from './base';

export function renderSLABreach(data: Record<string, any>): { html: string; subject: string } {
  const { ticketId, title, priority, resolveBy, hoursOverdue, assigneeName, ticketUrl } = data;
  const content = `
    <h2>⚠️ SLA Breach Alert</h2>
    <p>The following ticket has <strong>breached its SLA</strong> resolution target. Immediate action is required.</p>
    <div class="info-box">
      <div class="info-row"><span class="info-label">Ticket ID</span><span class="info-value">${ticketId}</span></div>
      <div class="info-row"><span class="info-label">Title</span><span class="info-value">${title}</span></div>
      <div class="info-row"><span class="info-label">Priority</span><span class="info-value"><span class="badge badge-red">${priority}</span></span></div>
      <div class="info-row"><span class="info-label">SLA Deadline</span><span class="info-value">${resolveBy}</span></div>
      <div class="info-row"><span class="info-label">Hours Overdue</span><span class="info-value" style="color:#dc2626;font-weight:800;">${hoursOverdue}h overdue</span></div>
      <div class="info-row"><span class="info-label">Assigned To</span><span class="info-value">${assigneeName || 'Unassigned'}</span></div>
    </div>
    <p style="color:#dc2626;font-weight:600;">Please resolve this ticket immediately to prevent further escalation.</p>
    ${ticketUrl ? `<a class="btn" href="${ticketUrl}" style="background:linear-gradient(135deg,#dc2626,#b91c1c);">Resolve Ticket Now</a>` : ''}
  `;
  return { html: baseLayout(content, 'SLA Breach Alert'), subject: `🚨 SLA BREACH: [${ticketId}] ${title} — ${hoursOverdue}h overdue` };
}
