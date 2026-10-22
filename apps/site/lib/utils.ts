import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** shadcn class combiner. Watermelon blocks expect this helper. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
