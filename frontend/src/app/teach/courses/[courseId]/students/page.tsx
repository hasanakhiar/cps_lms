import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Users } from "lucide-react";
import { requireRole } from "@/lib/auth-guards";
import { getCourseForManagement, getCourseStudents } from "@/lib/api/teach";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Course students" };

export default async function CourseStudentsPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  await requireRole("admin", "content-manager", "instructor");

  const course = await getCourseForManagement(courseId);
  if (!course) notFound();

  /**
   * `null` means Strapi returned 403 — the caller does not own this course.
   *
   * The backend computes every student's percentage in one query over all the course's
   * completions, grouped in JS, rather than one query per student. On a course with a
   * hundred students that is the difference between 1 query and 101.
   */
  const students = await getCourseStudents(courseId);
  if (students === null) notFound();

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
        title="Students"
        description={`${course.title} — ${students.length} enrolled`}
      />

      {students.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nobody has enrolled yet"
          description="Once students enrol, their progress through this course appears here."
          action={{ href: `/courses/${course.slug}`, label: "View the course page" }}
        />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead className="hidden sm:table-cell">Email</TableHead>
                  <TableHead className="hidden md:table-cell">Enrolled</TableHead>
                  <TableHead className="w-[240px]">Progress</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {students.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">{student.username}</TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {student.email}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      <time dateTime={student.enrolledAt}>{formatDate(student.enrolledAt)}</time>
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-col gap-1.5">
                        <Progress
                          value={student.progress.percentage}
                          aria-label={`${student.username}: ${student.progress.percentage}% complete`}
                        />
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {student.progress.completed} of {student.progress.totalLessons} ·{" "}
                          {student.progress.percentage}%
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
