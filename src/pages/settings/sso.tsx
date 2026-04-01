// @ts-nocheck
import React, { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Shield, CheckCircle, ExternalLink, Info, Key, Globe, Users } from 'lucide-react';

export default function SSOSettingsPage() {
  const [tenantId, setTenantId] = useState('');
  const [clientId, setClientId] = useState('');
  const [saved, setSaved] = useState(false);

  const callbackUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/auth/callback`
    : '';

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">SSO Configuration</h1>
            <p className="text-sm text-gray-500">Configure Microsoft Azure AD Single Sign-On for your organization</p>
          </div>
          <Badge className="ml-auto bg-green-100 text-green-700 border-green-200">
            <CheckCircle className="w-3 h-3 mr-1" /> Supported
          </Badge>
        </div>

        {/* Status Card */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">How Azure AD SSO works in Asset AI</p>
                <p>Azure AD SSO is handled through Supabase Auth. You need to configure the Azure OAuth provider in your Supabase project dashboard, then users will see the "Sign in with Microsoft" button on the login page and will be redirected through Azure AD authentication automatically.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Setup Steps */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Setup Instructions</CardTitle>
            <CardDescription>Follow these steps to configure Azure AD SSO</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              {
                step: 1,
                title: 'Register an App in Azure Portal',
                description: 'Go to Azure Portal → Azure Active Directory → App Registrations → New Registration',
                link: 'https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade',
                linkText: 'Open Azure Portal',
              },
              {
                step: 2,
                title: 'Configure Redirect URI',
                description: `Set the redirect URI in your Azure App to your Supabase callback URL. You can find this in your Supabase dashboard under Authentication > Providers > Azure.`,
                code: callbackUrl || 'https://your-project.supabase.co/auth/v1/callback',
              },
              {
                step: 3,
                title: 'Enable Azure Provider in Supabase',
                description: 'In your Supabase project dashboard, go to Authentication → Providers → Azure. Enable it and enter your Azure App\'s Client ID and Secret.',
                link: 'https://supabase.com/dashboard',
                linkText: 'Open Supabase Dashboard',
              },
              {
                step: 4,
                title: 'Grant API Permissions',
                description: 'In your Azure App, go to API Permissions and add: User.Read, email, openid, profile from Microsoft Graph.',
              },
              {
                step: 5,
                title: 'Test the Integration',
                description: 'Log out and visit the login page. Click "Sign in with Microsoft" to verify the SSO flow works.',
              },
            ].map(({ step, title, description, link, linkText, code }) => (
              <div key={step} className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {step}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 mb-1">{title}</p>
                  <p className="text-sm text-gray-600 mb-2">{description}</p>
                  {code && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 font-mono text-xs text-gray-700 break-all">
                      {code}
                    </div>
                  )}
                  {link && (
                    <a href={link} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1">
                      <ExternalLink className="w-3 h-3" />
                      {linkText}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Reference Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Key className="w-4 h-4" /> Your App Details (Reference)</CardTitle>
            <CardDescription>Store these for reference when configuring Azure AD</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Callback URL</label>
              <div className="flex items-center gap-2">
                <Input readOnly value={callbackUrl} className="font-mono text-sm bg-gray-50" />
                <Button variant="outline" size="sm" onClick={() => navigator.clipboard?.writeText(callbackUrl)}>
                  Copy
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Azure Tenant ID (for reference)</label>
                <Input value={tenantId} onChange={e => setTenantId(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" className="font-mono text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Azure Client ID (for reference)</label>
                <Input value={clientId} onChange={e => setClientId(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" className="font-mono text-sm" />
              </div>
            </div>
            <p className="text-xs text-gray-400">These values are stored locally for your reference only. The actual configuration is done in Supabase dashboard.</p>
          </CardContent>
        </Card>

        {/* Features Unlocked */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Users className="w-4 h-4" /> Features Enabled with SSO</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {[
                'Single Sign-On for all users',
                'MFA via Azure AD policies',
                'Auto-provisioning from Azure AD',
                'Conditional Access support',
                'Role mapping from Azure groups',
                'Session management via Azure',
                'Audit logs in Azure AD',
                'Enterprise-grade security',
              ].map(feature => (
                <div key={feature} className="flex items-center gap-2 text-sm text-gray-700">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  {feature}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

