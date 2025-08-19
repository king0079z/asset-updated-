import * as React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";
import { cn } from "@/lib/utils";

/**
 * CardTabs
 * Renders tab triggers as cards for a modern, visually appealing UI.
 * Usage:
 * <CardTabs value={value} onValueChange={setValue}>
 *   <CardTabs.List>
 *     <CardTabs.Trigger value="tab1" icon={<Icon />}>Tab 1</CardTabs.Trigger>
 *     ...
 *   </CardTabs.List>
 *   <CardTabs.Content value="tab1">...</CardTabs.Content>
 *   ...
 * </CardTabs>
 */
export function CardTabs({
  className,
  ...props
}: React.ComponentProps<typeof Tabs>) {
  return <Tabs className={cn("w-full", className)} {...props} />;
}

CardTabs.List = function CardTabsList({
  className,
  children,
  ...props
}: React.ComponentProps<typeof TabsList>) {
  return (
    <TabsList
      className={cn(
        "flex gap-4 bg-transparent p-0 border-0 shadow-none",
        className
      )}
      {...props}
    >
      {children}
    </TabsList>
  );
};

CardTabs.Trigger = function CardTabsTrigger({
  className,
  children,
  icon,
  ...props
}: React.ComponentProps<typeof TabsTrigger> & { icon?: React.ReactNode }) {
  return (
    <TabsTrigger
      className={cn(
        // Card style with vibrant, colorful UI
        "flex items-center gap-2 px-6 py-3 rounded-2xl border-2 font-semibold text-base shadow-md transition-all duration-300 relative overflow-hidden",
        // Active: gradient, shadow, border, text
        "data-[state=active]:bg-gradient-to-tr data-[state=active]:from-primary data-[state=active]:to-pink-500 data-[state=active]:text-white data-[state=active]:shadow-xl data-[state=active]:border-pink-400",
        // Inactive: pastel background, muted text, subtle border
        "data-[state=inactive]:bg-gradient-to-tr data-[state=inactive]:from-muted data-[state=inactive]:to-blue-100 dark:data-[state=inactive]:to-blue-900 data-[state=inactive]:text-muted-foreground data-[state=inactive]:border-muted",
        // Hover: brighten and lift
        "hover:scale-[1.04] hover:shadow-lg hover:bg-gradient-to-tr hover:from-primary/80 hover:to-pink-400/80 hover:text-white",
        // Focus ring
        "focus-visible:ring-2 focus-visible:ring-pink-400/70 focus-visible:z-10",
        // Animated transitions
        "transition-colors transition-shadow transition-transform",
        className
      )}
      {...props}
    >
      {icon && (
        <span
          className={cn(
            "mr-2 flex items-center",
            "data-[state=active]:text-white data-[state=inactive]:text-pink-500"
          )}
        >
          {icon}
        </span>
      )}
      <span className="z-10">{children}</span>
      {/* Optional: animated accent bar for active tab */}
      <span
        className={cn(
          "absolute left-0 bottom-0 h-1 w-full rounded-b-2xl transition-all duration-300",
          "data-[state=active]:bg-pink-400 data-[state=inactive]:bg-transparent"
        )}
      />
    </TabsTrigger>
  );
};

CardTabs.Content = TabsContent;