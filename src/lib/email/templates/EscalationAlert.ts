import { baseLayout } from './base';

export function renderEscalationAlert(data: Record<string, any>): { html: string; subject: string } {
  const { ticketId, title, level, hoursOverdue, originalAssignee, ticketUrl } = data;
  const levelLabels: Record<number, string> = { 1: 'Manager', 2: 'Senior Manager', 3: 'Director' };
  const content = `
    <h2>🔺 Escalation Level ${level} — Action Required</h2>
    <p>A ticket has been escalated to <strong>Level ${level} (${levelLabels[level] || 'Leadership'})</strong> due to SLA breach.</p>
    <div class="info-box">
      <div class="info-row"><span class="info-label">Ticket ID</span><span class="info-value">${ticketId}</span></div>
      <div class="info-row"><span class="info-label">Title</span><span class="info-value">${title}</span></div>
      <div class="info-row"><span class="info-label">Escalation Level</span><span class="info-value"><span class="badge badge-red">Level ${level}</span></span></div>
      <div class="info-row"><span class="info-label">Hours Overdue</span><span class="info-value" style="color:#dc2626;font-weight:800;">${hoursOverdue}h</span></div>
      <div class="info-row"><span class="info-label">Originally Assigned</span><span class="info-value">${originalAssignee || 'Unassigned'}</span></div>
    </div>
    <p>This ticket requires your immediate intervention. Please review and take appropriate action.</p>
    ${ticketUrl ? `<a class="btn" href="${ticketUrl}" style="background:linear-gradient(135deg,#dc2626,#b91c1c);">View Escalated Ticket</a>` : ''}
  `;
  return { html: baseLayout(content, 'Escalation Alert'), subject: `🔺 ESCALATION L${level}: [${ticketId}] ${title}` };
}
