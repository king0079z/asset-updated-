import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { ShieldAlert, Eye, EyeOff, Lock, CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/router';

const SKIP_ROUTES = ['/', '/login', '/signup', '/forgot-password', '/magic-link-login', '/reset-password'];

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: 'At least 8 characters', ok: password.length >= 8 },
    { label: 'Contains a number', ok: /\d/.test(password) },
    { label: 'Contains a letter', ok: /[a-zA-Z]/.test(password) },
  ];
  const passed = checks.filter(c => c.ok).length;
  const colors = ['bg-red-400', 'bg-amber-400', 'bg-yellow-400', 'bg-emerald-500'];

  return (
    <div className="space-y-2 mt-2">
      <div className="flex gap-1">
        {[0, 1, 2].map(i => (
          <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i < passed ? colors[passed] : 'bg-muted'}`} />
        ))}
      </div>
      <div className="space-y-1">
        {checks.map(c => (
          <div key={c.label} className="flex items-center gap-1.5">
            {c.ok
              ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
              : <XCircle className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0" />}
            <span className={`text-xs ${c.ok ? 'text-foreground' : 'text-muted-foreground'}`}>{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ForcePasswordChangeModal() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [mustChange, setMustChange] = useState(false);
  const [checking, setChecking] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Skip on public/auth routes
  const isPublicRoute = SKIP_ROUTES.includes(router.pathname) || router.pathname.startsWith('/outlook');

  useEffect(() => {
    if (!user || isPublicRoute) {
      setMustChange(false);
      return;
    }

    let cancelled = false;
    setChecking(true);

    fetch('/api/users/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!cancelled) setMustChange(data?.mustChangePassword === true);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setChecking(false); });

    return () => { cancelled = true; };
  }, [user?.id, router.pathname]);

  const handleSubmit = async () => {
    if (newPassword.length < 8) {
      toast({ title: 'Too short', description: 'Password must be at least 8 characters.', variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'Mismatch', description: 'Passwords do not match.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/users/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to change password');

      setMustChange(false);
      setNewPassword('');
      setConfirmPassword('');
      toast({ title: 'Password updated', description: 'Your new password is now active. You are still signed in.' });
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to change password', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (isPublicRoute || !user || checking || !mustChange) return null;

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md gap-0 p-0 overflow-hidden"
        onPointerDownOutside={e => e.preventDefault()}
        onEscapeKeyDown={e => e.preventDefault()}
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
              <ShieldAlert className="h-6 w-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-white text-lg font-bold">Password Change Required</DialogTitle>
              <DialogDescription className="text-amber-100 text-sm mt-0.5">
                Your account was set up with a temporary password
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-6 space-y-5">
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-300">
            For your security, you must set a new permanent password before continuing.
            This dialog cannot be dismissed until you update your password.
          </div>

          {/* New password */}
          <div className="space-y-1.5">
            <Label htmlFor="fc-new" className="text-sm font-medium flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
              New Password
            </Label>
            <div className="relative">
              <Input
                id="fc-new"
                type={showNew ? 'text' : 'password'}
                placeholder="Enter your new password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="pr-10 rounded-xl"
                autoFocus
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowNew(v => !v)}
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {newPassword.length > 0 && <PasswordStrength password={newPassword} />}
          </div>

          {/* Confirm password */}
          <div className="space-y-1.5">
            <Label htmlFor="fc-confirm" className="text-sm font-medium flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
              Confirm New Password
            </Label>
            <div className="relative">
              <Input
                id="fc-confirm"
                type={showConfirm ? 'text' : 'password'}
                placeholder="Repeat your new password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className={`pr-10 rounded-xl ${
                  confirmPassword.length > 0 && confirmPassword !== newPassword
                    ? 'border-red-400 focus-visible:ring-red-400'
                    : ''
                }`}
                onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowConfirm(v => !v)}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirmPassword.length > 0 && confirmPassword !== newPassword && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <XCircle className="h-3.5 w-3.5" /> Passwords do not match
              </p>
            )}
          </div>

          <Button
            className="w-full rounded-xl h-11 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold shadow-sm gap-2"
            onClick={handleSubmit}
            disabled={saving || newPassword.length < 8 || newPassword !== confirmPassword}
          >
            {saving
              ? <><div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Updating…</>
              : <><ShieldAlert className="h-4 w-4" /> Set New Password</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
