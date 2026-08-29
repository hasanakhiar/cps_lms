import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth-guards";
import { getCourseBySlug, getCourseProgress } from "@/lib/api/courses";

// This route always redirects, so the title is only ever seen in the fraction of a
// second before the redirect resolves — but a page without metadata inherits nothing
// useful, so it is set explicitly.
export const metadata: Metadata = { title: "Continue learning" };

/**
 * `/learn/[courseSlug]` — resolve where the student should actually be, then redirect.
 *
 * This route renders nothing. Its whole job is to answer "which lesson is next?" on the
 * server, so that every Continue button in the app can point at one stable URL instead
 * of each caller computing the answer and drifting out of step. Completing a lesson in
 * another tab changes the destination without any button needing to know.
 */
export default async function LearnRedirectPage({
  params,
}: {
  params: Promise<{ courseSlug: string }>;
}) {
  const { courseSlug } = await params;
  await requireRole("student");

  const course = await getCourseBySlug(courseSlug, { authenticated: true });
  if (!course) notFound();

  const lessons = [...(course.lessons ?? [])].sort((a, b) => a.order - b.order);
  if (lessons.length === 0) {
    // A course with no lessons has nowhere to send anyone. The course page explains
    // the situation; this route has no UI of its own to say it in.
    redirect(`/courses/${courseSlug}`);
  }

  const progress = await getCourseProgress(course.documentId);

  // Not enrolled: `getCourseProgress` returns null on the 403. Send them to the course
  // page, which is where the enrol button lives.
  if (!progress) {
    redirect(`/courses/${courseSlug}`);
  }

  const completed = new Set(progress.completedLessonIds);

  // The first lesson in `order` that is not yet done — or, when everything is done,
  // the first lesson, so "review course" lands somewhere sensible rather than nowhere.
  const next = lessons.find((lesson) => !completed.has(lesson.documentId)) ?? lessons[0];

  redirect(`/learn/${courseSlug}/${next.documentId}`);
}
