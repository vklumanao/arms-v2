import * as React from "react";
import { cn } from "@/utils/cn";

const Textarea = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[120px] w-full rounded-sm border border-[#E2E8F0] bg-white px-3 py-3 text-sm text-[#0F172A] placeholder:text-[#64748B] focus-visible:border-[#10B981] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#10B981]/10 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-[96px] sm:py-2",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
