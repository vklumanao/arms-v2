import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/utils/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#10B981] focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-[#10B981] text-white",
        secondary: "border-transparent bg-[#E2E8F0] text-[#1E293B]",
        destructive:
          "border-transparent bg-[#F97316] text-white",
        outline: "border-[#E2E8F0] bg-white text-[#1E293B]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
