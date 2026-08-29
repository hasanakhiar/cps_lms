"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { saveQuizAction, deleteQuizAction, type QuizInput } from "@/actions/quizzes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ConfirmDelete } from "@/components/confirm-delete";

/**
 * A quiz as the builder holds it while editing.
 *
 * `isCorrect` is present here — the instructor is authoring the answer key, so this is
 * one of the few places it legitimately exists client-side. The same field is stripped
 * from every student-facing response by the quiz controller.
 */
type DraftOption = { label: string; isCorrect: boolean };
type DraftQuestion = { prompt: string; options: DraftOption[] };
export type DraftQuiz = {
  documentId?: string;
  title: string;
  passingScore: number;
  questions: DraftQuestion[];
};

const blankQuestion = (): DraftQuestion => ({
  prompt: "",
  options: [
    { label: "", isCorrect: true },
    { label: "", isCorrect: false },
  ],
});

/**
 * Validate before sending, with the same rules the Server Action enforces.
 *
 * Duplicated deliberately — not as the security boundary, which is the action and then
 * Strapi, but so the instructor sees the problem next to the question that has it
 * rather than as a toast after a round trip. The messages are worded the same in both
 * places so they cannot drift into contradicting each other.
 */
function validate(quiz: DraftQuiz): string[] {
  const problems: string[] = [];

  if (quiz.title.trim().length < 3) {
    problems.push("The quiz needs a title of at least 3 characters.");
  }

  if (quiz.questions.length === 0) {
    problems.push("A quiz needs at least one question.");
  }

  quiz.questions.forEach((question, index) => {
    const position = index + 1;

    if (!question.prompt.trim()) {
      problems.push(`Question ${position} has no prompt.`);
    }

    if (question.options.length < 2) {
      problems.push(
        `Question ${position} needs at least two options — a single-option question cannot be got wrong.`
      );
      return;
    }

    if (question.options.some((option) => !option.label.trim())) {
      problems.push(`Question ${position} has an option with no label.`);
    }

    const correct = question.options.filter((option) => option.isCorrect).length;

    if (correct === 0) {
      problems.push(
        `Question ${position} has no correct answer marked. The grader would score it zero for every student.`
      );
    } else if (correct > 1) {
      problems.push(`Question ${position} has ${correct} correct answers. Mark exactly one.`);
    }
  });

  return problems;
}

export function QuizBuilder({
  courseDocumentId,
  courseSlug,
  initial,
  onClose,
}: {
  courseDocumentId: string;
  courseSlug: string;
  initial?: DraftQuiz;
  onClose: () => void;
}) {
  const router = useRouter();
  const [quiz, setQuiz] = useState<DraftQuiz>(
    initial ?? { title: "", passingScore: 60, questions: [blankQuestion()] }
  );
  const [problems, setProblems] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  function patchQuestion(index: number, patch: Partial<DraftQuestion>) {
    setQuiz((q) => ({
      ...q,
      questions: q.questions.map((question, i) =>
        i === index ? { ...question, ...patch } : question
      ),
    }));
  }

  function patchOption(qIndex: number, oIndex: number, patch: Partial<DraftOption>) {
    setQuiz((q) => ({
      ...q,
      questions: q.questions.map((question, i) =>
        i !== qIndex
          ? question
          : {
              ...question,
              options: question.options.map((option, j) =>
                j === oIndex ? { ...option, ...patch } : option
              ),
            }
      ),
    }));
  }

  /** Marking one option correct clears the others — exactly one answer per question. */
  function markCorrect(qIndex: number, oIndex: number) {
    setQuiz((q) => ({
      ...q,
      questions: q.questions.map((question, i) =>
        i !== qIndex
          ? question
          : {
              ...question,
              options: question.options.map((option, j) => ({
                ...option,
                isCorrect: j === oIndex,
              })),
            }
      ),
    }));
  }

  function save() {
    const found = validate(quiz);
    setProblems(found);

    if (found.length > 0) {
      toast.error("Fix the listed problems before saving");
      return;
    }

    startTransition(async () => {
      const input: QuizInput = {
        title: quiz.title,
        passingScore: quiz.passingScore,
        questions: quiz.questions,
      };

      const result = await saveQuizAction(input, courseDocumentId, courseSlug, quiz.documentId);

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success("Quiz saved");
      onClose();
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">{quiz.documentId ? "Edit quiz" : "New quiz"}</CardTitle>
        <Button size="icon" variant="ghost" aria-label="Close builder" onClick={onClose}>
          <X className="size-4" aria-hidden="true" />
        </Button>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {problems.length > 0 ? (
          <Alert variant="destructive">
            <AlertTitle>This quiz cannot be saved yet</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4">
                {problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
          <div className="flex flex-col gap-2">
            <Label htmlFor="quiz-title">Title</Label>
            <Input
              id="quiz-title"
              value={quiz.title}
              onChange={(e) => setQuiz({ ...quiz, title: e.target.value })}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="quiz-pass">Pass mark (%)</Label>
            <Input
              id="quiz-pass"
              type="number"
              min={0}
              max={100}
              value={quiz.passingScore}
              onChange={(e) => setQuiz({ ...quiz, passingScore: Number(e.target.value) })}
            />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {quiz.questions.map((question, qIndex) => (
            <fieldset key={qIndex} className="flex flex-col gap-3 rounded-lg border p-4">
              <legend className="px-1 text-sm font-medium">Question {qIndex + 1}</legend>

              <div className="flex items-end gap-2">
                <div className="flex flex-1 flex-col gap-2">
                  <Label htmlFor={`prompt-${qIndex}`}>Prompt</Label>
                  <Input
                    id={`prompt-${qIndex}`}
                    value={question.prompt}
                    onChange={(e) => patchQuestion(qIndex, { prompt: e.target.value })}
                  />
                </div>

                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Remove question ${qIndex + 1}`}
                  disabled={quiz.questions.length === 1}
                  onClick={() =>
                    setQuiz({
                      ...quiz,
                      questions: quiz.questions.filter((_, i) => i !== qIndex),
                    })
                  }
                >
                  <X className="size-4" aria-hidden="true" />
                </Button>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-sm text-muted-foreground">
                  Select the radio button beside the correct answer.
                </span>

                {question.options.map((option, oIndex) => (
                  <div key={oIndex} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`correct-${qIndex}`}
                      checked={option.isCorrect}
                      onChange={() => markCorrect(qIndex, oIndex)}
                      aria-label={`Mark option ${oIndex + 1} of question ${qIndex + 1} as correct`}
                      className="size-4 shrink-0 accent-primary"
                    />

                    <Input
                      value={option.label}
                      placeholder={`Option ${oIndex + 1}`}
                      aria-label={`Option ${oIndex + 1} of question ${qIndex + 1}`}
                      onChange={(e) => patchOption(qIndex, oIndex, { label: e.target.value })}
                    />

                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Remove option ${oIndex + 1}`}
                      disabled={question.options.length <= 2}
                      onClick={() =>
                        patchQuestion(qIndex, {
                          options: question.options.filter((_, i) => i !== oIndex),
                        })
                      }
                    >
                      <X className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                ))}

                <Button
                  size="sm"
                  variant="outline"
                  className="self-start"
                  onClick={() =>
                    patchQuestion(qIndex, {
                      options: [...question.options, { label: "", isCorrect: false }],
                    })
                  }
                >
                  <Plus className="size-4" aria-hidden="true" />
                  Add option
                </Button>
              </div>
            </fieldset>
          ))}

          <Button
            variant="outline"
            className="self-start"
            onClick={() => setQuiz({ ...quiz, questions: [...quiz.questions, blankQuestion()] })}
          >
            <Plus className="size-4" aria-hidden="true" />
            Add question
          </Button>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save quiz"}
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>

          {quiz.documentId ? (
            <ConfirmDelete
              size="default"
              title={quiz.title || "this quiz"}
              consequence="This deletes the quiz. Existing attempts keep their frozen result snapshots, so students' past scores stay readable."
              onConfirm={() => deleteQuizAction(quiz.documentId!, courseDocumentId, courseSlug)}
            />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
