import React from 'react';
import { useRouter } from 'next/router';
import { Activity, Truck, ShoppingCart, Package, Clipboard, ArrowRight } from 'lucide-react';
import { useTranslation } from '@/contexts/TranslationContext';
import { useRTLOptimization } from '@/hooks/useRTLOptimization';

const EnhancedQuickActionsSection = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { dir } = useRTLOptimization();

  const quickActions = [
    {
      title: 'vehicles',
      description: 'manage_vehicle_fleet',
      icon: Truck,
      path: '/vehicles',
      gradientFrom: 'from-sky-500',
      gradientTo: 'to-blue-600',
      bgGradientFrom: 'from-sky-50',
      bgGradientTo: 'to-blue-100',
      darkBgFrom: 'dark:from-sky-950/40',
      darkBgTo: 'dark:to-blue-900/40',
      borderColor: 'border-sky-200',
      darkBorderColor: 'dark:border-sky-800',
      textColor: 'text-sky-800',
      darkTextColor: 'dark:text-sky-300',
      descColor: 'text-sky-600',
      darkDescColor: 'dark:text-sky-400',
      hoverTextColor: 'group-hover:text-sky-900',
      darkHoverTextColor: 'dark:group-hover:text-sky-200',
      indicatorBg: 'bg-sky-100',
      darkIndicatorBg: 'dark:bg-sky-900/50',
      indicatorColor: 'text-sky-700',
      darkIndicatorColor: 'dark:text-sky-400',
      topGradient: 'from-sky-400 to-blue-500',
      shadowColor: 'dark:group-hover:shadow-sky-900/50'
    },
    {
      title: 'inventory',
      description: 'manage_food_supplies',
      icon: ShoppingCart,
      path: '/food-supply',
      gradientFrom: 'from-emerald-500',
      gradientTo: 'to-green-600',
      bgGradientFrom: 'from-emerald-50',
      bgGradientTo: 'to-green-100',
      darkBgFrom: 'dark:from-emerald-950/40',
      darkBgTo: 'dark:to-green-900/40',
      borderColor: 'border-emerald-200',
      darkBorderColor: 'dark:border-emerald-800',
      textColor: 'text-emerald-800',
      darkTextColor: 'dark:text-emerald-300',
      descColor: 'text-emerald-600',
      darkDescColor: 'dark:text-emerald-400',
      hoverTextColor: 'group-hover:text-emerald-900',
      darkHoverTextColor: 'dark:group-hover:text-emerald-200',
      indicatorBg: 'bg-emerald-100',
      darkIndicatorBg: 'dark:bg-emerald-900/50',
      indicatorColor: 'text-emerald-700',
      darkIndicatorColor: 'dark:text-emerald-400',
      topGradient: 'from-emerald-400 to-green-500',
      shadowColor: 'dark:group-hover:shadow-emerald-900/50'
    },
    {
      title: 'assets',
      description: 'track_enterprise_assets',
      icon: Package,
      path: '/assets',
      gradientFrom: 'from-violet-500',
      gradientTo: 'to-purple-600',
      bgGradientFrom: 'from-violet-50',
      bgGradientTo: 'to-purple-100',
      darkBgFrom: 'dark:from-violet-950/40',
      darkBgTo: 'dark:to-purple-900/40',
      borderColor: 'border-violet-200',
      darkBorderColor: 'dark:border-violet-800',
      textColor: 'text-violet-800',
      darkTextColor: 'dark:text-violet-300',
      descColor: 'text-violet-600',
      darkDescColor: 'dark:text-violet-400',
      hoverTextColor: 'group-hover:text-violet-900',
      darkHoverTextColor: 'dark:group-hover:text-violet-200',
      indicatorBg: 'bg-violet-100',
      darkIndicatorBg: 'dark:bg-violet-900/50',
      indicatorColor: 'text-violet-700',
      darkIndicatorColor: 'dark:text-violet-400',
      topGradient: 'from-violet-400 to-purple-500',
      shadowColor: 'dark:group-hover:shadow-violet-900/50'
    },
    {
      title: 'tickets',
      description: 'manage_support_tickets',
      icon: Clipboard,
      path: '/tickets/dashboard',
      gradientFrom: 'from-amber-500',
      gradientTo: 'to-orange-600',
      bgGradientFrom: 'from-amber-50',
      bgGradientTo: 'to-orange-100',
      darkBgFrom: 'dark:from-amber-950/40',
      darkBgTo: 'dark:to-orange-900/40',
      borderColor: 'border-amber-200',
      darkBorderColor: 'dark:border-amber-800',
      textColor: 'text-amber-800',
      darkTextColor: 'dark:text-amber-300',
      descColor: 'text-amber-600',
      darkDescColor: 'dark:text-amber-400',
      hoverTextColor: 'group-hover:text-amber-900',
      darkHoverTextColor: 'dark:group-hover:text-amber-200',
      indicatorBg: 'bg-amber-100',
      darkIndicatorBg: 'dark:bg-amber-900/50',
      indicatorColor: 'text-amber-700',
      darkIndicatorColor: 'dark:text-amber-400',
      topGradient: 'from-amber-400 to-orange-500',
      shadowColor: 'dark:group-hover:shadow-amber-900/50'
    }
  ];

  return (
    <div>
      <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 flex items-center text-slate-800 dark:text-slate-100">
        <div className="p-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 mr-2">
          <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        {t('quick_actions')}
      </h2>
      
      <div className="grid grid-cols-1 xs:grid-cols-2 gap-5">
        {quickActions.map((action, index) => (
          <div 
            key={action.title}
            className={`
              group relative overflow-hidden rounded-xl 
              bg-gradient-to-br ${action.bgGradientFrom} ${action.bgGradientTo} 
              ${action.darkBgFrom} ${action.darkBgTo} 
              border ${action.borderColor} ${action.darkBorderColor} 
              shadow-md hover:shadow-xl transition-all duration-300 
              transform hover:-translate-y-2 hover:scale-[1.02]
            `}
            style={{
              animationDelay: `${index * 100}ms`,
              animationFillMode: 'forwards'
            }}
          >
            {/* Top gradient bar with animation */}
            <div className={`absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r ${action.topGradient} group-hover:h-2 transition-all duration-300`}></div>
            
            {/* Animated background effect */}
            <div className="absolute inset-0 bg-white/40 dark:bg-gray-900/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            
            {/* Animated glow effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 blur-xl transition-all duration-500 group-hover:animate-pulse"></div>
            
            <button 
              onClick={() => router.push(action.path)} 
              className="w-full h-full p-6 flex flex-col items-center justify-center gap-4 relative z-10"
            >
              {/* Icon with enhanced animation */}
              <div className={`
                bg-gradient-to-br ${action.gradientFrom} ${action.gradientTo} 
                p-4 rounded-full shadow-md group-hover:shadow-lg ${action.shadowColor}
                group-hover:scale-110 transition-all duration-300
                relative overflow-hidden
              `}>
                {/* Animated pulse effect */}
                <div className="absolute inset-0 rounded-full bg-white/20 opacity-0 group-hover:opacity-100 group-hover:animate-ping"></div>
                <action.icon className="h-7 w-7 text-white relative z-10" />
              </div>
              
              {/* Text content with enhanced animation */}
              <div className="text-center transform transition-all duration-300 group-hover:scale-105">
                <h3 className={`
                  text-lg font-semibold ${action.textColor} ${action.darkTextColor} 
                  ${action.hoverTextColor} ${action.darkHoverTextColor} 
                  transition-colors
                `}>
                  {t(action.title)}
                </h3>
                <p className={`
                  text-sm ${action.descColor} ${action.darkDescColor} 
                  mt-1 opacity-80 group-hover:opacity-100
                `}>
                  {t(action.description)}
                </p>
              </div>
              
              {/* Enhanced arrow indicator */}
              <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-300 transform group-hover:translate-x-0 translate-x-2">
                <div className={`
                  ${action.indicatorBg} ${action.darkIndicatorBg} 
                  p-1.5 rounded-full shadow-md group-hover:shadow-lg
                  group-hover:animate-pulse
                `}>
                  <ArrowRight className={`h-4 w-4 ${action.indicatorColor} ${action.darkIndicatorColor}`} />
                </div>
              </div>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EnhancedQuickActionsSection;