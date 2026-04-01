import { baseLayout } from './base';

export function renderTicketUpdate(data: Record<string, any>): { html: string; subject: string } {
  const { ticketId, title, status, priority, updatedBy, comment, ticketUrl } = data;
  const statusColors: Record<string, string> = {
    OPEN: 'badge-blue', IN_PROGRESS: 'badge-yellow', RESOLVED: 'badge-green',
    CLOSED: 'badge-green', ESCALATED: 'badge-red', PENDING: 'badge-yellow',
  };
  const content = `
    <h2>Ticket Updated</h2>
    <p>Your ticket has been updated by <strong>${updatedBy || 'the support team'}</strong>.</p>
    <div class="info-box">
      <div class="info-row"><span class="info-label">Ticket ID</span><span class="info-value">${ticketId}</span></div>
      <div class="info-row"><span class="info-label">Title</span><span class="info-value">${title}</span></div>
      <div class="info-row"><span class="info-label">Status</span><span class="info-value"><span class="badge ${statusColors[status] || 'badge-blue'}">${status}</span></span></div>
      <div class="info-row"><span class="info-label">Priority</span><span class="info-value">${priority}</span></div>
    </div>
    ${comment ? `<p><strong>Comment:</strong> ${comment}</p>` : ''}
    ${ticketUrl ? `<a class="btn" href="${ticketUrl}">View Ticket</a>` : ''}
  `;
  return { html: baseLayout(content, 'Ticket Updated'), subject: `[Ticket ${ticketId}] ${title} — Status: ${status}` };
}
