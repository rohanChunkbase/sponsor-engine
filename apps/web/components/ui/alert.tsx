import { cn } from "@/lib/utils";

export function Alert({ className, ...props }: React.ComponentProps<"div">) {
  return <div role="status" className={cn("rounded-[12px] bg-open-wash px-6 py-4 text-[16px] leading-6 text-open-text", className)} {...props} />;
}
