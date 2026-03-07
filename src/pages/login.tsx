// @ts-nocheck
import React, { useContext, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AuthContext } from '@/contexts/AuthContext';
import { useToast } from "@/components/ui/use-toast";
import { createClient } from '@/util/supabase/component';
import { isSupabaseConfigured } from '@/util/supabase/env';
import GoogleButton from '@/components/GoogleButton';
import Logo from '@/components/Logo';
import {
  Mail, Lock, Eye, EyeOff, Shield, ArrowRight, Zap, BarChart3,
  MapPin, Cpu, CheckCircle2, Loader2, ChevronRight,
} from 'lucide-react';

/* ──────────────────────────────────────────────────────────────────────────────
 * Tiny validation — replaces Formik + Yup (saves ~80 KB)
 */
function validate(email: string, password: string) {
  const errs: { email?: string; password?: string } = {};
  if (!email) errs.email = 'Email is required';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Enter a valid email';
  if (!password) errs.password = 'Password is required';
  else if (password.length < 4) errs.password = 'Minimum 4 characters';
  return errs;
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Feature list for the left panel
 */
const FEATURES = [
  { icon: BarChart3, label: 'Real-time asset tracking & analytics' },
  { icon: MapPin,    label: 'Live GPS & RFID location intelligence' },
  { icon: Zap,       label: 'Instant alerts and automated workflows' },
  { icon: Cpu,       label: 'AI-powered insights and reporting' },
];

/* ──────────────────────────────────────────────────────────────────────────────
 * Input component — lightweight, no framer-motion
 */
function FormInput({
  id, label, type, placeholder, value, onChange, error, icon: Icon,
  rightSlot,
}: {
  id: string; label: string; type: string; placeholder: string;
  value: string; onChange: (v: string) => void; error?: string;
  icon: React.ElementType; rightSlot?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-slate-700">
        {label}
      </label>
      <div className={`relative flex items-center rounded-xl border-2 transition-all duration-200 bg-white ${
        error ? 'border-red-400 ring-2 ring-red-100'
          : focused ? 'border-indigo-500 ring-2 ring-indigo-100'
          : 'border-slate-200 hover:border-slate-300'
      }`}>
        <Icon className={`absolute left-3.5 h-4 w-4 transition-colors ${focused ? 'text-indigo-500' : 'text-slate-400'}`} />
        <input
          id={id}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="w-full pl-10 pr-10 py-3 text-sm bg-transparent outline-none text-slate-900 placeholder:text-slate-400"
        />
        {rightSlot && <div className="absolute right-3">{rightSlot}</div>}
      </div>
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <span className="h-1 w-1 rounded-full bg-red-500 inline-block" />
          {error}
        </p>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Main page
 */
export default function LoginPage() {
  const router = useRouter();
  const { initializing, signIn } = useContext(AuthContext);
  const { toast } = useToast();
  const supabaseConfigured = isSupabaseConfigured();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading]   = useState(false);
  const [touched, setTouched]       = useState({ email: false, password: false });
  const [errors, setErrors]         = useState<{ email?: string; password?: string }>({});

  // Load saved email
  useEffect(() => {
    const saved = localStorage.getItem('rememberedEmail');
    if (saved) { setEmail(saved); setRememberMe(true); }
  }, []);

  // Validate on change
  useEffect(() => {
    if (touched.email || touched.password) setErrors(validate(email, password));
  }, [email, password, touched]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setTouched({ email: true, password: true });
    const errs = validate(email, password);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    if (!supabaseConfigured) {
      toast({ variant: 'destructive', title: 'Missing configuration', description: 'Supabase is not configured.' });
      return;
    }

    setIsLoading(true);
    try {
      if (rememberMe) localStorage.setItem('rememberedEmail', email);
      else localStorage.removeItem('rememberedEmail');

      await signIn(email, password);

      const supabase = createClient();
      const { data } = await supabase.from('User').select('status').eq('email', email).single();
      router.push(data?.status === 'PENDING' ? '/pending-approval' : '/dashboard');
    } catch {
      toast({ variant: 'destructive', title: 'Login failed', description: 'Please check your credentials and try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const isValid = !Object.keys(validate(email, password)).length;

  return (
    <>
      {/* Lightweight CSS-only animated background — no JS, no canvas, no blur filters */}
      <style>{`
        @keyframes drift1 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(60px,-40px) scale(1.08)} }
        @keyframes drift2 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-50px,60px) scale(1.06)} }
        @keyframes drift3 { 0%,100%{transform:translate(0,0) scale(1.05)} 50%{transform:translate(40px,30px) scale(1)} }
        @keyframes slideUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        .login-panel-animate { animation: slideUp .55s cubic-bezier(.16,1,.3,1) both; }
        .login-fade { animation: fadeIn .4s ease both; }
      `}</style>

      <div className="min-h-screen flex" style={{ background: '#f8fafc' }}>

        {/* ── Left brand panel (desktop only) ─────────────────────────────── */}
        <div className="hidden lg:flex lg:w-[46%] xl:w-[42%] relative overflow-hidden flex-col justify-between p-10"
          style={{ background: 'linear-gradient(145deg,#0f172a 0%,#1e1b4b 45%,#0f2756 100%)' }}>

          {/* CSS orbs — NO JS, NO blur filter, just opacity */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
            <div className="absolute top-[-10%] left-[-10%] w-[55%] h-[55%] rounded-full opacity-[0.18]"
              style={{ background: 'radial-gradient(circle,#6366f1,transparent)', animation: 'drift1 18s ease-in-out infinite' }} />
            <div className="absolute bottom-[-5%] right-[-10%] w-[50%] h-[50%] rounded-full opacity-[0.15]"
              style={{ background: 'radial-gradient(circle,#0ea5e9,transparent)', animation: 'drift2 22s ease-in-out infinite' }} />
            <div className="absolute top-[40%] left-[30%] w-[40%] h-[40%] rounded-full opacity-[0.12]"
              style={{ background: 'radial-gradient(circle,#8b5cf6,transparent)', animation: 'drift3 26s ease-in-out infinite' }} />
          </div>

          {/* Grid overlay */}
          <div className="absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.6) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.6) 1px,transparent 1px)', backgroundSize: '40px 40px' }} />

          {/* Top: Logo */}
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-12">
              <div className="h-10 w-10 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                <Logo />
              </div>
              <span className="text-white font-bold text-lg tracking-tight">AssetXAI</span>
            </div>

            {/* Headline */}
            <div className="mb-10 login-fade" style={{ animationDelay: '.15s' }}>
              <h1 className="text-4xl font-black text-white leading-tight mb-4">
                Enterprise Asset<br />
                <span style={{ background: 'linear-gradient(90deg,#818cf8,#38bdf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  Intelligence Platform
                </span>
              </h1>
              <p className="text-slate-400 text-base leading-relaxed max-w-xs">
                Real-time tracking, AI-powered insights, and seamless operations — all in one place.
              </p>
            </div>

            {/* Feature list */}
            <div className="space-y-3 login-fade" style={{ animationDelay: '.3s' }}>
              {FEATURES.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center flex-shrink-0">
                    <Icon className="h-4 w-4 text-indigo-300" />
                  </div>
                  <span className="text-slate-300 text-sm">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom: trust badge */}
          <div className="relative z-10 login-fade" style={{ animationDelay: '.45s' }}>
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/10">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                <Shield className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-white text-sm font-semibold">Enterprise-grade security</p>
                <p className="text-slate-400 text-xs">SOC 2 ready · End-to-end encrypted · Role-based access</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: login form ───────────────────────────────────────────── */}
        <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-md login-panel-animate">

            {/* Mobile logo */}
            <div className="flex lg:hidden justify-center mb-8">
              <Logo />
            </div>

            {/* Header */}
            <div className="mb-8">
              <h2 className="text-2xl font-black text-slate-900">Welcome back</h2>
              <p className="text-slate-500 text-sm mt-1">Sign in to continue to AssetXAI</p>
            </div>

            {/* Google + Magic link */}
            <div className="space-y-3 mb-6">
              <GoogleButton />
              <button
                onClick={() => router.push('/magic-link-login')}
                className="w-full flex items-center justify-center gap-2.5 h-11 rounded-xl border-2 border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 transition-all duration-150 text-sm font-semibold text-slate-700"
              >
                <Mail className="h-4 w-4 text-slate-500" />
                Continue with Magic Link
              </button>
            </div>

            {/* Separator */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">or sign in with email</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <FormInput
                id="email" label="Email address" type="email"
                placeholder="name@company.com"
                value={email} onChange={setEmail}
                error={touched.email ? errors.email : undefined}
                icon={Mail}
              />
              <FormInput
                id="password" label="Password" type={showPw ? 'text' : 'password'}
                placeholder="••••••••"
                value={password} onChange={setPassword}
                error={touched.password ? errors.password : undefined}
                icon={Lock}
                rightSlot={
                  <button type="button" onClick={() => setShowPw(p => !p)}
                    className="text-slate-400 hover:text-slate-600 transition-colors p-1">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
              />

              {/* Remember + Forgot */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-slate-600">Remember me</span>
                </label>
                <button type="button" onClick={() => router.push('/forgot-password')}
                  className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors">
                  Forgot password?
                </button>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading || initializing}
                className="w-full flex items-center justify-center gap-2.5 h-12 rounded-xl text-white font-bold text-sm transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                style={{
                  background: isLoading ? 'linear-gradient(135deg,#6366f1,#4f46e5)' : 'linear-gradient(135deg,#6366f1,#4f46e5)',
                  boxShadow: '0 4px 14px rgba(99,102,241,0.4)',
                }}
                onMouseEnter={e => { if (!isLoading) e.currentTarget.style.boxShadow = '0 6px 20px rgba(99,102,241,0.55)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 14px rgba(99,102,241,0.4)'; }}
              >
                {isLoading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Signing in…</>
                ) : (
                  <><Shield className="h-4 w-4" />Sign in<ArrowRight className="h-4 w-4 ml-auto" /></>
                )}
              </button>
            </form>

            {/* Sign up link */}
            <p className="mt-6 text-center text-sm text-slate-500">
              Don't have an account?{' '}
              <button onClick={() => router.push('/signup')}
                className="font-bold text-indigo-600 hover:text-indigo-700 transition-colors">
                Create account
              </button>
            </p>

            {/* Legal */}
            <p className="mt-4 text-center text-xs text-slate-400">
              By signing in you agree to our{' '}
              <span className="underline cursor-pointer hover:text-slate-600">Terms of Service</span>
              {' '}and{' '}
              <span className="underline cursor-pointer hover:text-slate-600">Privacy Policy</span>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
