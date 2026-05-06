import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "@/utils/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-sm font-semibold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#10B981] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[#10B981] text-white shadow-sm hover:bg-[#059669] hover:shadow-md active:bg-[#047857]",

        mono: "bg-[#10B981] text-white shadow-sm hover:bg-[#059669] hover:shadow-md active:bg-[#047857]",

        destructive:
          "bg-[#F97316] text-white shadow-sm hover:bg-[#EA580C] hover:shadow-md active:bg-[#C2410C]",

        outline:
          "border border-[#E2E8F0] bg-white text-[#1E293B] hover:border-[#10B981] hover:bg-[#F8FAFC] active:bg-[#F1F5F9]",

        secondary: "bg-[#E2E8F0] text-[#1E293B] hover:bg-[#CBD5E1] active:bg-[#CBD5E1]",

        ghost: "text-[#1E293B] hover:bg-[#F8FAFC]",

        link: "text-[#047857] underline-offset-4 hover:text-[#065F46] hover:underline",
      },
      size: {
        default: "min-h-11 px-4 py-3 sm:h-10 sm:min-h-10 sm:py-2",
        sm: "min-h-10 rounded-sm px-3 py-2 sm:h-9 sm:min-h-9",
        lg: "min-h-12 rounded-sm px-6 py-3 sm:h-11 sm:min-h-11 sm:px-8 sm:py-2",
        icon: "h-11 w-11 sm:h-10 sm:w-10",
      },
    },
    defaultVariants: {
      variant: "mono",
      size: "default",
    },
  },
);

const Button = React.forwardRef(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
