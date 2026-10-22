import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Shimmer button.
 * Adapted from Watermelon UI: https://ui.watermelon.sh
 * Registry: https://registry.watermelon.sh/r/shimmer-button.json
 * MIT License.
 * This copy can render a link when href is set.
 * The sweep pauses when the visitor prefers reduced motion.
 */

const shimmerClass =
  "group relative inline-flex items-center justify-center overflow-hidden rounded-[8px] bg-primary px-6 font-medium text-primary-foreground";

const sheenClass =
  "pointer-events-none absolute inset-0 -translate-x-full bg-linear-to-r from-transparent via-carbon-blue/40 to-transparent transition-transform duration-700 group-hover:translate-x-full motion-reduce:transform-none motion-reduce:transition-none";

type Common = {
  children: ReactNode;
  className?: string;
};

type ButtonProps = Common & ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };
type LinkProps = Common & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

export function ShimmerButton(props: ButtonProps | LinkProps) {
  if (typeof props.href === "string") {
    const { children, className, href, ...rest } = props;
    return (
      <a href={href} className={cn(shimmerClass, className)} {...rest}>
        <span className="relative z-10">{children}</span>
        <span aria-hidden="true" className={sheenClass} />
      </a>
    );
  }

  const { children, className, ...rest } = props;
  return (
    <button className={cn(shimmerClass, className)} {...rest}>
      <span className="relative z-10">{children}</span>
      <span aria-hidden="true" className={sheenClass} />
    </button>
  );
}
