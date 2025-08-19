import React from 'react';
import { useTranslation } from "@/contexts/TranslationContext";

interface ComplianceFooterProps {
  reportId: string;
  complianceStandards?: string[];
}

export const ComplianceFooter: React.FC<ComplianceFooterProps> = ({ 
  reportId, 
  complianceStandards = ['ISO 27001', 'GDPR', 'SOC2'] 
}) => {
  const { t } = useTranslation();
  
  return (
    <div className="mt-12 pt-6 border-t border-gray-200 print:border-gray-300">
      <div className="flex justify-between items-center text-gray-500 text-sm mb-4">
        <p>{t("enterprise_asset_management_system")}</p>
        <p>{t("report_id")}: {reportId}</p>
      </div>
      
      {/* Compliance Information Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4 print:bg-blue-50 print:border-blue-300">
        <h4 className="text-sm font-semibold text-blue-800 mb-2">{t("global_standards_compliance_information")}</h4>
        <div className="flex flex-wrap gap-2">
          {complianceStandards.map((standard) => (
            <span 
              key={standard}
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-300"
            >
              {standard}
            </span>
          ))}
        </div>
        <p className="text-xs text-blue-700 mt-2">
          {t("compliance_report_description")}
        </p>
      </div>
      
      <div className="flex justify-between items-center text-gray-500 text-xs">
        <p>{t("document_classification")}: {t("confidential")}</p>
        <p>{t("retention_period")}: {t("seven_years")}</p>
      </div>
      
      <p className="text-center text-gray-400 text-xs mt-2">
        {t("report_confidentiality_notice")}
      </p>
    </div>
  );
};