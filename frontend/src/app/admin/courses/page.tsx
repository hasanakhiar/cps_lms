import Link from "next/link";
import type { Metadata } from "next";
import { BookOpen, Plus } from "lucide-react";
import { requireRole } from "@/lib/auth-guards";
import { getTeachingCourses } from "@/lib/api/teach";
import { listCourses } from "@/lib/api/courses";
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
import { DeleteCourseButton } from "@/app/teach/courses/delete-course-button";

export const metadata: Metadata = { title: "All courses" };

/**
 * Every course on the platform, with its owner.
 *
 * The management links point at the **Phase 10 `/teach` screens**, deliberately reused
 * rather than rebuilt. `is-course-owner-or-manager` already admits an admin to any
 * course, so a second set of admin-only lesson and quiz editors would be the same code
 * guarded by the same policy — and two copies of an editor is two places for a bug.
 *
 * The brief asks that an admin can manage "all courses, lessons, and blog posts across
 * the platform". Reuse is what makes that true rather than approximately true.
 */
export default async function AdminCoursesPage() {
  await requireRole("admin");

  // `teaching` returns everything for an admin and carries the counts. The public
  // listing is read alongside it purely for `instructorName`, which `teaching` omits —
  // an instructor listing their own courses already knows who owns them.
  const [courses, publicCourses] = await Promise.all([getTeachingCourses(), listCourses()]);

  const ownerBySlug = new Map(
    publicCourses.map((course) => [course.slug, course.instructorName])
  );

  return (
    <div className="container flex flex-col gap-8 py-10">
      <PageHeader
        title="All courses"
        description="Every course regardless of owner. Editing uses the same screens instructors use — the ownership policy already lets an admin through."
      >
        {/* The create form is the shared `/teach` one, for the same reason the row
            links below are: one editor, one policy, one place for a bug. */}
        <Button render={<Link href="/teach/courses/new" />}>
          <Plus className="size-4" aria-hidden="true" />
          New course
        </Button>
      </PageHeader>

      {courses.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No courses on the platform"
          description="Once an instructor creates a course it will appear here."
          action={{ href: "/teach/courses/new", label: "Create a course" }}
        />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead className="hidden md:table-cell">Lessons</TableHead>
                  <TableHead className="hidden md:table-cell">Students</TableHead>
                  <TableHead className="text-right">Manage</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {courses.map((course) => (
                  <TableRow key={course.documentId}>
                    <TableCell className="font-medium">
                      <Link href={`/courses/${course.slug}`} className="hover:underline">
                        {course.title}
                      </Link>
                    </TableCell>

                    <TableCell className="text-muted-foreground">
                      {ownerBySlug.get(course.slug) ?? "—"}
                    </TableCell>

                    <TableCell className="hidden tabular-nums md:table-cell">
                      {course.lessonCount}
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
