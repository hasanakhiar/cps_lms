"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Circle } from "lucide-react";
import { completeLessonAction, uncompleteLessonAction } from "@/actions/progress";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { CourseProgress } from "@/types";

/**
 * Mark complete / mark incomplete, with the progress bar beside it.
 *
 * `useOptimistic` flips the tick and moves the bar the instant the button is pressed,
 * then the Server Action's real numbers replace the guess. The optimistic value is a
 * *guess about the server's answer*, not the source of truth — when the request fails,
 * React discards it and the bar snaps back to what the server last said, which is the
 * behaviour that matters. Nothing here is ever persisted from the client.
 *
 * The button is disabled while pending so a double-click cannot fire twice. That is
 * belt-and-braces: the backend write is idempotent, so even a double submission
 * produces one row and the same percentage (leak test 11).
 */
export function CompleteButton({
  lessonDocumentId,
  courseSlug,
  isComplete,
  progress,
}: {
  lessonDocumentId: string;
  courseSlug: string;
  isComplete: boolean;
  progress: CourseProgress;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [optimistic, setOptimistic] = useOptimistic(
    { isComplete, progress },
    (_state, next: { isComplete: boolean; progress: CourseProgress }) => next
  );

  function onToggle() {
    const nextComplete = !optimistic.isComplete;

    startTransition(async () => {
      // Predict the new counts so the bar moves immediately. Clamped to the real
      // total, so an optimistic value can never render above 100% even briefly.
      const predictedCompleted = Math.min(
        Math.max(optimistic.progress.completed + (nextComplete ? 1 : -1), 0),
        optimistic.progress.totalLessons
      );

      setOptimistic({
        isComplete: nextComplete,
        progress: {
          ...optimistic.progress,
          completed: predictedCompleted,
          percentage:
            optimistic.progress.totalLessons === 0
              ? 0
              : Math.round((predictedCompleted / optimistic.progress.totalLessons) * 100),
        },
      });

      const result = nextComplete
        ? await completeLessonAction(lessonDocumentId, courseSlug)
        : await uncompleteLessonAction(lessonDocumentId, courseSlug);

      if (!result.ok) {
        // No manual rollback needed: the optimistic value only lives for the duration
        // of the transition, so React restores the server's value on its own.
        toast.error(result.message);
        return;
      }

      toast.success(nextComplete ? "Lesson marked complete" : "Lesson marked incomplete");

      // Pull the server's recomputed numbers into the Server Components on this page.
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-col gap-1.5">
        <Progress
          value={optimistic.progress.percentage}
          aria-label={`Course progress: ${optimistic.progress.percentage}%`}
        />
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {optimistic.progress.completed} of {optimistic.progress.totalLessons} lessons ·{" "}
          {optimistic.progress.percentage}%
        </p>
      </div>

      <Button
        onClick={onToggle}
        disabled={pending}
        variant={optimistic.isComplete ? "outline" : "default"}
      >
        {optimistic.isComplete ? (
          <>
            <Check className="size-4" aria-hidden="true" />
            Completed — mark incomplete
          </>
        ) : (
          <>
            <Circle className="size-4" aria-hidden="true" />
            Mark as complete
          </>
        )}
      </Button>
    </div>
  );
}
