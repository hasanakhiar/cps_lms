import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth-guards";
import { getCourseBySlug, getCourseProgress } from "@/lib/api/courses";
import { getQuiz } from "@/lib/api/learning";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { QuizForm } from "./quiz-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ quizId: string }>;
}): Promise<Metadata> {
  const { quizId } = await params;
  const quiz = await getQuiz(quizId);
  return { title: quiz?.title ?? "Quiz" };
}

export default async function QuizPage({
  params,
}: {
  params: Promise<{ courseSlug: string; quizId: string }>;
}) {
  const { courseSlug, quizId } = await params;
  await requireRole("student");

  const course = await getCourseBySlug(courseSlug, { authenticated: true });
  if (!course) notFound();

  // Enrolment is required to *submit*, enforced by `is-enrolled` on the backend. It is
  // checked here too so a non-enrolled student gets the enrol page rather than a form
  // that would 403 on submit.
  const progress = await getCourseProgress(course.documentId);
  if (!progress) redirect(`/courses/${courseSlug}`);

  const quiz = await getQuiz(quizId);
  if (!quiz) notFound();

  return (
    <div className="container flex max-w-3xl flex-col gap-8 py-10">
      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        render={<Link href={`/learn/${courseSlug}`} />}
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {course.title}
      </Button>

      <PageHeader
        title={quiz.title}
        description={`${quiz.questions?.length ?? 0} questions · pass mark ${quiz.passingScore}%`}
      />

      {(quiz.questions?.length ?? 0) === 0 ? (
        <EmptyState
          title="This quiz has no questions yet"
          description="The instructor has not finished building it. Check back later."
          action={{ href: `/learn/${courseSlug}`, label: "Back to lessons" }}
        />
      ) : (
        <QuizForm quiz={quiz} courseSlug={courseSlug} />
      )}
    </div>
  );
}
