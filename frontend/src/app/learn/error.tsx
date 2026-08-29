"use client";

import { ErrorState } from "@/components/error-state";

export default function LearnError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorState error={error} reset={reset} title="This lesson could not be loaded" />;
}
