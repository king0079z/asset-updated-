// @ts-nocheck
import React, { useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthContext } from '@/contexts/AuthContext';
import { useToast } from "@/components/ui/use-toast";
import { createClient } from '@/util/supabase/component';
import { isSupabaseConfigured } from '@/util/supabase/env';
import GoogleButton from '@/components/GoogleButton';
import Logo from '@/components/Logo';
import {
  Mail, Lock, Eye, EyeOff, Shield, ArrowRight,
  MapPin, Loader2, TrendingUp, AlertTriangle,
  Package, Activity, CheckCircle, Wifi, Battery,
} from 'lucide-react';

/* ── Validation ──────────────────────────────────────────────────────────── */
function validate(email: string, password: string) {
  const e: { email?: string; password?: string } = {};
  if (!email) e.email = 'Email is required';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Enter a valid email';
  if (!password) e.password = 'Password is required';
  else if (password.length < 4) e.password = 'Minimum 4 characters';
  return e;
}

/* ── Input ───────────────────────────────────────────────────────────────── */
function Field({ id, label, type, placeholder, value, onChange, error, icon: Icon, right }: any) {
  const [f, setF] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{label}</label>
      <div className={`relative flex items-center rounded-2xl transition-all duration-200 ${
        error ? 'ring-2 ring-red-400/60' : f ? 'ring-2 ring-violet-500/60' : 'ring-1 ring-slate-200'
      } bg-white shadow-sm`}>
        <Icon className={`absolute left-4 h-4 w-4 transition-colors duration-150 ${f ? 'text-violet-500' : 'text-slate-400'}`} />
        <input id={id} type={type} placeholder={placeholder} value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setF(true)} onBlur={() => setF(false)}
          className="w-full pl-11 pr-11 py-3.5 text-sm bg-transparent outline-none text-slate-900 placeholder:text-slate-300 rounded-2xl"
        />
        {right && <div className="absolute right-3">{right}</div>}
      </div>
      {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
    </div>
  );
}

/* ── Mini sparkline bars ─────────────────────────────────────────────────── */
function Bars({ data, color }: { data: number[]; color: string }) {
  return (
    <div className="flex items-end gap-[3px] h-8">
      {data.map((h, i) => (
        <div key={i} className="flex-1 rounded-sm transition-all"
          style={{ height: `${h}%`, background: color, opacity: 0.5 + i * 0.07 }} />
      ))}
    </div>
  );
}

/* ── Mini map SVG ────────────────────────────────────────────────────────── */
function MiniMap() {
  const pins = [
    { x: 72, y: 38, size: 8, pulse: true,  color: '#4ade80' },
    { x: 31, y: 55, size: 7, pulse: false, color: '#818cf8' },
    { x: 58, y: 68, size: 6, pulse: true,  color: '#f59e0b' },
    { x: 85, y: 62, size: 7, pulse: false, color: '#818cf8' },
    { x: 20, y: 30, size: 5, pulse: false, color: '#818cf8' },
  ];
  return (
    <svg viewBox="0 0 120 90" className="w-full h-full" style={{ overflow: 'visible' }}>
      {/* Roads */}
      <path d="M10,45 Q40,30 80,50 Q100,55 115,45" stroke="rgba(255,255,255,0.12)" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <path d="M25,20 Q45,50 40,75" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <path d="M60,15 L65,80" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      {/* Route line */}
      <path d="M31,55 Q52,42 72,38" stroke="#818cf8" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeDasharray="4 3" opacity="0.7"/>
      {/* Pins */}
      {pins.map((p, i) => (
        <g key={i}>
          {p.pulse && (
            <circle cx={p.x} cy={p.y} r={p.size + 5} fill={p.color} opacity="0.2">
              <animate attributeName="r" values={`${p.size+3};${p.size+9};${p.size+3}`} dur="2.5s" repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0.2;0;0.2" dur="2.5s" repeatCount="indefinite"/>
            </circle>
          )}
          <circle cx={p.x} cy={p.y} r={p.size * 0.6} fill={p.color} />
          <circle cx={p.x} cy={p.y} r={p.size} fill={p.color} opacity="0.25" />
        </g>
      ))}
    </svg>
  );
}

/* ── Alert rows ──────────────────────────────────────────────────────────── */
const ALERTS = [
  { icon: Battery, label: 'RFID Tag — Low Battery', sub: 'Asset #A-1204', color: '#f59e0b', time: '2m ago' },
  { icon: MapPin, label: 'Zone Breach Detected', sub: 'Server Room B', color: '#f87171', time: '8m ago' },
  { icon: Package, label: 'Asset Check-in', sub: 'Laptop #L-0093', color: '#4ade80', time: '14m ago' },
];

/* ── Main page ───────────────────────────────────────────────────────────── */
export default function LoginPage() {
  const router = useRouter();
  const { initializing, signIn } = useContext(AuthContext);
  const { toast } = useToast();
  const supabaseConfigured = isSupabaseConfigured();

  const [email, setEmail]     = useState('');
  const [password, setPass]   = useState('');
  const [showPw, setShowPw]   = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });
  const [errors, setErrors]   = useState<any>({});

  useEffect(() => {
    const s = localStorage.getItem('rememberedEmail');
    if (s) { setEmail(s); setRemember(true); }
  }, []);

  useEffect(() => {
    if (touched.email || touched.password) setErrors(validate(email, password));
  }, [email, password, touched]);

  const submit = async (e?: any) => {
    e?.preventDefault();
    setTouched({ email: true, password: true });
    const errs = validate(email, password);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    if (!supabaseConfigured) {
      toast({ variant: 'destructive', title: 'Configuration missing' });
      return;
    }
    setLoading(true);
    try {
      if (remember) localStorage.setItem('rememberedEmail', email);
      else localStorage.removeItem('rememberedEmail');
      await signIn(email, password);
      const supabase = createClient();
      const { data } = await supabase.from('User').select('status').eq('email', email).single();
      router.push(data?.status === 'PENDING' ? '/pending-approval' : '/dashboard');
    } catch {
      toast({ variant: 'destructive', title: 'Login failed', description: 'Check your credentials and try again.' });
    } finally { setLoading(false); }
  };

  return (
    <>
      <style>{`
        @keyframes floatA { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-12px)} }
        @keyframes floatB { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-8px)} }
        @keyframes floatC { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-10px)} }
        @keyframes slideUp { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeSlide { from{opacity:0;transform:translateX(-16px)} to{opacity:1;transform:translateX(0)} }
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        .fa { animation: floatA 7s ease-in-out infinite; will-change: transform; }
        .fb { animation: floatB 9s ease-in-out infinite 1s; will-change: transform; }
        .fc { animation: floatC 8s ease-in-out infinite 2s; will-change: transform; }
        .su { animation: slideUp .6s cubic-bezier(.16,1,.3,1) both; }
        .fs { animation: fadeSlide .5s cubic-bezier(.16,1,.3,1) both; }
        .su1 { animation-delay: .05s; }
        .su2 { animation-delay: .12s; }
        .su3 { animation-delay: .20s; }
        .su4 { animation-delay: .28s; }
        .su5 { animation-delay: .36s; }
        .glass-card {
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.12);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          border-radius: 20px;
        }
        .btn-primary {
          background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 50%, #2563eb 100%);
          box-shadow: 0 4px 20px rgba(124,58,237,0.45), inset 0 1px 0 rgba(255,255,255,0.15);
          transition: box-shadow .2s, transform .15s;
        }
        .btn-primary:hover:not(:disabled) {
          box-shadow: 0 8px 28px rgba(124,58,237,0.6), inset 0 1px 0 rgba(255,255,255,0.2);
          transform: translateY(-1px);
        }
        .btn-primary:active:not(:disabled) { transform: translateY(0); }
        .oauth-btn {
          border: 1.5px solid rgba(0,0,0,0.08);
          background: white;
          box-shadow: 0 1px 4px rgba(0,0,0,0.06);
          transition: box-shadow .15s, transform .1s, background .15s;
        }
        .oauth-btn:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.1); transform: translateY(-1px); background: #fafafa; }
        .stat-badge {
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 999px;
        }
        .mobile-logo { display: flex; }
        @media (min-width: 1024px) { .mobile-logo { display: none !important; } }
      `}</style>

      <div style={{ minHeight: '100vh', display: 'flex', background: '#f1f5fd' }}>

        {/* ════════════════════════════════════════════════════════
            LEFT BRAND PANEL
        ════════════════════════════════════════════════════════ */}
        <div className="hidden lg:flex" style={{
          width: '54%', position: 'relative', overflow: 'hidden', flexDirection: 'column',
          background: 'linear-gradient(160deg, #09071f 0%, #110d3b 30%, #0d1a50 65%, #061226 100%)',
        }}>

          {/* Background accent lights — static radials, no blur */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', top: '-5%', left: '-8%', width: '60%', height: '55%',
              background: 'radial-gradient(circle at 40% 50%, rgba(124,58,237,0.28) 0%, transparent 70%)' }} />
            <div style={{ position: 'absolute', bottom: '5%', right: '-5%', width: '55%', height: '50%',
              background: 'radial-gradient(circle at 60% 50%, rgba(59,130,246,0.22) 0%, transparent 70%)' }} />
            <div style={{ position: 'absolute', top: '40%', left: '30%', width: '40%', height: '40%',
              background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)' }} />
          </div>

          {/* Dot grid */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.3,
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.35) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }} />

          {/* Diagonal accent lines */}
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} aria-hidden>
            <line x1="0" y1="70%" x2="100%" y2="30%" stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
            <line x1="0" y1="90%" x2="100%" y2="50%" stroke="rgba(255,255,255,0.03)" strokeWidth="1"/>
          </svg>

          {/* ── Content ── */}
          <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', height: '100%', padding: '40px 48px' }}>

            {/* Logo row */}
            <div className="fs" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 52 }}>
              <div style={{ height: 42, width: 42, borderRadius: 14, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Logo />
              </div>
              <div>
                <span style={{ color: 'white', fontWeight: 800, fontSize: 18, letterSpacing: '-0.3px' }}>AssetXAI</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
                  <Wifi style={{ width: 10, height: 10, color: '#4ade80' }} />
                  <span style={{ color: '#4ade80', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em' }}>LIVE</span>
                </div>
              </div>
            </div>

            {/* Headline */}
            <div className="fs" style={{ animationDelay: '.1s', marginBottom: 40, maxWidth: 400 }}>
              <div className="stat-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', marginBottom: 18 }}>
                <Activity style={{ width: 12, height: 12, color: '#818cf8' }} />
                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em' }}>ENTERPRISE ASSET PLATFORM</span>
              </div>
              <h1 style={{ color: 'white', fontSize: 40, fontWeight: 900, lineHeight: 1.1, marginBottom: 14, letterSpacing: '-0.5px' }}>
                Intelligent Control<br />
                <span style={{ background: 'linear-gradient(90deg, #a78bfa, #60a5fa, #34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                  Over Every Asset
                </span>
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 15, lineHeight: 1.7 }}>
                Real-time GPS, RFID tracking, AI analytics, and automated workflows — unified for enterprise teams.
              </p>
            </div>

            {/* ── Floating UI Preview Cards ── */}
            <div style={{ position: 'relative', flex: 1, minHeight: 320 }}>

              {/* Card 1: Asset Overview — center-left */}
              <div className="fa glass-card" style={{ position: 'absolute', top: '0%', left: 0, width: 210, padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Package style={{ width: 13, height: 13, color: 'white' }} />
                    </div>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600 }}>Total Assets</span>
                  </div>
                  <div style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 6, padding: '2px 7px' }}>
                    <span style={{ color: '#4ade80', fontSize: 10, fontWeight: 700 }}>+12 today</span>
                  </div>
                </div>
                <p style={{ color: 'white', fontSize: 32, fontWeight: 900, lineHeight: 1, marginBottom: 12 }}>1,247</p>
                <Bars data={[45, 62, 55, 78, 68, 88, 82]} color="linear-gradient(to top, #7c3aed, #a78bfa)" />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                  {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => (
                    <span key={d} style={{ color: 'rgba(255,255,255,0.25)', fontSize: 9, flex: 1, textAlign: 'center' }}>{d}</span>
                  ))}
                </div>
              </div>

              {/* Card 2: Live Map — top-right */}
              <div className="fb glass-card" style={{ position: 'absolute', top: '2%', right: 0, width: 220, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#0ea5e9,#0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <MapPin style={{ width: 13, height: 13, color: 'white' }} />
                    </div>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600 }}>Live Locations</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80' }} />
                    <span style={{ color: '#4ade80', fontSize: 10, fontWeight: 700 }}>124</span>
                  </div>
                </div>
                {/* Mini map */}
                <div style={{ height: 100, borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', padding: 8 }}>
                  <MiniMap />
                </div>
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, marginTop: 8, textAlign: 'center' }}>GPS + RFID · Updated just now</p>
              </div>

              {/* Card 3: Recent Alerts — bottom */}
              <div className="fc glass-card" style={{ position: 'absolute', bottom: '5%', left: '10%', right: '5%', padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#f59e0b,#d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <AlertTriangle style={{ width: 13, height: 13, color: 'white' }} />
                    </div>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600 }}>Recent Activity</span>
                  </div>
                  <div style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 6, padding: '2px 7px' }}>
                    <span style={{ color: '#f87171', fontSize: 10, fontWeight: 700 }}>3 alerts</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {ALERTS.map(({ icon: Icon, label, sub, color, time }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon style={{ width: 13, height: 13, color }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</p>
                        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>{sub}</p>
                      </div>
                      <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, flexShrink: 0 }}>{time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Trust strip */}
            <div className="fs" style={{ animationDelay: '.3s', display: 'flex', alignItems: 'center', gap: 16, marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex' }}>
                {['#7c3aed','#0ea5e9','#10b981','#f59e0b','#ef4444'].map((c, i) => (
                  <div key={i} style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: '2px solid rgba(255,255,255,0.15)', marginLeft: i ? -8 : 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: 'white', fontSize: 10, fontWeight: 700 }}>{String.fromCharCode(65+i)}</span>
                  </div>
                ))}
              </div>
              <div>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 600 }}>Trusted by 500+ organizations</p>
                <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} width="10" height="10" viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  ))}
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginLeft: 4 }}>4.9/5 rating</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════
            RIGHT FORM PANEL
        ════════════════════════════════════════════════════════ */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', position: 'relative', overflow: 'hidden' }}>

          {/* Subtle background decoration for right panel */}
          <div style={{ position: 'absolute', top: '-20%', right: '-10%', width: '50%', height: '60%',
            background: 'radial-gradient(circle, rgba(124,58,237,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: '-10%', left: '-5%', width: '40%', height: '50%',
            background: 'radial-gradient(circle, rgba(59,130,246,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />

          <div className="su" style={{ width: '100%', maxWidth: 400, position: 'relative', zIndex: 10 }}>

            {/* Mobile-only logo */}
            <div className="mobile-logo su su1" style={{ alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 32 }}>
              <div style={{ height: 40, width: 40, borderRadius: 12, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(124,58,237,0.4)' }}>
                <Logo />
              </div>
              <span style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.3px' }}>AssetXAI</span>
            </div>

            {/* Heading */}
            <div className="su su1" style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 28, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px', marginBottom: 6 }}>Welcome back</h2>
              <p style={{ fontSize: 14, color: '#64748b' }}>Sign in to your account to continue</p>
            </div>

            {/* OAuth buttons */}
            <div className="su su2" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              <div className="oauth-btn" style={{ borderRadius: 14, overflow: 'hidden' }}>
                <GoogleButton />
              </div>
              <button
                onClick={() => router.push('/magic-link-login')}
                className="oauth-btn"
                style={{ width: '100%', height: 48, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 14, fontWeight: 600, color: '#374151', cursor: 'pointer' }}
              >
                <Mail style={{ width: 16, height: 16, color: '#6366f1' }} />
                Continue with Magic Link
              </button>
            </div>

            {/* Divider */}
            <div className="su su2" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
              <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em' }}>OR</span>
              <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
            </div>

            {/* Form */}
            <form onSubmit={submit} noValidate>
              <div className="su su3" style={{ marginBottom: 14 }}>
                <Field id="email" label="Email address" type="email" placeholder="name@company.com"
                  value={email} onChange={setEmail} error={touched.email ? errors.email : undefined} icon={Mail} />
              </div>
              <div className="su su4" style={{ marginBottom: 16 }}>
                <Field id="password" label="Password" type={showPw ? 'text' : 'password'} placeholder="••••••••"
                  value={password} onChange={setPass} error={touched.password ? errors.password : undefined} icon={Lock}
                  right={
                    <button type="button" onClick={() => setShowPw(p => !p)}
                      style={{ color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
                      {showPw ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                    </button>
                  }
                />
              </div>

              {/* Remember + Forgot */}
              <div className="su su4" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
                  <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                    style={{ width: 15, height: 15, accentColor: '#7c3aed', borderRadius: 4, cursor: 'pointer' }} />
                  <span style={{ fontSize: 13, color: '#64748b' }}>Remember me</span>
                </label>
                <button type="button" onClick={() => router.push('/forgot-password')}
                  style={{ fontSize: 13, fontWeight: 700, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  Forgot password?
                </button>
              </div>

              {/* Submit */}
              <div className="su su5">
                <button type="submit" disabled={loading || initializing} className="btn-primary"
                  style={{ width: '100%', height: 52, borderRadius: 14, color: 'white', fontWeight: 800, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, border: 'none', cursor: loading || initializing ? 'not-allowed' : 'pointer', opacity: loading || initializing ? 0.75 : 1, letterSpacing: '-0.1px' }}>
                  {loading ? (
                    <><Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} />Signing in…</>
                  ) : (
                    <>
                      <Shield style={{ width: 17, height: 17 }} />
                      Sign in to Dashboard
                      <ArrowRight style={{ width: 16, height: 16, marginLeft: 'auto' }} />
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Security pill */}
            <div className="su su5" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16, padding: '8px 16px', borderRadius: 999, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)', width: 'fit-content', margin: '16px auto 0' }}>
              <CheckCircle style={{ width: 12, height: 12, color: '#10b981' }} />
              <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>256-bit SSL · SOC 2 Ready · Zero data sharing</span>
            </div>

            {/* Sign up */}
            <p className="su su5" style={{ marginTop: 24, textAlign: 'center', fontSize: 14, color: '#64748b' }}>
              Don't have an account?{' '}
              <button onClick={() => router.push('/signup')}
                style={{ fontWeight: 800, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                Create free account
              </button>
            </p>

            {/* Legal */}
            <p style={{ marginTop: 16, textAlign: 'center', fontSize: 11, color: '#94a3b8' }}>
              By signing in you agree to our{' '}
              <span style={{ textDecoration: 'underline', cursor: 'pointer', color: '#64748b' }}>Terms</span>
              {' '}&{' '}
              <span style={{ textDecoration: 'underline', cursor: 'pointer', color: '#64748b' }}>Privacy Policy</span>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
