import { baseLayout } from './base';

export function renderBorrowOverdue(data: Record<string, any>): { html: string; subject: string } {
  const { assetName, assetId, borrowedAt, expectedReturnAt, daysOverdue, borrowerName, url } = data;
  const content = `
    <h2>Borrowed Asset Return Overdue</h2>
    <p>The following asset has not been returned by its expected return date.</p>
    <div class="info-box">
      <div class="info-row"><span class="info-label">Asset</span><span class="info-value">${assetName}</span></div>
      <div class="info-row"><span class="info-label">Asset ID</span><span class="info-value">${assetId}</span></div>
      <div class="info-row"><span class="info-label">Borrowed By</span><span class="info-value">${borrowerName}</span></div>
      <div class="info-row"><span class="info-label">Borrowed On</span><span class="info-value">${borrowedAt}</span></div>
      <div class="info-row"><span class="info-label">Expected Return</span><span class="info-value" style="color:#dc2626;">${expectedReturnAt}</span></div>
      <div class="info-row"><span class="info-label">Days Overdue</span><span class="info-value"><span class="badge badge-red">${daysOverdue} day(s)</span></span></div>
    </div>
    <p>Please arrange for the immediate return of this asset or contact the borrower.</p>
    ${url ? `<a class="btn" href="${url}">Manage Borrow Record</a>` : ''}
  `;
  return { html: baseLayout(content, 'Borrow Overdue'), subject: `⚠️ Overdue Return: ${assetName} — ${daysOverdue} day(s) late` };
}
