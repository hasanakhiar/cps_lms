"use client";

import { ErrorState } from "@/components/error-state";

export default function MyResultsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorState error={error} reset={reset} title="Your results could not be loaded" />;
}
