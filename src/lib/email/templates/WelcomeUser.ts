import { baseLayout } from './base';

export function renderWelcomeUser(data: Record<string, any>): { html: string; subject: string } {
  const { userName, email, loginUrl, organizationName } = data;
  const content = `
    <h2>Welcome to AssetXAI!</h2>
    <p>Hello <strong>${userName || email}</strong>, your account has been set up${organizationName ? ` for <strong>${organizationName}</strong>` : ''}.</p>
    <div class="info-box">
      <div class="info-row"><span class="info-label">Email</span><span class="info-value">${email}</span></div>
      ${organizationName ? `<div class="info-row"><span class="info-label">Organization</span><span class="info-value">${organizationName}</span></div>` : ''}
    </div>
    <p>You can now log in to manage assets, raise tickets, track inventory, and more.</p>
    ${loginUrl ? `<a class="btn" href="${loginUrl}">Sign In Now</a>` : ''}
    <p style="font-size:12px;color:#94a3b8;margin-top:24px;">If you did not create this account, please contact your administrator immediately.</p>
  `;
  return { html: baseLayout(content, 'Welcome to AssetXAI'), subject: `Welcome to AssetXAI${organizationName ? ` — ${organizationName}` : ''}` };
}
