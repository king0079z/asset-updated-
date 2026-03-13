// @ts-nocheck
import React, { useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { AuthContext } from '@/contexts/AuthContext';
import { useToast } from "@/components/ui/use-toast";
import { createClient } from '@/util/supabase/component';
import { isSupabaseConfigured } from '@/util/supabase/env';
import {
  Mail, Lock, Eye, EyeOff, Shield, ArrowRight,
  MapPin, Loader2, AlertTriangle, Package,
  Activity, CheckCircle, Wifi, Battery, TrendingUp,
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

/* ── Brand logo (inline — no external Logo component) ────────────────────── */
function BrandMark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sz = { sm: { box: 32, icon: 15, text: 15 }, md: { box: 42, icon: 19, text: 19 }, lg: { box: 52, icon: 23, text: 23 } }[size];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: sz.box * 0.28 }}>
      <div style={{ width: sz.box, height: sz.box, borderRadius: sz.box * 0.3, background: 'linear-gradient(135deg,#7c3aed,#4f46e5,#2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(124,58,237,0.45)', flexShrink: 0 }}>
        <Package style={{ width: sz.icon, height: sz.icon, color: 'white' }} />
      </div>
      <span style={{ fontSize: sz.text, fontWeight: 900, color: 'white', letterSpacing: '-0.4px' }}>AssetXAI</span>
    </div>
  );
}

/* ── Input field ─────────────────────────────────────────────────────────── */
function Field({ id, label, type, placeholder, value, onChange, error, icon: Icon, right }: any) {
  const [f, setF] = useState(false);
  return (
    <div>
      <label htmlFor={id} style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</label>
      <div style={{
        position: 'relative', display: 'flex', alignItems: 'center', borderRadius: 14,
        background: 'white', transition: 'box-shadow .2s',
        boxShadow: error ? '0 0 0 2px rgba(239,68,68,0.5)' : f ? '0 0 0 2.5px rgba(124,58,237,0.55), 0 2px 8px rgba(124,58,237,0.1)' : '0 0 0 1.5px #e2e8f0, 0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <Icon style={{ position: 'absolute', left: 16, width: 16, height: 16, color: f ? '#7c3aed' : '#94a3b8', transition: 'color .15s' }} />
        <input id={id} type={type} placeholder={placeholder} value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setF(true)} onBlur={() => setF(false)}
          style={{ width: '100%', paddingLeft: 46, paddingRight: right ? 44 : 16, paddingTop: 15, paddingBottom: 15, fontSize: 14, background: 'transparent', outline: 'none', color: '#0f172a', borderRadius: 14 }}
        />
        {right && <div style={{ position: 'absolute', right: 12 }}>{right}</div>}
      </div>
      {error && <p style={{ marginTop: 6, fontSize: 12, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#ef4444', display: 'inline-block', flexShrink: 0 }} />{error}
      </p>}
    </div>
  );
}

/* ── Mini sparkline bars ─────────────────────────────────────────────────── */
function Bars({ data, color }: { data: number[]; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 32 }}>
      {data.map((h, i) => (
        <div key={i} style={{ flex: 1, borderRadius: 3, background: color, height: `${h}%`, opacity: 0.45 + i * 0.08 }} />
      ))}
    </div>
  );
}

/* ── Mini map SVG ────────────────────────────────────────────────────────── */
function MiniMap() {
  return (
    <svg viewBox="0 0 120 90" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
      <path d="M10,45 Q40,30 80,50 Q100,55 115,45" stroke="rgba(255,255,255,0.15)" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <path d="M25,20 Q45,50 40,75" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <path d="M60,15 L65,80" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <path d="M31,55 Q52,42 72,38" stroke="#818cf8" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeDasharray="4 3" opacity="0.8"/>
      {[
        { x: 72, y: 38, c: '#4ade80', pulse: true },
        { x: 31, y: 55, c: '#818cf8', pulse: false },
        { x: 58, y: 68, c: '#f59e0b', pulse: true },
        { x: 85, y: 62, c: '#818cf8', pulse: false },
        { x: 20, y: 30, c: '#818cf8', pulse: false },
      ].map((p, i) => (
        <g key={i}>
          {p.pulse && (
            <circle cx={p.x} cy={p.y} r="10" fill={p.c} opacity="0.15">
              <animate attributeName="r" values="6;14;6" dur="2.5s" repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0.15;0;0.15" dur="2.5s" repeatCount="indefinite"/>
            </circle>
          )}
          <circle cx={p.x} cy={p.y} r="4" fill={p.c} opacity="0.25"/>
          <circle cx={p.x} cy={p.y} r="2.5" fill={p.c}/>
        </g>
      ))}
    </svg>
  );
}

/* ── Alert rows data ─────────────────────────────────────────────────────── */
const ALERTS = [
  { icon: Battery,       label: 'RFID Tag — Low Battery', sub: 'Asset #A-1204', color: '#f59e0b', time: '2m ago' },
  { icon: MapPin,        label: 'Zone Breach Detected',   sub: 'Server Room B', color: '#f87171', time: '8m ago' },
  { icon: Package,       label: 'Asset Check-in',         sub: 'Laptop #L-0093', color: '#4ade80', time: '14m ago' },
];

/* ── Page ────────────────────────────────────────────────────────────────── */
export default function LoginPage() {
  const router = useRouter();
  const { initializing, signIn } = useContext(AuthContext);
  const { toast } = useToast();
  const supabaseConfigured = isSupabaseConfigured();

  const [email, setEmail]   = useState('');
  const [password, setPass] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [touched, setTouched]   = useState({ email: false, password: false });
  const [errors, setErrors]     = useState<any>({});

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
      if (data?.status === 'PENDING') {
        router.push('/pending-approval');
      } else {
        router.push('/portal');
      }
    } catch {
      toast({ variant: 'destructive', title: 'Login failed', description: 'Check your credentials and try again.' });
    } finally { setLoading(false); }
  };

  return (
    <>
      <style>{`
        @keyframes floatA { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-14px)} }
        @keyframes floatB { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-9px)} }
        @keyframes floatC { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-11px)} }
        @keyframes su { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fs { from{opacity:0;transform:translateX(-14px)} to{opacity:1;transform:translateX(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        .fa { animation: floatA 7s ease-in-out infinite; will-change: transform; }
        .fb { animation: floatB 9s ease-in-out infinite 1.2s; will-change: transform; }
        .fc { animation: floatC 8s ease-in-out infinite 2s; will-change: transform; }
        .su1 { animation: su .55s cubic-bezier(.16,1,.3,1) .05s both; }
        .su2 { animation: su .55s cubic-bezier(.16,1,.3,1) .12s both; }
        .su3 { animation: su .55s cubic-bezier(.16,1,.3,1) .20s both; }
        .su4 { animation: su .55s cubic-bezier(.16,1,.3,1) .28s both; }
        .su5 { animation: su .55s cubic-bezier(.16,1,.3,1) .36s both; }
        .fs1 { animation: fs .45s cubic-bezier(.16,1,.3,1) .1s both; }
        .fs2 { animation: fs .45s cubic-bezier(.16,1,.3,1) .2s both; }
        .fs3 { animation: fs .45s cubic-bezier(.16,1,.3,1) .32s both; }
        .glass {
          background: rgba(255,255,255,0.065);
          border: 1px solid rgba(255,255,255,0.13);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border-radius: 20px;
        }
        .btn-sign {
          background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 55%, #2563eb 100%);
          box-shadow: 0 4px 20px rgba(124,58,237,0.45), inset 0 1px 0 rgba(255,255,255,0.18);
          transition: box-shadow .2s ease, transform .15s ease;
          border: none; cursor: pointer;
        }
        .btn-sign:hover:not(:disabled) {
          box-shadow: 0 8px 32px rgba(124,58,237,0.65), inset 0 1px 0 rgba(255,255,255,0.2);
          transform: translateY(-1px);
        }
        .btn-sign:active:not(:disabled) { transform: translateY(0); }
        .btn-sign:disabled { opacity: 0.65; cursor: not-allowed; }
        .mobile-logo { display: flex; }
        @media (min-width: 1024px) { .mobile-logo { display: none !important; } }
        .spin-anim { animation: spin 1s linear infinite; }
      `}</style>

      <div style={{ minHeight: '100vh', display: 'flex', background: '#eef2fb' }}>

        {/* ══════════════════════════════════════════════════════════
            LEFT — BRAND + PREVIEW CARDS
        ══════════════════════════════════════════════════════════ */}
        <div className="hidden lg:flex" style={{
          width: '54%', position: 'relative', overflow: 'hidden', flexDirection: 'column',
          background: 'linear-gradient(160deg, #08061c 0%, #100c38 28%, #0c1948 62%, #050b1e 100%)',
        }}>
          {/* Ambient lights */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', top: '-8%', left: '-10%', width: '65%', height: '60%', background: 'radial-gradient(circle at 40% 50%, rgba(124,58,237,0.3) 0%, transparent 70%)' }}/>
            <div style={{ position: 'absolute', bottom: '0%', right: '-8%', width: '60%', height: '55%', background: 'radial-gradient(circle at 60% 50%, rgba(37,99,235,0.22) 0%, transparent 70%)' }}/>
            <div style={{ position: 'absolute', top: '38%', left: '28%', width: '44%', height: '44%', background: 'radial-gradient(circle, rgba(139,92,246,0.14) 0%, transparent 70%)' }}/>
          </div>
          {/* Dot grid */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.28, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)', backgroundSize: '28px 28px' }}/>
          {/* Accent lines */}
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} aria-hidden>
            <line x1="0" y1="68%" x2="100%" y2="28%" stroke="rgba(255,255,255,0.035)" strokeWidth="1"/>
            <line x1="0" y1="88%" x2="100%" y2="52%" stroke="rgba(255,255,255,0.025)" strokeWidth="1"/>
          </svg>

          {/* Content */}
          <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', height: '100%', padding: '40px 48px' }}>

            {/* Logo — inline, no external component */}
            <div className="fs1" style={{ marginBottom: 52 }}>
              <BrandMark size="md" />
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6, marginLeft: 4 }}>
                <Wifi style={{ width: 10, height: 10, color: '#4ade80' }}/>
                <span style={{ color: '#4ade80', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em' }}>LIVE SYSTEM</span>
              </div>
            </div>

            {/* Headline */}
            <div className="fs2" style={{ marginBottom: 44, maxWidth: 420 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.13)', borderRadius: 999, padding: '5px 13px', marginBottom: 20 }}>
                <Activity style={{ width: 11, height: 11, color: '#a78bfa' }}/>
                <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, fontWeight: 700, letterSpacing: '0.07em' }}>ENTERPRISE ASSET PLATFORM</span>
              </div>
              <h1 style={{ color: 'white', fontSize: 42, fontWeight: 900, lineHeight: 1.08, marginBottom: 16, letterSpacing: '-0.6px' }}>
                Intelligent Control<br/>
                <span style={{ background: 'linear-gradient(90deg,#a78bfa,#60a5fa,#34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                  Over Every Asset
                </span>
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.42)', fontSize: 15, lineHeight: 1.7 }}>
                Real-time GPS, RFID tracking, AI analytics, and automated workflows — unified for enterprise teams.
              </p>
            </div>

            {/* Floating preview cards */}
            <div style={{ position: 'relative', flex: 1, minHeight: 300 }}>

              {/* Card 1 — Asset stats */}
              <div className="fa glass" style={{ position: 'absolute', top: '0%', left: 0, width: 210, padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Package style={{ width: 13, height: 13, color: 'white' }}/>
                    </div>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600 }}>Total Assets</span>
                  </div>
                  <div style={{ background: 'rgba(74,222,128,0.14)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 6, padding: '2px 8px' }}>
                    <span style={{ color: '#4ade80', fontSize: 10, fontWeight: 700 }}>+12 today</span>
                  </div>
                </div>
                <p style={{ color: 'white', fontSize: 34, fontWeight: 900, lineHeight: 1, marginBottom: 14 }}>1,247</p>
                <Bars data={[42, 60, 54, 76, 66, 88, 80]} color="linear-gradient(to top,#7c3aed,#a78bfa)"/>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                  {['M','T','W','T','F','S','S'].map(d => (
                    <span key={d} style={{ color: 'rgba(255,255,255,0.22)', fontSize: 9, flex: 1, textAlign: 'center' }}>{d}</span>
                  ))}
                </div>
              </div>

              {/* Card 2 — Live map */}
              <div className="fb glass" style={{ position: 'absolute', top: '1%', right: 0, width: 220, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#0ea5e9,#0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <MapPin style={{ width: 13, height: 13, color: 'white' }}/>
                    </div>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600 }}>Live Locations</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80' }}/>
                    <span style={{ color: '#4ade80', fontSize: 10, fontWeight: 700 }}>124</span>
                  </div>
                </div>
                <div style={{ height: 96, borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', padding: 8 }}>
                  <MiniMap/>
                </div>
                <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: 10, marginTop: 8, textAlign: 'center' }}>GPS + RFID · Updated just now</p>
              </div>

              {/* Card 3 — Activity / alerts */}
              <div className="fc glass" style={{ position: 'absolute', bottom: '4%', left: '8%', right: '4%', padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#f59e0b,#d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <AlertTriangle style={{ width: 13, height: 13, color: 'white' }}/>
                    </div>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600 }}>Recent Activity</span>
                  </div>
                  <div style={{ background: 'rgba(248,113,113,0.14)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 6, padding: '2px 8px' }}>
                    <span style={{ color: '#f87171', fontSize: 10, fontWeight: 700 }}>3 alerts</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {ALERTS.map(({ icon: Icon, label, sub, color, time }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: `${color}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon style={{ width: 13, height: 13, color }}/>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ color: 'rgba(255,255,255,0.82)', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</p>
                        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>{sub}</p>
                      </div>
                      <span style={{ color: 'rgba(255,255,255,0.24)', fontSize: 10, flexShrink: 0 }}>{time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Trust strip */}
            <div className="fs3" style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 16 }}>
              <div style={{ display: 'flex' }}>
                {['#7c3aed','#0ea5e9','#10b981','#f59e0b','#ef4444'].map((c, i) => (
                  <div key={i} style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: '2px solid rgba(255,255,255,0.15)', marginLeft: i ? -8 : 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: 'white', fontSize: 10, fontWeight: 800 }}>{String.fromCharCode(65+i)}</span>
                  </div>
                ))}
              </div>
              <div>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 600 }}>Trusted by 500+ organizations</p>
                <div style={{ display: 'flex', gap: 2, marginTop: 3, alignItems: 'center' }}>
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} width="10" height="10" viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  ))}
                  <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, marginLeft: 5 }}>4.9/5 rating</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════
            RIGHT — LOGIN FORM
        ══════════════════════════════════════════════════════════ */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', position: 'relative', background: '#f8faff', overflow: 'hidden' }}>

          {/* Subtle right-panel decoration */}
          <div style={{ position: 'absolute', top: '-15%', right: '-10%', width: '55%', height: '60%', background: 'radial-gradient(circle, rgba(124,58,237,0.055) 0%, transparent 70%)', pointerEvents: 'none' }}/>
          <div style={{ position: 'absolute', bottom: '-10%', left: '-5%', width: '45%', height: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.045) 0%, transparent 70%)', pointerEvents: 'none' }}/>

          <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 10 }}>

            {/* Mobile logo */}
            <div className="mobile-logo su1" style={{ alignItems: 'center', justifyContent: 'center', marginBottom: 32, flexDirection: 'column', gap: 8 }}>
              <div style={{ width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 20px rgba(124,58,237,0.4)' }}>
                <Package style={{ width: 24, height: 24, color: 'white' }}/>
              </div>
              <span style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.4px' }}>AssetXAI</span>
            </div>

            {/* Card container */}
            <div style={{ background: 'white', borderRadius: 28, padding: '40px 40px 36px', boxShadow: '0 2px 4px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06), 0 32px 64px rgba(0,0,0,0.05)' }}>

              {/* Heading */}
              <div className="su1" style={{ marginBottom: 32 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18, boxShadow: '0 4px 14px rgba(124,58,237,0.35)' }}>
                  <Shield style={{ width: 22, height: 22, color: 'white' }}/>
                </div>
                <h2 style={{ fontSize: 26, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px', marginBottom: 6 }}>Welcome back</h2>
                <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.5 }}>Sign in to the Support Portal to raise tickets and track your requests.</p>
              </div>

              {/* Form */}
              <form onSubmit={submit} noValidate>
                <div className="su2" style={{ marginBottom: 16 }}>
                  <Field id="email" label="Email address" type="email" placeholder="name@company.com"
                    value={email} onChange={setEmail} error={touched.email ? errors.email : undefined} icon={Mail}/>
                </div>
                <div className="su3" style={{ marginBottom: 18 }}>
                  <Field id="password" label="Password" type={showPw ? 'text' : 'password'} placeholder="••••••••"
                    value={password} onChange={setPass} error={touched.password ? errors.password : undefined} icon={Lock}
                    right={
                      <button type="button" onClick={() => setShowPw(p => !p)}
                        style={{ color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
                        {showPw ? <EyeOff style={{ width: 16, height: 16 }}/> : <Eye style={{ width: 16, height: 16 }}/>}
                      </button>
                    }
                  />
                </div>

                {/* Remember + Forgot */}
                <div className="su3" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
                    <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                      style={{ width: 15, height: 15, accentColor: '#7c3aed', cursor: 'pointer' }}/>
                    <span style={{ fontSize: 13, color: '#64748b' }}>Remember me</span>
                  </label>
                  <button type="button" onClick={() => router.push('/forgot-password')}
                    style={{ fontSize: 13, fontWeight: 700, color: '#7c3aed', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    Forgot password?
                  </button>
                </div>

                {/* Submit */}
                <div className="su4">
                  <button type="submit" disabled={loading || initializing} className="btn-sign"
                    style={{ width: '100%', height: 54, borderRadius: 14, color: 'white', fontWeight: 800, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, letterSpacing: '-0.1px' }}>
                    {loading ? (
                      <><Loader2 style={{ width: 19, height: 19 }} className="spin-anim"/>Signing in…</>
                    ) : (
                      <>
                        <Shield style={{ width: 18, height: 18 }}/>
                        Sign in
                        <ArrowRight style={{ width: 17, height: 17, marginLeft: 'auto' }}/>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Security note */}
              <div className="su4" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 18, padding: '9px 16px', borderRadius: 999, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.18)' }}>
                <CheckCircle style={{ width: 12, height: 12, color: '#10b981' }}/>
                <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>256-bit SSL · SOC 2 Ready · Zero data sharing</span>
              </div>

              {/* KPI strip */}
              <div className="su5" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginTop: 24, paddingTop: 20, borderTop: '1px solid #f1f5f9' }}>
                {[
                  { icon: Package,    value: '1,247', label: 'Assets Tracked' },
                  { icon: MapPin,     value: '124',   label: 'Live Locations' },
                  { icon: TrendingUp, value: '99.8%', label: 'Uptime SLA' },
                ].map(({ icon: Icon, value, label }) => (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <Icon style={{ width: 16, height: 16, color: '#7c3aed', margin: '0 auto 4px' }}/>
                    <p style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.3px' }}>{value}</p>
                    <p style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Sign up + legal */}
            <div className="su5">
              <p style={{ marginTop: 22, textAlign: 'center', fontSize: 14, color: '#64748b' }}>
                Don't have an account?{' '}
                <button onClick={() => router.push('/signup')}
                  style={{ fontWeight: 800, color: '#7c3aed', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  Create free account
                </button>
              </p>
              <p style={{ marginTop: 14, textAlign: 'center', fontSize: 11, color: '#94a3b8' }}>
                By signing in you agree to our{' '}
                <span style={{ textDecoration: 'underline', cursor: 'pointer', color: '#64748b' }}>Terms</span>
                {' '}&amp;{' '}
                <span style={{ textDecoration: 'underline', cursor: 'pointer', color: '#64748b' }}>Privacy Policy</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
