import Link from "next/link";
import { ArrowRight, ClipboardList, Sparkles } from "lucide-react";
import { getStudentHome } from "@/lib/api/home";
import { StrapiError } from "@/lib/strapi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatDate } from "@/lib/utils";

/**
 * The signed-in student's view of the home page: what to carry on with, what is
 * outstanding, and what has appeared since they enrolled.
 *
 * Everything rendered here is derived from real rows. There is no streak, level or
 * leaderboard, because none of those exist in the schema — and a leaderboard would
 * directly contradict the access model, which stops one student seeing another's data.
 */
export async function StudentHome({ name }: { name: string | null | undefined }) {
  /**
   * A session cookie can outlive the token inside it — the database is reseeded, the
   * user is deleted, or the JWT secret rotates. The cookie still decrypts, so the app
   * believes someone is signed in, but every backend call answers 401.
   *
   * Rendering nothing is the right response on the home page: the visitor gets the
   * public page, which is fully usable, instead of an error boundary telling them
   * something went wrong when the fix is simply to sign in again. Any other failure is
   * re-thrown so it still reaches the error boundary.
   */
  let home;
  try {
    home = await getStudentHome();
  } catch (error) {
    if (error instanceof StrapiError && (error.status === 401 || error.status === 403)) {
      return null;
    }
    throw error;
  }

  if (home.enrolledCount === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-4 py-10">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-semibold tracking-tight">
              Welcome{name ? `, ${name}` : ""}
            </h2>
            <p className="text-muted-foreground">
              You have not enrolled in anything yet. Pick a course and your progress will
              start tracking straight away.
            </p>
          </div>
          <Button render={<Link href="/courses" />}>Browse courses</Button>
        </CardContent>
      </Card>
    );
  }

  const { continueLearning, pendingQuizzes, newLessons } = home;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-2xl font-semibold tracking-tight">
          Welcome back{name ? `, ${name}` : ""}
        </h2>
        <p className="text-sm text-muted-foreground">
          {home.lessonsCompleted} lessons completed · {home.quizzesPassed} quizzes passed ·{" "}
          {home.enrolledCount} {home.enrolledCount === 1 ? "course" : "courses"}
        </p>
      </div>

      {/* Bento: the course in progress gets the large tile because it is the one action
          most likely to be wanted; the two lists sit beside it. */}
      <div className="grid gap-4 lg:grid-cols-3">
        {continueLearning ? (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Continue learning
              </CardTitle>
            </CardHeader>

            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <p className="text-2xl font-semibold tracking-tight text-balance">
                  {continueLearning.courseTitle}
                </p>
                {continueLearning.nextLessonTitle ? (
                  <p className="text-sm text-muted-foreground">
                    Up next: {continueLearning.nextLessonTitle}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Every lesson is complete — revisit any of them any time.
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Progress
                  value={continueLearning.percentage}
                  aria-label={`${continueLearning.percentage}% complete`}
                />
                <p className="text-xs text-muted-foreground tabular-nums">
                  {continueLearning.completed} of {continueLearning.totalLessons} lessons ·{" "}
                  {continueLearning.percentage}%
                </p>
              </div>

              <Button
                className="self-start"
                render={<Link href={`/learn/${continueLearning.courseSlug}`} />}
              >
                Continue
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="lg:col-span-2">
            <CardContent className="flex flex-col items-start gap-3 py-8">
              <p className="text-lg font-medium">Everything is finished</p>
              <p className="text-sm text-muted-foreground">
                You have completed every course you are enrolled in.
              </p>
              <Button variant="outline" render={<Link href="/courses" />}>
                Find another course
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <ClipboardList className="size-4" aria-hidden="true" />
              Quizzes to take
            </CardTitle>
          </CardHeader>

          <CardContent>
            {pendingQuizzes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing outstanding — every quiz in your courses is passed.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {pendingQuizzes.slice(0, 4).map((quiz) => (
                  <li key={quiz.quizDocumentId} className="flex flex-col gap-1">
                    <Link
                      href={`/learn/${quiz.courseSlug}/quiz/${quiz.quizDocumentId}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {quiz.title}
                    </Link>

                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-xs text-muted-foreground">
                        {quiz.courseTitle}
                      </span>

                      {quiz.status === "not-attempted" ? (
                        <Badge variant="secondary">Not attempted</Badge>
                      ) : (
                        <Badge variant="destructive">
                          Best {quiz.bestPercentage}%
                          {quiz.passingScore !== null ? ` · need ${quiz.passingScore}%` : ""}
                        </Badge>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/*
        Only rendered when there is something to say. An always-present card reading
        "no new lessons" is noise on every visit for the majority of sessions.
      */}
      {newLessons.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Sparkles className="size-4" aria-hidden="true" />
              Added since you enrolled
            </CardTitle>
          </CardHeader>

          <CardContent>
            <ul className="flex flex-col divide-y">
              {newLessons.slice(0, 5).map((lesson) => (
                <li
                  key={lesson.documentId}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <Link
                    href={`/learn/${lesson.courseSlug}/${lesson.documentId}`}
                    className="text-sm font-medium hover:underline"
                  >
                    {lesson.title}
                  </Link>

                  <span className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="truncate">{lesson.courseTitle}</span>
                    <time dateTime={lesson.addedAt}>{formatDate(lesson.addedAt)}</time>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
