import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-[var(--radius-md)] text-sm font-medium transition-all duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)] disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97]",
  {
    variants: {
      variant: {
        default:
          "gradient-primary text-white shadow-none hover:shadow-[var(--shadow-ambient)] hover:brightness-105 transition-all",
        secondary:
          "bg-transparent text-[var(--color-primary)] ghost-border hover:bg-[var(--color-primary-fixed)] transition-all",
        ghost:
          "bg-transparent text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-container)] transition-all",
        destructive:
          "bg-[var(--color-danger)] text-white shadow-none hover:shadow-[var(--shadow-ambient)] hover:brightness-105 transition-all",
      },
      size: {
        sm: "h-8 px-3 text-xs rounded-lg",
        default: "h-11 px-4 py-2",
        lg: "h-12 px-6 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
