import { baseLayout } from './base';

export function renderOverdueAsset(data: Record<string, any>): { html: string; subject: string } {
  const { assetName, assetId, dueDate, type, assigneeName, url } = data;
  const content = `
    <h2>Asset Action Overdue</h2>
    <p>An asset under your responsibility requires immediate attention.</p>
    <div class="info-box">
      <div class="info-row"><span class="info-label">Asset</span><span class="info-value">${assetName}</span></div>
      <div class="info-row"><span class="info-label">Asset ID</span><span class="info-value">${assetId}</span></div>
      <div class="info-row"><span class="info-label">Issue</span><span class="info-value"><span class="badge badge-red">${type}</span></span></div>
      <div class="info-row"><span class="info-label">Due Date</span><span class="info-value" style="color:#dc2626;">${dueDate}</span></div>
      ${assigneeName ? `<div class="info-row"><span class="info-label">Assigned To</span><span class="info-value">${assigneeName}</span></div>` : ''}
    </div>
    ${url ? `<a class="btn" href="${url}">View Asset</a>` : ''}
  `;
  return { html: baseLayout(content, 'Asset Overdue'), subject: `⚠️ Overdue: ${assetName} — ${type}` };
}
