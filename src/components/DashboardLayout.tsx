import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/contexts/TranslationContext";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  Utensils,
  Car,
  MapPin,
  Settings,
  LineChart,
  TicketIcon,
  BrainCircuit,
  LogOut,
  User,
  Printer,
  Calendar,
  Navigation,
  Building2,
  Radio,
  ChevronRight,
  Sparkles,
  Shield,
  Truck,
  Users,
  Activity,
  Sun,
  Moon,
} from "lucide-react";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { MobileNavBar } from "./MobileNavBar";
import Link from "next/link";
import { useRouter } from "next/router";
import Logo from "./Logo";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { useRTLOptimization } from "@/hooks/useRTLOptimization";
import { usePageAccess } from "@/hooks/usePageAccess";
import { createClient } from "@/util/supabase/component";

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isDark } = useTheme();
  const { t, dir } = useTranslation();
  const isRtl = dir === "rtl";
  const { setRef } = useRTLOptimization("dashboard-layout");
  const mainContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mainContainerRef.current) setRef(mainContainerRef.current);
  }, [setRef]);

  return (
    <div
      ref={mainContainerRef}
      className="flex min-h-screen bg-background transition-colors duration-300 overflow-hidden"
      dir={dir}
    >
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        className={`fixed ${isRtl ? "right-0" : "left-0"} top-0 z-40 h-screen w-[272px] transition-all duration-300 ease-in-out transform ${
          sidebarOpen
            ? "translate-x-0"
            : isRtl
            ? "translate-x-full"
            : "-translate-x-full"
        } lg:translate-x-0 hidden lg:block`}
      />

      <main
        className={`flex-1 ${isRtl ? "lg:mr-[272px]" : "lg:ml-[272px]"} w-full h-screen overflow-y-auto`}
      >
        <div className="p-4 md:p-6 lg:p-8 pt-6 pb-28 lg:pb-8">
          {/* Mobile header */}
          <div className="lg:hidden flex flex-col mb-6 bg-card p-3 rounded-xl shadow-sm border">
            <div className={`mb-2 ${isRtl ? "flex justify-end" : ""}`}>
              <Logo />
            </div>
            <div className="flex items-center justify-between">
              <div className="text-xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                {isRtl ? t("enterprise_asset_management") : "Enterprise Asset"}
              </div>
              <div className="flex items-center gap-2">
                <LanguageSwitcher />
              </div>
            </div>
          </div>
          {children}
        </div>
        <MobileNavBar />
      </main>
    </div>
  );
}

// ── Section colour themes ──────────────────────────────────────────────────────
const SECTION_CONFIG = {
  main:     { label: "Main",     color: "violet",  gradient: "from-violet-500 to-indigo-500"  },
  assets:   { label: "Assets",   color: "blue",    gradient: "from-blue-500 to-cyan-500"      },
  tracking: { label: "Tracking", color: "emerald", gradient: "from-emerald-500 to-teal-500"   },
  support:  { label: "Support",  color: "amber",   gradient: "from-amber-500 to-orange-500"   },
  system:   { label: "System",   color: "slate",   gradient: "from-slate-400 to-slate-500"    },
} as const;

function Sidebar({ className }: SidebarProps) {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { t, dir } = useTranslation();
  const isRtl = dir === "rtl";
  const { isDark, toggleTheme } = useTheme();
  const { setRef } = useRTLOptimization("sidebar");
  const { hasAccess, isAdmin, loading } = usePageAccess();
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sidebarRef.current) setRef(sidebarRef.current);
  }, [setRef]);

  const menuSections = [
    {
      id: "main" as const,
      items: [
        { title: t("dashboard"),           icon: LayoutDashboard, href: "/dashboard" },
        { title: t("ai_analysis"),          icon: BrainCircuit,    href: "/ai-analysis" },
        { title: t("print_reports"),        icon: Printer,         href: "/reports/print" },
        { title: t("planner"),              icon: Calendar,        href: "/planner" },
        { title: t("vehicle_assignments"),  icon: Users,           href: "/admin/vehicle-assignments" },
        { title: t("staff_activity"),       icon: Activity,        href: "/staff-activity" },
        { title: t("drivers"),              icon: Truck,           href: "/drivers" },
      ],
    },
    {
      id: "assets" as const,
      items: [
        { title: t("assets"),                icon: Package,   href: "/assets" },
        { title: t("food_supply"),           icon: Utensils,  href: "/food-supply" },
        { title: t("kitchens"),              icon: Building2, href: "/kitchens" },
        { title: t("vehicle_rentals_sidebar"), icon: Car,     href: "/vehicles" },
      ],
    },
    {
      id: "tracking" as const,
      items: [
        { title: t("asset_location"),          icon: MapPin,    href: "/asset-location" },
        { title: "RFID & BLE Tracking",        icon: Radio,     href: "/rfid" },
        { title: t("vehicle_tracking_system"), icon: Car,       href: "/vehicle-tracking" },
        { title: t("my_vehicle"),              icon: Navigation, href: "/my-vehicle" },
      ],
    },
    {
      id: "support" as const,
      items: [
        { title: t("tickets"), icon: TicketIcon, href: "/tickets" },
      ],
    },
    {
      id: "system" as const,
      items: [
        { title: t("settings"),        icon: Settings,   href: "/settings" },
        { title: t("compliance_audit"), icon: Shield,    href: "/settings/compliance" },
      ],
    },
  ];

  const userInitial = user?.email ? user.email.charAt(0).toUpperCase() : "U";
  const userName = user?.email ? user.email.split("@")[0] : "User";

  return (
    <div
      ref={sidebarRef}
      dir={dir}
      className={cn(
        "flex flex-col h-full overflow-hidden",
        isDark
          ? "bg-[#0f0f13] border-r border-white/[0.06]"
          : "bg-white border-r border-slate-200/80",
        className
      )}
    >
      {/* ── Logo ──────────────────────────────────────────────────── */}
      <div className={cn(
        "relative flex items-center gap-3 px-5 py-5 flex-shrink-0",
        isDark ? "border-b border-white/[0.06]" : "border-b border-slate-100"
      )}>
        {/* Glow blob behind logo */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute -top-4 -left-4 w-32 h-32 rounded-full bg-violet-500/8 blur-2xl" />
        </div>

        <div className="relative flex items-center gap-2.5 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20 flex-shrink-0">
            <Sparkles className="w-4.5 h-4.5 text-white" style={{ width: 18, height: 18 }} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold tracking-tight leading-none bg-gradient-to-r from-violet-500 to-indigo-500 bg-clip-text text-transparent">
              AssetAI
            </p>
            <p className={cn("text-[10px] font-medium mt-0.5 truncate", isDark ? "text-white/35" : "text-slate-400")}>
              Enterprise Platform
            </p>
          </div>
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className={cn(
            "flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all",
            isDark
              ? "text-white/40 hover:text-white/70 hover:bg-white/8"
              : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          )}
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      {/* ── User card ─────────────────────────────────────────────── */}
      <div className={cn(
        "px-4 py-3 flex-shrink-0",
        isDark ? "border-b border-white/[0.06]" : "border-b border-slate-100"
      )}>
        <div className={cn(
          "flex items-center gap-3 p-2.5 rounded-xl transition-all cursor-default",
          isDark ? "bg-white/[0.04] hover:bg-white/[0.07]" : "bg-slate-50 hover:bg-slate-100"
        )}>
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-violet-500/20">
              {userInitial}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#0f0f13]" />
          </div>

          <div className="flex-1 min-w-0">
            <p className={cn("text-xs font-semibold leading-none truncate", isDark ? "text-white/90" : "text-slate-800")}>
              {userName}
            </p>
            <p className={cn("text-[10px] mt-1 truncate", isDark ? "text-white/35" : "text-slate-400")}>
              {user?.email ?? ""}
            </p>
            <UserRoleDisplay />
          </div>

          <LanguageSwitcher />
        </div>
      </div>

      {/* ── Navigation ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-3 space-y-6 scrollbar-none">
        {loading ? (
          <div className="flex flex-col gap-2 px-2 mt-2">
            {[80, 65, 75, 55, 70].map((w, i) => (
              <div key={i} className={cn("h-8 rounded-lg animate-pulse", isDark ? "bg-white/5" : "bg-slate-100")} style={{ width: `${w}%` }} />
            ))}
          </div>
        ) : (
          menuSections.map((section, si) => {
            const cfg = SECTION_CONFIG[section.id];
            const accessibleItems = section.items.filter(item => isAdmin || hasAccess(item.href));
            if (accessibleItems.length === 0) return null;

            return (
              <div key={section.id}>
                {/* Section label */}
                <div className={cn("flex items-center gap-2 px-2 mb-2", isRtl && "flex-row-reverse")}>
                  <div className={`h-px flex-1 ${isDark ? "bg-white/[0.06]" : "bg-slate-100"}`} />
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-widest flex-shrink-0",
                    isDark ? "text-white/25" : "text-slate-400"
                  )}>
                    {t(section.id) || cfg.label}
                  </span>
                  <div className={`h-px flex-1 ${isDark ? "bg-white/[0.06]" : "bg-slate-100"}`} />
                </div>

                {/* Items */}
                <div className="space-y-0.5">
                  {accessibleItems.map(item => {
                    const isActive = section.id === "main"
                      ? router.pathname === item.href
                      : router.pathname.startsWith(item.href);

                    return (
                      <NavItem
                        key={item.href}
                        item={item}
                        isActive={isActive}
                        gradient={cfg.gradient}
                        isDark={isDark}
                        isRtl={isRtl}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Sign Out ──────────────────────────────────────────────── */}
      <div className={cn(
        "px-3 py-4 flex-shrink-0",
        isDark ? "border-t border-white/[0.06]" : "border-t border-slate-100"
      )}>
        <button
          onClick={() => signOut?.()}
          className={cn(
            "group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
            isRtl && "flex-row-reverse",
            isDark
              ? "text-white/40 hover:text-red-400 hover:bg-red-500/8"
              : "text-slate-500 hover:text-red-500 hover:bg-red-50"
          )}
        >
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center transition-all flex-shrink-0",
            isDark
              ? "bg-white/5 group-hover:bg-red-500/15"
              : "bg-slate-100 group-hover:bg-red-100"
          )}>
            <LogOut className="w-4 h-4" />
          </div>
          <span className={isRtl ? "text-right flex-1" : "flex-1 text-left"}>
            {t("sign_out")}
          </span>
        </button>
      </div>
    </div>
  );
}

// ── Nav Item ──────────────────────────────────────────────────────────────────
interface NavItemProps {
  item: { title: string; icon: any; href: string };
  isActive: boolean;
  gradient: string;
  isDark: boolean;
  isRtl: boolean;
}

function NavItem({ item, isActive, gradient, isDark, isRtl }: NavItemProps) {
  return (
    <Link href={item.href}>
      <div
        className={cn(
          "relative group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer select-none",
          isRtl && "flex-row-reverse",
          isActive
            ? isDark
              ? "bg-white/[0.08] text-white"
              : "bg-slate-900 text-white"
            : isDark
            ? "text-white/45 hover:text-white/80 hover:bg-white/[0.05]"
            : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
        )}
      >
        {/* Active glow strip */}
        {isActive && (
          <motion.div
            layoutId={`nav-indicator-${gradient}`}
            className={cn(
              "absolute rounded-full",
              isRtl ? "right-0" : "left-0",
              "top-1/2 -translate-y-1/2 w-1 h-6",
              `bg-gradient-to-b ${gradient}`
            )}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
        )}

        {/* Icon container */}
        <div
          className={cn(
            "flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all",
            isActive
              ? `bg-gradient-to-br ${gradient} shadow-md`
              : isDark
              ? "bg-white/[0.06] group-hover:bg-white/[0.1]"
              : "bg-slate-100 group-hover:bg-slate-200"
          )}
        >
          <item.icon
            className={cn(
              "transition-all",
              isActive
                ? "text-white w-4 h-4"
                : isDark
                ? "text-white/50 group-hover:text-white/80 w-4 h-4"
                : "text-slate-500 group-hover:text-slate-700 w-4 h-4"
            )}
          />
        </div>

        {/* Label */}
        <span className={cn("flex-1 truncate leading-none", isRtl && "text-right")}>
          {item.title}
        </span>

        {/* Arrow on hover */}
        {!isActive && (
          <ChevronRight
            className={cn(
              "w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-all -translate-x-1 group-hover:translate-x-0 flex-shrink-0",
              isDark ? "text-white/30" : "text-slate-400",
              isRtl && "rotate-180"
            )}
          />
        )}

        {/* Active dot */}
        {isActive && (
          <div
            className={cn(
              "flex-shrink-0 w-1.5 h-1.5 rounded-full",
              `bg-gradient-to-br ${gradient}`
            )}
          />
        )}
      </div>
    </Link>
  );
}

// ── User Role Badge ───────────────────────────────────────────────────────────
function UserRoleDisplay() {
  const { role, isAdmin, isManager, loading } = usePageAccess();
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { user } = useAuth();
  const [customRoleName, setCustomRoleName] = useState<string | null>(null);

  useEffect(() => {
    const fetchCustomRoleName = async () => {
      if (!user) return;
      try {
        const supabase = createClient();
        const { data: userData } = await supabase
          .from("User")
          .select("customRoleId, role")
          .eq("id", user.id)
          .single();
        if (!userData?.customRoleId) { setCustomRoleName(null); return; }
        const { data: roleData } = await supabase
          .from("CustomRole")
          .select("name")
          .eq("id", userData.customRoleId)
          .single();
        if (roleData) setCustomRoleName(roleData.name);
        else setCustomRoleName(null);
      } catch {}
    };
    fetchCustomRoleName();
    const interval = setInterval(fetchCustomRoleName, 30000);
    return () => clearInterval(interval);
  }, [user]);

  if (loading) return null;

  let displayRole = role || "STAFF";
  if (isAdmin) displayRole = "ADMIN";
  else if (isManager) displayRole = "MANAGER";
  else if (customRoleName) displayRole = customRoleName;

  const getRoleLabel = (r: string) => {
    switch (r.toUpperCase()) {
      case "ADMIN":   return t("role_admin");
      case "MANAGER": return t("role_manager");
      case "STAFF":   return t("role_staff");
      default:        return r;
    }
  };

  const ROLE_STYLES: Record<string, string> = {
    ADMIN:   "bg-violet-500/15 text-violet-400",
    MANAGER: "bg-blue-500/15 text-blue-400",
    STAFF:   isDark ? "bg-white/8 text-white/35" : "bg-slate-100 text-slate-400",
  };
  const key = displayRole.toUpperCase();
  const cls = ROLE_STYLES[key] ?? (isDark ? "bg-amber-500/15 text-amber-400" : "bg-amber-100 text-amber-600");

  return (
    <span className={cn("mt-1.5 inline-block text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md", cls)}>
      {getRoleLabel(displayRole)}
    </span>
  );
}
