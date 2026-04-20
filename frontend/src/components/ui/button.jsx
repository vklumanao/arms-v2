import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "@/utils/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ring-offset-background",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-[#1E40AF] shadow-sm",

        mono: "bg-primary text-white hover:bg-[#1D4ED8] active:bg-[#1E3A8A] shadow-sm",

        destructive:
          "bg-[#EF4444] text-white hover:bg-[#DC2626] active:bg-[#B91C1C] shadow-sm",

        outline:
          "border border-[#93C5FD] bg-white text-[#1E3A8A] hover:bg-[#EFF6FF] hover:border-[#60A5FA] active:bg-[#DBEAFE]",

        secondary: "bg-secondary text-secondary-foreground hover:bg-[#2563EB]",

        ghost: "text-[#1E3A8A] hover:bg-[#EFF6FF]",

        link: "text-[#1D4ED8] underline-offset-4 hover:text-[#1E3A8A] hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
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
