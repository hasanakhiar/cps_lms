"use client";

import { ErrorState } from "@/components/error-state";

export default function BlogError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorState error={error} reset={reset} title="The blog could not be loaded" />;
}
