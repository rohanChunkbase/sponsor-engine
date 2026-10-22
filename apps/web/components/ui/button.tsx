import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-sans text-[16px] leading-6 font-medium transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-ring disabled:pointer-events-none disabled:bg-unavailable disabled:text-unavailable-foreground [&_svg]:size-3.5",
  {
    variants: {
      variant: {
        default: "h-12 rounded-[8px] bg-primary px-[18px] text-primary-foreground",
        secondary: "h-12 rounded-[8px] border border-border bg-background px-[18px] text-foreground",
        ghost: "h-12 rounded-[8px] bg-transparent px-2 text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Button({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant }), className)} {...props} />;
}
