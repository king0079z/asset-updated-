import { baseLayout } from './base';

export function renderWarrantyExpiry(data: Record<string, any>): { html: string; subject: string } {
  const { assetName, assetId, expiryDate, daysRemaining, type, url } = data;
  const urgency = daysRemaining <= 7 ? 'badge-red' : daysRemaining <= 30 ? 'badge-yellow' : 'badge-blue';
  const content = `
    <h2>${type || 'Warranty'} Expiring Soon</h2>
    <p>An asset's ${(type || 'warranty').toLowerCase()} is approaching expiry. Please take action to renew or plan accordingly.</p>
    <div class="info-box">
      <div class="info-row"><span class="info-label">Asset</span><span class="info-value">${assetName}</span></div>
      <div class="info-row"><span class="info-label">Asset ID</span><span class="info-value">${assetId}</span></div>
      <div class="info-row"><span class="info-label">Expiry Date</span><span class="info-value">${expiryDate}</span></div>
      <div class="info-row"><span class="info-label">Days Remaining</span><span class="info-value"><span class="badge ${urgency}">${daysRemaining} day(s)</span></span></div>
    </div>
    ${url ? `<a class="btn" href="${url}">View Asset Details</a>` : ''}
  `;
  return { html: baseLayout(content, 'Warranty Expiry'), subject: `⚡ ${type || 'Warranty'} Expiring in ${daysRemaining} days: ${assetName}` };
}
