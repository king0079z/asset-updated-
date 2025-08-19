import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/contexts/TranslationContext';

interface FeatureItem {
  nameKey: string;
  enterprise: boolean;
  competitors: boolean;
}

const FeatureComparison: React.FC = () => {
  const { t } = useTranslation();
  
  const features: FeatureItem[] = [
    { nameKey: "real_time_asset_tracking", enterprise: true, competitors: true },
    { nameKey: "barcode_integration", enterprise: true, competitors: true },
    { nameKey: "gps_location_tracking", enterprise: true, competitors: true },
    { nameKey: "maintenance_scheduling", enterprise: true, competitors: true },
    { nameKey: "food_supply_management", enterprise: true, competitors: false },
    { nameKey: "vehicle_fleet_management", enterprise: true, competitors: false },
    { nameKey: "staff_activity_monitoring", enterprise: true, competitors: false },
    { nameKey: "compliance_reporting", enterprise: true, competitors: false },
    { nameKey: "ai_powered_analytics", enterprise: true, competitors: false },
    { nameKey: "offline_mode_support", enterprise: true, competitors: false },
  ];

  return (
    <div className="py-8">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="flex flex-col justify-center"
          >
            <h2 className="text-3xl font-bold mb-4">{t('why_choose_our_platform')}</h2>
            <p className="text-muted-foreground mb-6">
              {t('platform_comparison_description')}
            </p>
            <ul className="space-y-3">
              {features.slice(4, 8).map((feature) => (
                <motion.li
                  key={feature.nameKey}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className="flex items-center"
                >
                  <CheckCircle className="text-green-500 mr-2 h-5 w-5" />
                  <span>{t(feature.nameKey)}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Card className="border border-primary/20 shadow-lg overflow-hidden">
              <CardHeader className="bg-primary/5 border-b border-primary/10">
                <div className="flex justify-between items-center">
                  <CardTitle>{t('feature_comparison')}</CardTitle>
                  <Badge variant="outline" className="bg-primary/10">{t('enterprise_grade')}</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-3 pb-2 border-b">
                    <div className="font-semibold">{t('feature')}</div>
                    <div className="font-semibold text-center">{t('our_platform')}</div>
                    <div className="font-semibold text-center">{t('competitors')}</div>
                  </div>
                  
                  {features.map((feature, index) => (
                    <motion.div
                      key={feature.nameKey}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.1 * index }}
                      className="grid grid-cols-3 py-2 border-b border-border/40"
                    >
                      <div>{t(feature.nameKey)}</div>
                      <div className="text-center">
                        <CheckCircle className="inline-block text-green-500 h-5 w-5" />
                      </div>
                      <div className="text-center">
                        {feature.competitors ? (
                          <CheckCircle className="inline-block text-green-500 h-5 w-5" />
                        ) : (
                          <XCircle className="inline-block text-red-500 h-5 w-5" />
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default FeatureComparison;