"use client";

import { ErrorState } from "@/components/error-state";

export default function TeachError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorState error={error} reset={reset} title="The teaching area could not be loaded" />;
}
