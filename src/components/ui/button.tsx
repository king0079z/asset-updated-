import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { useTranslation } from "@/contexts/TranslationContext"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow hover:bg-primary/90 dark:shadow-primary/20 dark:shadow-md dark:hover:shadow-primary/30",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 dark:shadow-destructive/20",
        outline:
          "text-foreground border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground dark:border-border/60 dark:hover:border-border",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 dark:bg-secondary/90 dark:text-secondary-foreground dark:hover:bg-secondary",
        ghost: "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/30",
        link: "text-primary underline-offset-4 hover:underline dark:text-primary/90 dark:hover:text-primary",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    const { t } = useTranslation();
    const Comp = asChild ? Slot : "button"
    
    // Enhanced error handling for event handlers
    const safeProps = { ...props };
    
    // Safely wrap any onClick handlers to prevent crashes
    if (typeof safeProps.onClick === 'function') {
      const originalOnClick = safeProps.onClick;
      safeProps.onClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        try {
          originalOnClick(event);
        } catch (error) {
          console.error('Error in button onClick handler:', error);
          // Prevent the default action if there was an error
          event.preventDefault();
          
          // Provide user feedback when an error occurs
          if (typeof window !== 'undefined' && window.document) {
            try {
              // Import toast dynamically to avoid circular dependencies
              import('@/components/ui/use-toast').then(({ toast }) => {
                toast({
                  title: t("action_error"),
                  description: t("error_processing_request"),
                  variant: "destructive",
                });
              }).catch(() => {
                // Fallback if toast import fails
                console.error('Failed to show toast notification');
              });
            } catch (toastError) {
              console.error('Error showing toast:', toastError);
            }
          }
        }
      };
    }
    
    // Add debounce protection for rapid clicks
    if (typeof safeProps.onClick === 'function' && !safeProps.disabled) {
      const originalOnClick = safeProps.onClick;
      let lastClickTime = 0;
      const debounceTime = 300; // milliseconds
      
      safeProps.onClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        const now = Date.now();
        if (now - lastClickTime < debounceTime) {
          event.preventDefault();
          return;
        }
        
        lastClickTime = now;
        originalOnClick(event);
      };
    }
    
    // Translate button text if it's a string
    let translatedChildren = children;
    if (typeof children === 'string') {
      translatedChildren = t(children);
    }
    
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...safeProps}
      >
        {translatedChildren}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }