import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth-guards";
import { getCourseForManagement } from "@/lib/api/teach";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { QuizList } from "./quiz-list";
import type { DraftQuiz } from "./quiz-builder";

export const metadata: Metadata = { title: "Manage quizzes" };

/**
 * The quiz builder's data source.
 *
 * This is the one screen in the app that legitimately receives `isCorrect`: the caller
 * is staff, so the quiz controller returns the answer key rather than stripping it.
 * The exact same endpoint hands a student the identical quiz with every `isCorrect`
 * removed — the difference is decided server-side from the session, not by which page
 * is asking.
 */
export default async function ManageQuizzesPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  await requireRole("admin", "content-manager", "instructor");

  const course = await getCourseForManagement(courseId);
  if (!course) notFound();

  // The populated shape carries `isCorrect` on options for staff; `QuizSummary` does
  // not describe that, so the builder's own draft type is the accurate one here.
  const quizzes = (course.quizzes ?? []) as unknown as DraftQuiz[];

  const drafts: DraftQuiz[] = quizzes.map((quiz) => ({
    documentId: quiz.documentId,
    title: quiz.title,
    passingScore: quiz.passingScore ?? 60,
    questions: (quiz.questions ?? []).map((question) => ({
      prompt: question.prompt ?? "",
      options: (question.options ?? []).map((option) => ({
        label: option.label ?? "",
        isCorrect: Boolean(option.isCorrect),
      })),
    })),
  }));

  return (
    <div className="container flex flex-col gap-8 py-10">
      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        render={<Link href="/teach/courses" />}
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        All courses
      </Button>

      <PageHeader
        title="Quizzes"
        description={`${course.title} — every question needs at least two options and exactly one correct answer.`}
      />

      <QuizList courseDocumentId={courseId} courseSlug={course.slug} quizzes={drafts} />
    </div>
  );
}
