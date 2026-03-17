import React from 'react';
import { motion } from 'framer-motion';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { HelpCircle } from 'lucide-react';
import { useTranslation } from "@/contexts/TranslationContext";

interface FaqItem {
  questionKey: string;
  answerKey: string;
}

const FaqSection: React.FC = () => {
  const { t } = useTranslation();
  
  const faqs: FaqItem[] = [
    {
      questionKey: "asset_tracking_question",
      answerKey: "asset_tracking_answer"
    },
    {
      questionKey: "integration_question",
      answerKey: "integration_answer"
    },
    {
      questionKey: "security_question",
      answerKey: "security_answer"
    },
    {
      questionKey: "support_question",
      answerKey: "support_answer"
    },
    {
      questionKey: "offline_question",
      answerKey: "offline_answer"
    },
    {
      questionKey: "customization_question",
      answerKey: "customization_answer"
    }
  ];

  return (
    <div className="py-12">
      <div className="container mx-auto px-4">
        <motion.div 
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="inline-flex items-center justify-center p-2 bg-primary/10 rounded-full mb-4">
            <HelpCircle className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-3xl font-bold mb-4">{t('frequently_asked_questions')}</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {t('find_answers')}
          </p>
        </motion.div>
        
        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
              >
                <AccordionItem value={`item-${index}`} className="border border-primary/10 rounded-lg mb-4 overflow-hidden">
                  <AccordionTrigger className="px-6 py-4 hover:bg-primary/5 transition-colors duration-200 text-left font-medium">
                    {t(faq.questionKey)}
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-4 pt-2 text-muted-foreground">
                    {t(faq.answerKey)}
                  </AccordionContent>
                </AccordionItem>
              </motion.div>
            ))}
          </Accordion>
        </div>
      </div>
    </div>
  );
};

export default FaqSection;