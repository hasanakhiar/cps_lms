"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * The shared body of every `error.tsx` boundary.
 *
 * Next requires each boundary to be its own file, but the contents are identical
 * everywhere, so the markup lives here and each boundary is three lines.
 *
 * What is deliberately *not* shown: `error.message`. In production Next replaces server
 * error messages with a generic string and a digest anyway, but a boundary that renders
 * whatever it is handed will happily print a database error or an internal path the
 * moment something throws in development and gets shipped. The digest is shown instead
 * — it is the value that lets a specific failure be found in the server logs, and it
 * reveals nothing on its own.
 */
export function ErrorState({
  error,
  reset,
  title = "Something went wrong",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
}) {
  useEffect(() => {
    // The server-side log is the useful record; this makes the failure visible in the
    // browser console too when someone is debugging a report.
    console.error(error);
  }, [error]);

  return (
    <div className="container flex flex-col items-center gap-6 py-16">
      <Card className="w-full max-w-lg">
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <AlertTriangle className="size-10 text-destructive" aria-hidden="true" />

          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold">{title}</h1>
            <p className="text-sm text-muted-foreground text-pretty">
              This page could not be loaded. Trying again often works — the backend may
              have been briefly unavailable.
            </p>
          </div>

          {error.digest ? (
            <p className="font-mono text-xs text-muted-foreground">Reference: {error.digest}</p>
          ) : null}

          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={reset}>Try again</Button>
            <Button variant="outline" render={<Link href="/" />}>
              Back to home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
