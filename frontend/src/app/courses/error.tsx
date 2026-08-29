"use client";

import { ErrorState } from "@/components/error-state";

export default function CoursesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorState error={error} reset={reset} title="Courses could not be loaded" />;
}
