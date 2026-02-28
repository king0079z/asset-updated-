import * as React from "react";
import { cn } from "@/lib/utils";

type CodeProps = React.HTMLAttributes<HTMLElement>;

export function Code({ className, ...props }: CodeProps) {
  return (
    <code
      className={cn(
        "rounded bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground",
        className
      )}
      {...props}
    />
  );
}
