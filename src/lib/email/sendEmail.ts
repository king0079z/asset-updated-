import { getResendClient, FROM_EMAIL } from './resend';
import { renderTicketUpdate } from './templates/TicketUpdate';
import { renderSLABreach } from './templates/SLABreach';
import { renderEscalationAlert } from './templates/EscalationAlert';
import { renderApprovalRequest } from './templates/ApprovalRequest';
import { renderOverdueAsset } from './templates/OverdueAsset';
import { renderBorrowOverdue } from './templates/BorrowOverdue';
import { renderWarrantyExpiry } from './templates/WarrantyExpiry';
import { renderWelcomeUser } from './templates/WelcomeUser';

export type EmailTemplate =
  | 'ticket-update'
  | 'sla-breach'
  | 'escalation-alert'
  | 'approval-request'
  | 'overdue-asset'
  | 'borrow-overdue'
  | 'warranty-expiry'
  | 'welcome-user';

interface SendEmailOptions {
  to: string | string[];
  template: EmailTemplate;
  data: Record<string, any>;
  subject?: string;
}

function getRendered(template: EmailTemplate, data: Record<string, any>): { html: string; subject: string } {
  switch (template) {
    case 'ticket-update':     return renderTicketUpdate(data);
    case 'sla-breach':        return renderSLABreach(data);
    case 'escalation-alert':  return renderEscalationAlert(data);
    case 'approval-request':  return renderApprovalRequest(data);
    case 'overdue-asset':     return renderOverdueAsset(data);
    case 'borrow-overdue':    return renderBorrowOverdue(data);
    case 'warranty-expiry':   return renderWarrantyExpiry(data);
    case 'welcome-user':      return renderWelcomeUser(data);
    default:                  return { html: '<p>Notification</p>', subject: 'Notification from Asset AI' };
  }
}

export async function sendEmail({ to, template, data, subject: subjectOverride }: SendEmailOptions): Promise<boolean> {
  const resend = getResendClient();
  if (!resend) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Email Mock] Would send "${template}" to:`, to, 'data:', data);
    }
    return true; // gracefully no-op in dev without key
  }

  try {
    const { html, subject } = getRendered(template, data);
    const recipients = Array.isArray(to) ? to : [to];
    const validRecipients = recipients.filter(Boolean);
    if (!validRecipients.length) return false;

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: validRecipients,
      subject: subjectOverride || subject,
      html,
    });

    if (error) {
      console.error('[Email] Send error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Email] Unexpected error:', err);
    return false;
  }
}
