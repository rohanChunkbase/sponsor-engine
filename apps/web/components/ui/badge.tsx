import { cn } from "@/lib/utils";

const tones = {
  neutral: "bg-secondary text-muted-foreground",
  review: "bg-reviewed-wash text-reviewed",
  open: "bg-open-wash text-open-text",
  info: "bg-bluewash text-accent-foreground",
  test: "bg-open-wash text-open-text",
};

export function Badge({
  tone = "neutral",
  dot = false,
  className,
  children,
}: {
  tone?: keyof typeof tones;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const dotColor = tone === "review" ? "bg-reviewed" : tone === "open" || tone === "test" ? "bg-open" : "bg-primary";
  return (
    <span className={cn("inline-flex h-8 items-center gap-2 rounded-full px-3 font-mono text-[12px] leading-4 tracking-[0.08em] uppercase", tones[tone], className)}>
      {dot ? <span className={cn("size-2 rounded-full", dotColor)} /> : null}
      {children}
    </span>
  );
}
