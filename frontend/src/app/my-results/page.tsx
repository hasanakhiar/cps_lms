import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { requireRole } from "@/lib/auth-guards";
import { getMyAttempts } from "@/lib/api/learning";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { QuizBreakdown } from "@/components/quiz-breakdown";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import type { QuizAttempt } from "@/types";

export const metadata: Metadata = {
  title: "My Results",
  description: "Every quiz attempt you have submitted.",
};

/**
 * Group attempts by course, preserving the newest-first order the API returned.
 *
 * A `Map` rather than a plain object because insertion order is guaranteed for both,
 * but a Map cannot collide with inherited keys — a course legitimately titled
 * "constructor" would be a strange bug to debug.
 */
function groupByCourse(attempts: QuizAttempt[]): Map<string, QuizAttempt[]> {
  const groups = new Map<string, QuizAttempt[]>();

  for (const attempt of attempts) {
    const courseTitle = attempt.quiz?.course?.title ?? "Other";
    const existing = groups.get(courseTitle);
    if (existing) {
      existing.push(attempt);
    } else {
      groups.set(courseTitle, [attempt]);
    }
  }

  return groups;
}

export default async function MyResultsPage() {
  await requireRole("student");

  // Newest first, from the server. Attempts are append-only, so a retake adds a row
  // rather than overwriting — every attempt stays viewable, which is what the brief
  // asks for.
  const attempts = await getMyAttempts();
  const grouped = groupByCourse(attempts);

  return (
    <div className="container flex max-w-4xl flex-col gap-8 py-10">
      <PageHeader
        title="My Results"
        description="Every attempt you have submitted, newest first."
      />

      {attempts.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No quiz attempts yet"
          description="Take a quiz from one of your courses and your results will appear here."
          action={{ href: "/my-courses", label: "Go to my courses" }}
        />
      ) : (
        <div className="flex flex-col gap-10">
          {[...grouped.entries()].map(([courseTitle, courseAttempts]) => (
            <section key={courseTitle} className="flex flex-col gap-4">
              <h2 className="text-xl font-semibold tracking-tight">{courseTitle}</h2>

              {courseAttempts.map((attempt) => (
                <Card key={attempt.attemptId}>
                  <CardHeader>
                    <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-base">
                      <span>{attempt.quiz?.title ?? "Quiz"}</span>
                      <span className="flex items-center gap-2">
                        <Badge variant={attempt.passed ? "default" : "destructive"}>
                          {attempt.passed ? "Passed" : "Not passed"}
                        </Badge>
                        <span className="text-sm font-normal tabular-nums">
                          {attempt.score}/{attempt.total} · {attempt.percentage}%
                        </span>
                      </span>
                    </CardTitle>

                    {attempt.submittedAt ? (
                      <p className="text-xs text-muted-foreground">
                        <time dateTime={attempt.submittedAt}>
                          {formatDate(attempt.submittedAt)}
                        </time>
                        {attempt.quiz?.passingScore !== null &&
                        attempt.quiz?.passingScore !== undefined
                          ? ` · pass mark ${attempt.quiz.passingScore}%`
                          : null}
                      </p>
                    ) : null}
                  </CardHeader>

                  <CardContent>
                    {/*
                      Reopenable inline via <details> rather than a separate route.
                      The breakdown is already in this response — a per-attempt page
                      would be a second fetch of data we are holding, for no gain.
                    */}
                    <details className="group">
                      <summary className="cursor-pointer text-sm font-medium text-primary underline-offset-4 hover:underline">
                        Review answers
                      </summary>
                      <div className="pt-4">
                        <QuizBreakdown breakdown={attempt.breakdown} />
                      </div>
                    </details>
                  </CardContent>
                </Card>
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
