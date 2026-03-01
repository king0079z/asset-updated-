import { DashboardLayout } from '@/components/DashboardLayout';
import { StaffActivityViewer } from '@/components/StaffActivityViewer';
import { useTranslation } from '@/contexts/TranslationContext';
import { fetchWithCache } from '@/lib/api-cache';

export default function StaffActivityPage() {
  const { t } = useTranslation();
  
  return (
    <DashboardLayout>
      <div className="flex flex-col space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('staff_activity')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('track_and_monitor_staff_actions')}
          </p>
        </div>
        
        <StaffActivityViewer 
          title={t('activity_log')}
          description={t('comprehensive_view_of_actions')}
          showExport={true}
        />
      </div>
    </DashboardLayout>
  );
}