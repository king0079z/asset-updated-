// @ts-nocheck
import * as React from "react"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import { MovementTypeIndicator } from "@/components/MovementTypeIndicator"

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  showMovementIndicator?: boolean;
}

const Card = React.forwardRef<
  HTMLDivElement,
  CardProps
>(({ className, showMovementIndicator = false, ...props }, ref) => (
  <motion.div
    ref={ref}
    className={cn(
      "rounded-[calc(var(--radius)+2px)] border-border border bg-card text-card-foreground shadow-sm hover:shadow transition-all duration-300 relative",
      "dark:bg-gradient-to-br dark:from-card dark:to-card/90 dark:shadow-md dark:shadow-primary/5",
      "backdrop-blur-[2px] backdrop-saturate-[180%]",
      "before:content-[''] before:absolute before:inset-0 before:rounded-[calc(var(--radius)+2px)] before:p-[1px] before:bg-gradient-to-b before:from-border/40 before:to-transparent before:opacity-50 before:-z-10",
      className
    )}
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{
      type: "spring",
      stiffness: 100,
      damping: 15,
    }}
    whileHover={{ 
      y: -5,
      boxShadow: "0 12px 28px -5px rgba(0, 0, 0, 0.15), 0 10px 12px -6px rgba(0, 0, 0, 0.1)",
      scale: 1.005
    }}
    {...props}
  >
    {props.showMovementIndicator && (
      <div className="absolute top-2 right-2 z-10">
        <MovementTypeIndicator showDetails={false} />
      </div>
    )}
    {props.children}
  </motion.div>
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex flex-col space-y-1.5 p-6 pb-4",
      "border-b border-border/30 mb-2",
      "bg-gradient-to-b from-transparent to-muted/20 dark:to-muted/10",
      "rounded-t-[calc(var(--radius)+1px)]",
      className
    )}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "font-semibold leading-none tracking-tight text-lg",
      "bg-gradient-to-br from-foreground to-foreground/80 bg-clip-text dark:text-transparent",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn(
      "text-sm text-muted-foreground mt-1.5",
      "opacity-90 hover:opacity-100 transition-opacity",
      className
    )}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div 
    ref={ref} 
    className={cn(
      "p-6 pt-0 relative transition-all duration-200",
      "after:content-[''] after:absolute after:left-0 after:right-0 after:bottom-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-border/50 after:to-transparent after:opacity-0 hover:after:opacity-100 after:transition-opacity",
      "dark:bg-gradient-to-b dark:from-transparent dark:to-card/5",
      className
    )} 
    {...props} 
  />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex items-center p-6 pt-2 mt-2",
      "border-t border-border/30",
      "bg-gradient-to-t from-transparent to-muted/10 dark:to-muted/5",
      "rounded-b-[calc(var(--radius)+1px)]",
      className
    )}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }