// @ts-nocheck
import React, { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Mail, CheckCircle, ExternalLink, Settings, Code, Webhook,
  Globe, ArrowRight, Copy, AlertTriangle
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function ITSMIntegrationPage() {
  const { toast } = useToast();
  const [emailWebhookSecret, setEmailWebhookSecret] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [testing, setTesting] = useState(false);

  const ingestUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/tickets/email-ingest`
    : 'https://your-domain.com/api/tickets/email-ingest';

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text);
    toast({ title: 'Copied to clipboard' });
  };

  const sendTestEmail = async () => {
    setTesting(true);
    const res = await fetch('/api/tickets/email-ingest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(emailWebhookSecret ? { 'x-webhook-secret': emailWebhookSecret } : {}),
      },
      body: JSON.stringify({
        from: testEmail || 'test@example.com',
        subject: 'Test Ticket from Email Integration',
        text: 'This is a test email-to-ticket submission. If you see this ticket in the system, the integration is working.',
      }),
    });
    setTesting(false);
    if (res.ok) {
      const data = await res.json();
      toast({ title: 'Test ticket created!', description: `Ticket ${data.displayId} created successfully` });
    } else toast({ variant: 'destructive', title: 'Test failed' });
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
            <Mail className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">ITSM & Email Integration</h1>
            <p className="text-sm text-gray-500">Email-to-ticket for Outlook, Gmail, and any SMTP source</p>
          </div>
        </div>

        {/* Email-to-Ticket */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Webhook className="w-4 h-4" />Email-to-Ticket Webhook</CardTitle>
            <CardDescription>Forward emails to this endpoint to automatically create support tickets</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Ingest Endpoint URL</label>
              <div className="flex items-center gap-2">
                <Input readOnly value={ingestUrl} className="font-mono text-sm bg-gray-50 flex-1" />
                <Button variant="outline" size="sm" onClick={() => copy(ingestUrl)}><Copy className="w-4 h-4" /></Button>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Webhook Secret (optional)</label>
              <Input value={emailWebhookSecret} onChange={e => setEmailWebhookSecret(e.target.value)}
                placeholder="Set EMAIL_WEBHOOK_SECRET in Vercel env vars" className="font-mono text-sm" />
              <p className="text-xs text-gray-400 mt-1">Pass as x-webhook-secret header from your email provider</p>
            </div>

            {/* Supported providers */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { name: 'Microsoft Outlook / Office 365', status: 'Ready', color: 'bg-blue-100 text-blue-700', how: 'Create a connector or Power Automate flow to POST emails to the ingest URL' },
                { name: 'Gmail / Google Workspace', status: 'Ready', color: 'bg-red-100 text-red-700', how: 'Use Google Apps Script or Gmail filter + Zapier to forward to webhook' },
                { name: 'Mailgun Inbound Routes', status: 'Ready', color: 'bg-purple-100 text-purple-700', how: 'Configure Mailgun inbound route to forward parsed email JSON to this URL' },
                { name: 'SendGrid Inbound Parse', status: 'Ready', color: 'bg-green-100 text-green-700', how: 'Configure SendGrid Inbound Parse webhook to this URL' },
              ].map(p => (
                <div key={p.name} className="border rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-gray-800">{p.name}</p>
                    <Badge className={`text-xs ${p.color}`}>{p.status}</Badge>
                  </div>
                  <p className="text-xs text-gray-500">{p.how}</p>
                </div>
              ))}
            </div>

            {/* Test */}
            <div className="border-t pt-4">
              <p className="text-sm font-semibold text-gray-700 mb-2">Test Email Integration</p>
              <div className="flex gap-2">
                <Input value={testEmail} onChange={e => setTestEmail(e.target.value)}
                  placeholder="sender@example.com" className="flex-1" />
                <Button onClick={sendTestEmail} disabled={testing} className="whitespace-nowrap">
                  {testing ? 'Testing...' : 'Send Test'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Outlook Add-In */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Mail className="w-4 h-4" />Microsoft Outlook Add-In</CardTitle>
            <CardDescription>Native Outlook integration — create tickets directly from emails in Outlook</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              Outlook add-in is available at <code className="bg-green-100 px-1 rounded">/outlook/taskpane</code>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="border rounded-xl p-3">
                <p className="font-semibold text-gray-800 mb-1">Features</p>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• Create tickets from email context</li>
                  <li>• Auto-fill ticket from email subject/body</li>
                  <li>• View ticket status from Outlook</li>
                  <li>• Attach emails as ticket documents</li>
                </ul>
              </div>
              <div className="border rounded-xl p-3">
                <p className="font-semibold text-gray-800 mb-1">Deploy Add-In</p>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• Download manifest from /api/outlook/manifest</li>
                  <li>• Upload to Microsoft 365 Admin Center</li>
                  <li>• Or sideload for development testing</li>
                </ul>
                <a href="/api/outlook/manifest" target="_blank" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-2">
                  <ExternalLink className="w-3 h-3" />Download Manifest
                </a>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Webhook API docs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Code className="w-4 h-4" />REST API Integration</CardTitle>
            <CardDescription>Use the REST API to integrate any external ITSM system</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="bg-gray-900 rounded-xl p-4 text-xs font-mono text-green-400 overflow-x-auto">
              <p className="text-gray-400 mb-2"># Create ticket via API</p>
              <p>POST /api/tickets</p>
              <p>Authorization: Bearer {'<token>'}</p>
              <p>Content-Type: application/json</p>
              <p>{`{`}</p>
              <p className="pl-4">"title": "Issue description",</p>
              <p className="pl-4">"description": "Detailed description",</p>
              <p className="pl-4">"priority": "HIGH",</p>
              <p className="pl-4">"category": "MAINTENANCE",</p>
              <p className="pl-4">"assetId": "optional-asset-id",</p>
              <p className="pl-4">"source": "EXTERNAL_ITSM"</p>
              <p>{`}`}</p>
            </div>
            <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              All API endpoints support JWT Bearer token auth. Get your token by calling POST /api/users/provision or signing in via Supabase Auth.
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

