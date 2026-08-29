"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Wraps the app in `next-themes`, which toggles a `.dark` class on `<html>`.
 *
 * `attribute="class"` is what the Tailwind palette keys off — `globals.css` defines the
 * light tokens on `:root` and the dark ones under `.dark`, so switching the class swaps
 * every colour at once with no per-component work.
 *
 * `disableTransitionOnChange` suppresses the CSS transitions during the swap. Without
 * it every element animates its colour independently and the change looks like a
 * smear rather than a switch.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
