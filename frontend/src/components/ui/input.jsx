import * as React from "react";
import { cn } from "@/utils/cn";

const Input = React.forwardRef(({ className, type = "text", ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex min-h-11 w-full rounded-sm border border-[#E2E8F0] bg-white px-3 py-3 text-sm text-[#0F172A] transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[#64748B] focus-visible:border-[#10B981] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#10B981]/10 disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:min-h-10 sm:py-2",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
