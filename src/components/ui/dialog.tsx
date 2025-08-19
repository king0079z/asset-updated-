import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Cross2Icon, CopyIcon, Share1Icon, EnterFullScreenIcon, ExitFullScreenIcon } from "@radix-ui/react-icons"

import { cn } from "@/lib/utils"
import { useTranslation } from "@/contexts/TranslationContext"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 backdrop-blur-sm bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

interface DialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  showPrintButton?: boolean;
  showCopyButton?: boolean;
  showShareButton?: boolean;
  showFullscreenButton?: boolean;
  title?: string;
  description?: string;
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ 
  className, 
  children, 
  showPrintButton = false, 
  showCopyButton = false,
  showShareButton = false,
  showFullscreenButton = false,
  title,
  description,
  ...props 
}, ref) => {
  const { t, language } = useTranslation();
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [isPrinting, setIsPrinting] = React.useState(false);
  const [copySuccess, setCopySuccess] = React.useState<string | null>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleCopy = () => {
    const dialogContent = document.querySelector('[role="dialog"]');
    if (dialogContent) {
      // Create a temporary element to hold the text content
      const tempElement = document.createElement('div');
      tempElement.innerHTML = dialogContent.innerHTML;
      
      // Remove buttons and other UI elements
      const buttons = tempElement.querySelectorAll('button');
      buttons.forEach(button => button.remove());
      
      // Get the text content
      const textContent = tempElement.textContent || '';
      
      // Copy to clipboard
      navigator.clipboard.writeText(textContent.trim())
        .then(() => {
          setCopySuccess(t('copied'));
          setTimeout(() => setCopySuccess(null), 2000);
        })
        .catch(() => {
          setCopySuccess(t('failed_to_copy'));
          setTimeout(() => setCopySuccess(null), 2000);
        });
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        const dialogContent = document.querySelector('[role="dialog"]');
        const textContent = dialogContent?.textContent || '';
        
        await navigator.share({
          title: title ? t(title) : t('shared_content'),
          text: textContent.trim(),
        });
      } catch (error) {
        console.error('Error sharing content:', error);
      }
    } else {
      // Fallback to copy if Web Share API is not available
      handleCopy();
      setCopySuccess(t('copied_for_sharing'));
      setTimeout(() => setCopySuccess(null), 2000);
    }
  };

  const handlePrint = () => {
    setIsPrinting(true);
    // Get the dialog content excluding the buttons
    const dialogContent = document.querySelector('[role="dialog"]')?.cloneNode(true) as HTMLElement;
    if (dialogContent) {
      // Remove the buttons from the cloned content
      const buttons = dialogContent.querySelectorAll('button');
      buttons.forEach(button => button.remove());
      
      // Import the print utility dynamically to avoid SSR issues
      import('@/util/print').then(({ printContent }) => {
        printContent(dialogContent.innerHTML, title ? t(title) : t('report'))
          .finally(() => {
            setIsPrinting(false);
          });
      });
    } else {
      setIsPrinting(false);
    }
  };

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed z-50 grid w-full gap-4 border bg-background shadow-xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
          isFullscreen 
            ? "inset-0 rounded-none h-screen overflow-y-auto" 
            : "left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] max-w-[95vw] w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl rounded-xl max-h-[90vh] overflow-y-auto",
          "border-border/40 dark:border-border/30",
          "ring-1 ring-black/5 dark:ring-white/10",
          "dark:bg-gradient-to-b dark:from-background dark:to-background/95 dark:shadow-primary/5",
          className
        )}
        {...props}
      >
        <div className="relative p-4 sm:p-6 md:p-8 lg:p-10 overflow-y-auto" ref={contentRef}>
          {/* Title and description if provided */}
          {(title || description) && (
            <div className="mb-4 sm:mb-6 border-b border-border/30 pb-3 sm:pb-4 pr-8">
              {title && (
                <h2 className="text-lg sm:text-xl font-semibold leading-tight tracking-tight">{t(title)}</h2>
              )}
              {description && (
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 sm:mt-2">{t(description)}</p>
              )}
            </div>
          )}
          
          {/* Main content */}
          <div className={cn(
            "relative w-full",
            (title || description) ? "" : "pt-4 sm:pt-6" // Add padding top if no title/description
          )}>
            {children}
          </div>
        </div>
        
        {/* Action buttons */}
        <div className="absolute right-2 sm:right-4 top-2 sm:top-4 flex items-center space-x-1 sm:space-x-2">
          {showCopyButton && (
            <div className="relative">
              <button
                type="button"
                onClick={handleCopy}
                className="rounded-full bg-secondary/80 hover:bg-secondary text-secondary-foreground p-1.5 sm:p-2 transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none flex items-center justify-center"
                aria-label={t('copy_content')}
              >
                <CopyIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="sr-only">{t('copy')}</span>
              </button>
              {copySuccess && (
                <span className="absolute -bottom-8 right-0 text-xs bg-background border border-border/30 px-2 py-1 rounded shadow-sm">
                  {copySuccess}
                </span>
              )}
            </div>
          )}
          
          {showShareButton && (
            <button
              type="button"
              onClick={handleShare}
              className="rounded-full bg-secondary/80 hover:bg-secondary text-secondary-foreground p-1.5 sm:p-2 transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none flex items-center justify-center"
              aria-label={t('share_content')}
            >
              <Share1Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="sr-only">{t('share')}</span>
            </button>
          )}
          
          {showFullscreenButton && (
            <button
              type="button"
              onClick={toggleFullscreen}
              className="rounded-full bg-secondary/80 hover:bg-secondary text-secondary-foreground p-1.5 sm:p-2 transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none flex items-center justify-center"
              aria-label={isFullscreen ? t('exit_fullscreen') : t('enter_fullscreen')}
            >
              {isFullscreen ? (
                <ExitFullScreenIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              ) : (
                <EnterFullScreenIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              )}
              <span className="sr-only">{isFullscreen ? t('exit_fullscreen') : t('enter_fullscreen')}</span>
            </button>
          )}
          
          {showPrintButton && (
            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting}
              className="rounded-full bg-secondary/80 hover:bg-secondary text-secondary-foreground p-1.5 sm:p-2 transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 flex items-center justify-center"
              aria-label={t('print')}
            >
              {isPrinting ? (
                <div className="h-3.5 w-3.5 sm:h-4 sm:w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 sm:h-4 sm:w-4">
                  <polyline points="6 9 6 2 18 2 18 9"></polyline>
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                  <rect x="6" y="14" width="12" height="8"></rect>
                </svg>
              )}
              <span className="sr-only">{t('print')}</span>
            </button>
          )}
          
          <DialogPrimitive.Close className="rounded-full bg-secondary/80 hover:bg-secondary text-secondary-foreground p-1.5 sm:p-2 transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
            <Cross2Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="sr-only">{t('close')}</span>
          </DialogPrimitive.Close>
        </div>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
})
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left mb-6",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-3 mt-6 pt-4 border-t border-border/30",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, children, ...props }, ref) => {
  const { t } = useTranslation();
  
  // If children is a string, translate it, otherwise pass it through
  const translatedChildren = typeof children === 'string' ? t(children) : children;
  
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn(
        "text-xl font-semibold leading-none tracking-tight",
        className
      )}
      {...props}
    >
      {translatedChildren}
    </DialogPrimitive.Title>
  );
})
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, children, ...props }, ref) => {
  const { t } = useTranslation();
  
  // If children is a string, translate it, otherwise pass it through
  const translatedChildren = typeof children === 'string' ? t(children) : children;
  
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn("text-sm text-muted-foreground mt-2", className)}
      {...props}
    >
      {translatedChildren}
    </DialogPrimitive.Description>
  );
})
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}