import { baseLayout } from './base';

export function renderApprovalRequest(data: Record<string, any>): { html: string; subject: string } {
  const { entityType, entityId, requestedBy, description, approvalUrl } = data;
  const content = `
    <h2>Approval Required</h2>
    <p><strong>${requestedBy}</strong> has submitted a request that requires your approval.</p>
    <div class="info-box">
      <div class="info-row"><span class="info-label">Request Type</span><span class="info-value">${entityType}</span></div>
      <div class="info-row"><span class="info-label">Reference ID</span><span class="info-value">${entityId}</span></div>
      <div class="info-row"><span class="info-label">Requested By</span><span class="info-value">${requestedBy}</span></div>
      ${description ? `<div class="info-row"><span class="info-label">Details</span><span class="info-value">${description}</span></div>` : ''}
    </div>
    <p>Please review this request and provide your decision at your earliest convenience.</p>
    ${approvalUrl ? `<a class="btn" href="${approvalUrl}">Review & Approve</a>` : ''}
  `;
  return { html: baseLayout(content, 'Approval Required'), subject: `Action Required: Approval for ${entityType} #${entityId}` };
}
