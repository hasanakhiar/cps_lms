import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BookOpen, ClipboardList, Lock, User } from "lucide-react";
import { auth } from "@/auth";
import { getCourseBySlug, getCourseProgress } from "@/lib/api/courses";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EnrollButton } from "./enroll-button";
import { STAFF_ROLES } from "@/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const course = await getCourseBySlug(slug);

  if (!course) return { title: "Course not found" };

  return {
    title: course.title,
    description: course.description ?? undefined,
  };
}

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  const role = session?.user?.role;

  // Staff get the authenticated read so the syllabus reflects what they can manage.
  const course = await getCourseBySlug(slug, { authenticated: Boolean(session) });
  if (!course) notFound();

  const isStudent = role === "student";
  const isStaff = role ? STAFF_ROLES.includes(role) : false;

  // Only a student can have progress; asking as anyone else would be a guaranteed 403.
  const progress = isStudent ? await getCourseProgress(course.documentId) : null;
  const isEnrolled = progress !== null;

  const lessons = [...(course.lessons ?? [])].sort((a, b) => a.order - b.order);
  const quizzes = course.quizzes ?? [];

  return (
    <div className="container flex flex-col gap-8 py-10">
      <PageHeader title={course.title} description={course.description ?? undefined}>
        {course.instructorName ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <User className="size-4" aria-hidden="true" />
            {course.instructorName}
          </span>
        ) : null}
      </PageHeader>

      {/*
        The call to action depends entirely on who is looking. Four distinct cases,
        because "Enrol" would be wrong — or a guaranteed 403 — for three of them.
      */}
      <div className="flex flex-col gap-4">
        {!session ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" render={<Link href={`/login?next=/courses/${slug}`} />}>
              Sign in to enrol
            </Button>
            <p className="text-sm text-muted-foreground">
              New here? <Link href="/register" className="underline">Create an account</Link>
            </p>
          </div>
        ) : isStudent && isEnrolled ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your progress</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Progress
                value={progress.percentage}
                aria-label={`${progress.percentage}% complete`}
              />
              <p className="text-sm text-muted-foreground">
                {progress.completed} of {progress.totalLessons} lessons · {progress.percentage}%
              </p>
              <Button className="self-start" render={<Link href={`/learn/${slug}`} />}>
                Continue learning
              </Button>
            </CardContent>
          </Card>
        ) : isStudent ? (
          <EnrollButton courseDocumentId={course.documentId} courseSlug={slug} />
        ) : (
          <Alert>
            <AlertTitle>Enrolment is for students</AlertTitle>
            <AlertDescription>
              Staff accounts manage content rather than take courses, so enrolment is not
              available on this account.
            </AlertDescription>
          </Alert>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="size-4" aria-hidden="true" />
                Syllabus
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lessons.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No lessons have been added to this course yet.
                </p>
              ) : (
                <ol className="flex flex-col divide-y">
                  {lessons.map((lesson, index) => (
                    <li
                      key={lesson.documentId}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="w-6 shrink-0 text-sm text-muted-foreground tabular-nums">
                          {index + 1}.
                        </span>
                        <span className="truncate text-sm">{lesson.title}</span>
                      </span>

                      {isEnrolled || isStaff ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          render={<Link href={`/learn/${slug}/${lesson.documentId}`} />}
                        >
                          Open
                        </Button>
                      ) : (
                        // Titles are public; bodies are not. The lock says why rather
                        // than the row simply doing nothing when clicked.
                        <Lock
                          className="size-4 shrink-0 text-muted-foreground"
                          aria-label="Enrol to read this lesson"
                        />
                      )}
                    </li>
                  ))}
                </ol>
              )}

              {!isEnrolled && !isStaff && lessons.length > 0 ? (
                <p className="mt-4 text-xs text-muted-foreground">
                  Enrol to unlock the full lesson content.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardList className="size-4" aria-hidden="true" />
                Quizzes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {quizzes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No quizzes in this course yet.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {quizzes.map((quiz) => (
                    <li key={quiz.documentId} className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm">{quiz.title}</span>
                      {isEnrolled ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          render={<Link href={`/learn/${slug}/quiz/${quiz.documentId}`} />}
                        >
                          Take
                        </Button>
                      ) : (
                        <Badge variant="secondary">Enrol first</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
