import Link from "next/link";
import type { Metadata } from "next";
import { BookOpen, Plus } from "lucide-react";
import { requireRole } from "@/lib/auth-guards";
import { getTeachingCourses } from "@/lib/api/teach";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteCourseButton } from "./delete-course-button";

export const metadata: Metadata = {
  title: "Manage courses",
};

/**
 * The course management table.
 *
 * Every course listed here is one the caller may edit, because
 * `GET /api/courses/teaching` returns an instructor's own courses and a manager's
 * everything. So there are no disabled rows and no hidden buttons — an instructor
 * simply never sees another instructor's course on this screen.
 *
 * That is presentation, not enforcement. Forging `PUT /api/courses/:id` against a
 * course they do not own still returns 403, from `is-course-owner-or-manager`, and that
 * is the half that actually protects anything.
 */
export default async function ManageCoursesPage() {
  const session = await requireRole("admin", "content-manager", "instructor");
  const isInstructor = session.user.role === "instructor";

  const courses = await getTeachingCourses();

  return (
    <div className="container flex flex-col gap-8 py-10">
      <PageHeader
        title="Courses"
        description={
          isInstructor
            ? "Courses you own."
            : "Every course on the platform."
        }
      >
        {/* Instructors own courses; they do not add them to the catalogue. */}
        {isInstructor ? null : (
          <Button render={<Link href="/teach/courses/new" />}>
            <Plus className="size-4" aria-hidden="true" />
            New course
          </Button>
        )}
      </PageHeader>

      {courses.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No courses to manage"
          description={
            isInstructor
              ? "Courses are created by an admin or content manager. Any course you own appears here."
              : "Create a course to start adding lessons and quizzes."
          }
          action={
            isInstructor
              ? undefined
              : { href: "/teach/courses/new", label: "Create a course" }
          }
        />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead className="hidden sm:table-cell">Lessons</TableHead>
                  <TableHead className="hidden sm:table-cell">Quizzes</TableHead>
                  <TableHead className="hidden md:table-cell">Students</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {courses.map((course) => (
                  <TableRow key={course.documentId}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/teach/courses/${course.documentId}`}
                        className="hover:underline"
                      >
                        {course.title}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden tabular-nums sm:table-cell">
                      {course.lessonCount}
                    </TableCell>
                    <TableCell className="hidden tabular-nums sm:table-cell">
                      {course.quizCount}
                    </TableCell>
                    <TableCell className="hidden tabular-nums md:table-cell">
                      {course.studentCount}
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          render={<Link href={`/teach/courses/${course.documentId}/lessons`} />}
                        >
                          Lessons
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          render={<Link href={`/teach/courses/${course.documentId}/quizzes`} />}
                        >
                          Quizzes
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          render={<Link href={`/teach/courses/${course.documentId}/students`} />}
                        >
                          Students
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          render={<Link href={`/teach/courses/${course.documentId}/edit`} />}
                        >
                          Edit
                        </Button>
                        <DeleteCourseButton
                          courseDocumentId={course.documentId}
                          title={course.title}
                          lessonCount={course.lessonCount}
                          quizCount={course.quizCount}
                          studentCount={course.studentCount}
                        />
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
