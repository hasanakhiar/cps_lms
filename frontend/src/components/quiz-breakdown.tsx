import { Check, X, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { GradedQuestion } from "@/types";

/**
 * Per-question review, rendered from the frozen `gradedBreakdown` snapshot.
 *
 * The snapshot stores the prompt and both labels as text rather than referencing the
 * quiz, which is what lets an old result stay readable after the instructor reorders
 * options or deletes a question. Nothing here re-reads the live quiz, so nothing here
 * can go stale or start showing the wrong answer key.
 */
export function QuizBreakdown({ breakdown }: { breakdown: GradedQuestion[] }) {
  if (breakdown.length === 0) {
    return <p className="text-sm text-muted-foreground">No question detail was recorded.</p>;
  }

  return (
    <ol className="flex flex-col gap-4">
      {breakdown.map((question, index) => (
        <li key={index} className="flex flex-col gap-2 rounded-lg border p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="font-medium text-pretty">
              <span className="text-muted-foreground tabular-nums">{index + 1}. </span>
              {question.prompt}
            </p>

            {question.wasCorrect ? (
              <Badge className="shrink-0 gap-1">
                <Check className="size-3" aria-hidden="true" />
                Correct
              </Badge>
            ) : question.answered ? (
              <Badge variant="destructive" className="shrink-0 gap-1">
                <X className="size-3" aria-hidden="true" />
                Incorrect
              </Badge>
            ) : (
              <Badge variant="secondary" className="shrink-0 gap-1">
                <Minus className="size-3" aria-hidden="true" />
                Not answered
              </Badge>
            )}
          </div>

          <dl className="flex flex-col gap-1 text-sm">
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Your answer:</dt>
              <dd>{question.chosenLabel ?? <span className="italic">left blank</span>}</dd>
            </div>

            {/* The correct label is shown only once the attempt is graded — which is
                the only context this component renders in. It comes from the stored
                snapshot, never from a live quiz read. */}
            {!question.wasCorrect ? (
              <div className="flex gap-2">
                <dt className="text-muted-foreground">Correct answer:</dt>
                <dd>
                  {question.correctLabel ?? (
                    <span className="italic">no correct option was set</span>
                  )}
                </dd>
              </div>
            ) : null}
          </dl>
        </li>
      ))}
    </ol>
  );
}
