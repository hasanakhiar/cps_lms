import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, Check, ClipboardList, ExternalLink } from "lucide-react";
import { requireRole } from "@/lib/auth-guards";
import { getCourseBySlug, getCourseProgress } from "@/lib/api/courses";
import { getLesson } from "@/lib/api/learning";
import { toEmbeddedVideo } from "@/lib/video";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CompleteButton } from "./complete-button";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ courseSlug: string; lessonId: string }>;
}): Promise<Metadata> {
  const { lessonId } = await params;
  const lesson = await getLesson(lessonId);
  return { title: lesson?.title ?? "Lesson" };
}

export default async function LessonPlayerPage({
  params,
}: {
  params: Promise<{ courseSlug: string; lessonId: string }>;
}) {
  const { courseSlug, lessonId } = await params;
  await requireRole("student");

  const course = await getCourseBySlug(courseSlug, { authenticated: true });
  if (!course) notFound();

  const progress = await getCourseProgress(course.documentId);
  if (!progress) redirect(`/courses/${courseSlug}`);

  /**
   * The lesson body comes from a separate, enrolment-gated request.
   *
   * `null` here means Strapi refused it — the student is not enrolled, or the lesson
   * does not exist. Both render 404: a 403 page would confirm the lesson is real,
   * which the course page already does for titles but which should not extend to
   * proving the *body* exists at a given address.
   */
  const lesson = await getLesson(lessonId);
  if (!lesson) notFound();

  const lessons = [...(course.lessons ?? [])].sort((a, b) => a.order - b.order);
  const completed = new Set(progress.completedLessonIds);
  const isComplete = completed.has(lessonId);

  const index = lessons.findIndex((item) => item.documentId === lessonId);
  const previous = index > 0 ? lessons[index - 1] : null;
  const next = index >= 0 && index < lessons.length - 1 ? lessons[index + 1] : null;

  const video = toEmbeddedVideo(lesson.videoUrl);
  const quizzes = course.quizzes ?? [];

  return (
    <div className="container grid gap-8 py-10 lg:grid-cols-[280px_1fr]">
      {/* Sidebar: the syllabus, with the current lesson highlighted and ticks on
          whatever is done. On mobile it stacks above the body rather than collapsing
          into a drawer — at this length it is a short list, not a nav tree. */}
      <aside className="flex flex-col gap-4">
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          render={<Link href={`/courses/${courseSlug}`} />}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {course.title}
        </Button>

        <nav aria-label="Lessons">
          <ol className="flex flex-col gap-1">
            {lessons.map((item, position) => {
              const done = completed.has(item.documentId);
              const current = item.documentId === lessonId;

              return (
                <li key={item.documentId}>
                  <Link
                    href={`/learn/${courseSlug}/${item.documentId}`}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "flex items-start gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                      current ? "bg-muted font-medium" : "hover:bg-muted/60"
                    )}
                  >
                    <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
                      {done ? (
                        <Check className="size-4 text-primary" aria-label="Completed" />
                      ) : (
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {position + 1}
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">{item.title}</span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </nav>

        {quizzes.length > 0 ? (
          <div className="flex flex-col gap-2">
            <h2 className="flex items-center gap-2 px-3 text-sm font-medium">
              <ClipboardList className="size-4" aria-hidden="true" />
              Quizzes
            </h2>
            {quizzes.map((quiz) => (
              <Button
                key={quiz.documentId}
                variant="ghost"
                size="sm"
                className="justify-start"
                render={<Link href={`/learn/${courseSlug}/quiz/${quiz.documentId}`} />}
              >
                {quiz.title}
              </Button>
            ))}
          </div>
        ) : null}
      </aside>

      <div className="flex min-w-0 flex-col gap-6">
        <h1 className="text-3xl font-bold tracking-tight text-balance">{lesson.title}</h1>

        {video ? (
          <div className="aspect-video w-full overflow-hidden rounded-lg bg-muted">
            <iframe
              src={video.embedUrl}
              title={lesson.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="size-full"
            />
          </div>
        ) : lesson.videoUrl ? (
          // A URL we will not embed. Rendering it as a link is honest about the limit
          // rather than silently dropping the instructor's video.
          <Button variant="outline" className="self-start" render={<a href={lesson.videoUrl} target="_blank" rel="noopener noreferrer" />}>
            <ExternalLink className="size-4" aria-hidden="true" />
            Open video in a new tab
          </Button>
        ) : null}

        <Card>
          <CardContent>
            <Markdown content={lesson.content} />
          </CardContent>
        </Card>

        <CompleteButton
          lessonDocumentId={lessonId}
          courseSlug={courseSlug}
          isComplete={isComplete}
          progress={progress}
        />

        <nav aria-label="Lesson navigation" className="flex items-center justify-between gap-3">
          {previous ? (
            <Button
              variant="outline"
              render={<Link href={`/learn/${courseSlug}/${previous.documentId}`} />}
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Previous
            </Button>
          ) : (
            <span />
          )}

          {next ? (
            <Button render={<Link href={`/learn/${courseSlug}/${next.documentId}`} />}>
              Next
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          ) : (
            <Button variant="secondary" render={<Link href={`/courses/${courseSlug}`} />}>
              Finish course
            </Button>
          )}
        </nav>
      </div>
    </div>
  );
}
