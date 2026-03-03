import { DashboardLayout } from '@/components/DashboardLayout';
import { StaffActivityViewer } from '@/components/StaffActivityViewer';
import { useTranslation } from '@/contexts/TranslationContext';
import { Activity, Users, Clock, Download } from 'lucide-react';

export default function StaffActivityPage() {
  const { t } = useTranslation();

  return (
    <DashboardLayout>
      <div className="space-y-8">

        {/* ── Hero Banner ──────────────────────────────────────────────── */}
        <div className="relative rounded-2xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-teal-700 via-cyan-800 to-slate-900" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(20,184,166,0.25),transparent_60%)]" />
          <div className="absolute -top-12 -right-12 w-56 h-56 rounded-full bg-teal-400/10 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 w-64 h-28 rounded-full bg-cyan-400/10 blur-2xl" />

          <div className="relative z-10 px-8 py-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center flex-shrink-0">
                <Activity className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white tracking-tight">{t('staff_activity')}</h1>
                <p className="text-teal-200 text-sm mt-0.5">{t('track_and_monitor_staff_actions')}</p>
              </div>
            </div>
          </div>

          <div className="relative z-10 px-8 pb-8 grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Activity Types',  value: '7',    icon: Activity, color: 'text-teal-400' },
              { label: 'Resource Types',  value: '5',    icon: Users,    color: 'text-cyan-400' },
              { label: 'Live Tracking',   value: '24/7', icon: Clock,    color: 'text-emerald-400' },
              { label: 'CSV Export',      value: 'Yes',  icon: Download, color: 'text-blue-400' },
            ].map(s => (
              <div key={s.label} className="bg-white/8 backdrop-blur border border-white/10 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-teal-200 font-medium">{s.label}</span>
                  <s.icon className={`h-4 w-4 ${s.color}`} />
                </div>
                <p className="text-2xl font-bold text-white">{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Main Viewer ──────────────────────────────────────────────── */}
        <StaffActivityViewer
          title={t('activity_log')}
          description={t('comprehensive_view_of_actions')}
          showExport={true}
        />
      </div>
    </DashboardLayout>
  );
}
