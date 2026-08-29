"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Light/dark switch.
 *
 * `mounted` guards against a hydration mismatch: the resolved theme is only knowable in
 * the browser (it can come from `localStorage` or the OS preference), so the server has
 * no way to render the correct icon. Rendering a fixed placeholder until mount means the
 * markup matches on both sides, and the real icon appears a frame later.
 *
 * `resolvedTheme` rather than `theme`, because `theme` can be `"system"` — which is a
 * preference, not an answer, and cannot be turned into an icon.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {/* Before mount the theme is unknown, so a single neutral icon is shown rather
          than guessing and flipping on hydration. */}
      {!mounted ? (
        <Sun className="size-4" aria-hidden="true" />
      ) : isDark ? (
        <Moon className="size-4" aria-hidden="true" />
      ) : (
        <Sun className="size-4" aria-hidden="true" />
      )}
    </Button>
  );
}
