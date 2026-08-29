"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { submitQuizAction } from "@/actions/quiz";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { QuizBreakdown } from "@/components/quiz-breakdown";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { QuizDetail, QuizResult } from "@/types";

/**
 * The quiz form and, once submitted, the result screen.
 *
 * All questions on one page. The client holds only which option index is selected per
 * question — never a score, never which option is right, because the server does not
 * send that and this component has no field to read it from.
 *
 * Three guards the spec asks for, in one place:
 *  - the submit button is disabled while grading, so it cannot fire twice;
 *  - a confirmation dialog appears when questions are unanswered;
 *  - once a result exists the form is replaced, so the same attempt cannot be
 *    submitted again by pressing back into the form.
 */
export function QuizForm({ quiz, courseSlug }: { quiz: QuizDetail; courseSlug: string }) {
  const questions = quiz.questions ?? [];

  // `null` means unanswered, which is exactly what the API expects for that question.
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const [result, setResult] = useState<QuizResult | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const unanswered = answers.filter((answer) => answer === null).length;

  function choose(questionIndex: number, optionIndex: number) {
    setAnswers((current) =>
      current.map((value, index) => (index === questionIndex ? optionIndex : value))
    );
  }

  function submit() {
    setConfirmOpen(false);

    startTransition(async () => {
      const response = await submitQuizAction(quiz.documentId, courseSlug, answers);

      if (!response.ok) {
        toast.error(response.message);
        return;
      }

      setResult(response.data);
      toast.success(`Scored ${response.data.score}/${response.data.total}`);
    });
  }

  function onSubmitClick() {
    if (unanswered > 0) {
      setConfirmOpen(true);
      return;
    }
    submit();
  }

  if (result) {
    return (
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-3">
              <span>Your result</span>
              <Badge variant={result.passed ? "default" : "destructive"}>
                {result.passed ? "Passed" : "Not passed"}
              </Badge>
            </CardTitle>
          </CardHeader>

          <CardContent className="flex flex-col gap-3">
            <p className="text-3xl font-bold tabular-nums">
              {result.score} / {result.total}{" "}
              <span className="text-lg font-normal text-muted-foreground">
                ({result.percentage}%)
              </span>
            </p>

            <Progress value={result.percentage} aria-label={`Scored ${result.percentage}%`} />

            <p className="text-sm text-muted-foreground">
              Pass mark is {quiz.passingScore}%.
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button variant="outline" render={<Link href="/my-results" />}>
                All my results
              </Button>
              <Button variant="secondary" render={<Link href={`/learn/${courseSlug}`} />}>
                Back to lessons
              </Button>
            </div>
          </CardContent>
        </Card>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold tracking-tight">Question review</h2>
          <QuizBreakdown breakdown={result.breakdown} />
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <ol className="flex flex-col gap-4">
        {questions.map((question, questionIndex) => (
          <li key={question.id}>
            <fieldset className="flex flex-col gap-3 rounded-lg border p-4">
              <legend className="px-1 font-medium text-pretty">
                <span className="text-muted-foreground tabular-nums">{questionIndex + 1}. </span>
                {question.prompt}
              </legend>

              <div className="flex flex-col gap-2">
                {question.options.map((option, optionIndex) => {
                  const id = `q${questionIndex}-o${optionIndex}`;
                  return (
                    // A real radio input, so arrow keys move between options and the
                    // group is announced as a group. A div with onClick would need all
                    // of that rebuilt by hand.
                    <label
                      key={option.id}
                      htmlFor={id}
                      className="flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm transition-colors hover:bg-muted/60 has-checked:border-primary has-checked:bg-muted"
                    >
                      <input
                        type="radio"
                        id={id}
                        name={`question-${questionIndex}`}
                        checked={answers[questionIndex] === optionIndex}
                        onChange={() => choose(questionIndex, optionIndex)}
                        className="size-4 accent-primary"
                      />
                      <span>{option.label}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-4">
        <Button size="lg" onClick={onSubmitClick} disabled={pending}>
          {pending ? "Grading…" : "Submit answers"}
        </Button>

        <p className="text-sm text-muted-foreground" aria-live="polite">
          {unanswered === 0
            ? "All questions answered."
            : `${unanswered} of ${questions.length} unanswered.`}
        </p>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit with unanswered questions?</DialogTitle>
            <DialogDescription>
              {unanswered} {unanswered === 1 ? "question is" : "questions are"} still blank.
              Unanswered questions are graded as incorrect.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Keep answering
            </Button>
            <Button onClick={submit} disabled={pending}>
              Submit anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
