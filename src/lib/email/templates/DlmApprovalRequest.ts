import { baseLayout } from './base';

export function renderDlmApprovalRequest(data: Record<string, any>): { html: string; subject: string } {
  const {
    dlmName, requesterName, requesterEmail, requesterDepartment, requesterJobTitle,
    ticketTitle, ticketDescription, ticketCategory, ticketPriority, ticketDisplayId,
    portalUrl, isReminder = false,
  } = data;

  const priorityColor: Record<string, string> = {
    CRITICAL: '#dc2626', HIGH: '#ea580c', MEDIUM: '#ca8a04', LOW: '#16a34a',
  };
  const pColor = priorityColor[ticketPriority] || '#6366f1';

  const content = `
    ${isReminder ? `
    <div style="background:#fef9c3;border:1px solid #fde047;border-radius:10px;padding:12px 16px;margin-bottom:20px;display:flex;align-items:center;gap:8px;">
      <span style="font-size:18px;">⏰</span>
      <p style="margin:0;font-size:13px;color:#854d0e;font-weight:600;">Reminder: This request is still awaiting your approval.</p>
    </div>` : ''}

    <h2 style="margin-top:0;">🔐 DLM Approval Required</h2>
    <p>Hello <strong>${dlmName || 'Manager'}</strong>,</p>
    <p>A team member has submitted an IT support ticket that requires <strong>your approval</strong> before it can be processed by the IT team.</p>

    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Ticket ID</span>
        <span class="info-value" style="font-family:monospace;font-weight:800;">${ticketDisplayId || 'N/A'}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Title</span>
        <span class="info-value">${ticketTitle}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Category</span>
        <span class="info-value">${ticketCategory || 'IT Request'}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Priority</span>
        <span class="info-value"><span style="display:inline-block;padding:2px 10px;border-radius:8px;font-size:11px;font-weight:800;background:${pColor}22;color:${pColor};">${ticketPriority}</span></span>
      </div>
      <div class="info-row">
        <span class="info-label">Requested By</span>
        <span class="info-value">${requesterName || requesterEmail}</span>
      </div>
      ${requesterDepartment ? `
      <div class="info-row">
        <span class="info-label">Department</span>
        <span class="info-value">${requesterDepartment}</span>
      </div>` : ''}
      ${requesterJobTitle ? `
      <div class="info-row">
        <span class="info-label">Job Title</span>
        <span class="info-value">${requesterJobTitle}</span>
      </div>` : ''}
    </div>

    ${ticketDescription ? `
    <div style="background:#f8fafc;border-left:4px solid #7c3aed;border-radius:0 8px 8px 0;padding:12px 16px;margin:16px 0;">
      <p style="margin:0;font-size:13px;color:#475569;font-style:italic;">"${ticketDescription.slice(0, 300)}${ticketDescription.length > 300 ? '...' : ''}"</p>
    </div>` : ''}

    <p style="margin-top:20px;">Please review this request and take action directly from the Service Portal. Your timely decision ensures the team member receives support without delay.</p>

    <div style="text-align:center;margin:28px 0;">
      <a class="btn" href="${portalUrl}" style="font-size:15px;padding:14px 36px;">
        ✅ Review &amp; Approve Request
      </a>
    </div>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px 16px;margin-top:16px;">
      <p style="margin:0;font-size:12px;color:#15803d;">
        <strong>What happens next:</strong> If you approve, the ticket will be immediately routed to the IT support team. If you reject it, the requester will be notified with your reason.
      </p>
    </div>
  `;

  const subjectPrefix = isReminder ? '⏰ Reminder: ' : '🔐 Action Required: ';
  return {
    html: baseLayout(content, 'DLM Approval Required'),
    subject: `${subjectPrefix}DLM Approval Needed — ${ticketTitle} (${ticketDisplayId || 'IT Ticket'})`,
  };
}
