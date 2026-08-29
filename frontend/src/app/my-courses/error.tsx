"use client";

import { ErrorState } from "@/components/error-state";

export default function MyCoursesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorState error={error} reset={reset} title="Your courses could not be loaded" />;
}
