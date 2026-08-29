import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format an ISO timestamp as a short, readable date.
 *
 * The locale is pinned to `en-GB` rather than left to the runtime. Dates are rendered
 * on the server and hydrated in the browser, and if the two disagree about locale
 * React reports a hydration mismatch — which is exactly what happens when the server
 * defaults to the host's locale and the visitor's browser has another.
 */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
