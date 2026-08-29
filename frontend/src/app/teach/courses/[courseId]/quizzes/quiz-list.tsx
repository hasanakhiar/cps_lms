"use client";

import { useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { QuizBuilder, type DraftQuiz } from "./quiz-builder";

export function QuizList({
  courseDocumentId,
  courseSlug,
  quizzes,
}: {
  courseDocumentId: string;
  courseSlug: string;
  quizzes: DraftQuiz[];
}) {
  const [editing, setEditing] = useState<DraftQuiz | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight">
          {quizzes.length} {quizzes.length === 1 ? "quiz" : "quizzes"}
        </h2>

        <Button
          onClick={() => {
            setCreating(true);
            setEditing(null);
          }}
        >
          <Plus className="size-4" aria-hidden="true" />
          Add quiz
        </Button>
      </div>

      {creating || editing ? (
        <QuizBuilder
          key={editing?.documentId ?? "new"}
          courseDocumentId={courseDocumentId}
          courseSlug={courseSlug}
          initial={editing ?? undefined}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      ) : null}

      {quizzes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No quizzes yet. Add one to assess what students have learned.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {quizzes.map((quiz) => (
            <li key={quiz.documentId}>
              <Card>
                <CardContent className="flex flex-wrap items-center gap-3 py-4">
                  <span className="min-w-0 flex-1 truncate font-medium">{quiz.title}</span>

                  <span className="text-sm text-muted-foreground">
                    {quiz.questions.length}{" "}
                    {quiz.questions.length === 1 ? "question" : "questions"} · pass{" "}
                    {quiz.passingScore}%
                  </span>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditing(quiz);
                      setCreating(false);
                    }}
                  >
                    <Pencil className="size-4" aria-hidden="true" />
                    Edit
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
