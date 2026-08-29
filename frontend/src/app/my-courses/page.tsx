import Link from "next/link";
import type { Metadata } from "next";
import { GraduationCap } from "lucide-react";
import { requireRole } from "@/lib/auth-guards";
import { getMyEnrollments } from "@/lib/api/learning";
import { CourseCard } from "@/components/course-card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "My Courses",
  description: "Courses you are enrolled in, with your progress.",
};

export default async function MyCoursesPage() {
  // Layer 2. Middleware already redirected non-students, but this page must not depend
  // on that: middleware can be skipped, and a page that assumes it ran is a page that
  // renders a stranger's shell before Strapi refuses the data.
  await requireRole("student");

  const enrollments = await getMyEnrollments();

  return (
    <div className="container flex flex-col gap-8 py-10">
      <PageHeader
        title="My Courses"
        description="Pick up where you left off."
      />

      {enrollments.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="You have not enrolled in anything yet"
          description="Browse the catalogue and enrol in a course to start tracking progress."
          action={{ href: "/courses", label: "Browse courses" }}
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {enrollments.map(({ enrollmentId, course, progress }) => (
            <div key={enrollmentId} className="flex flex-col gap-3">
              <CourseCard
                course={{
                  documentId: course.id,
                  title: course.title,
                  slug: course.slug,
                  description: course.description,
                  coverImageUrl: course.coverImageUrl,
                  instructorName: null,
                }}
                progress={progress}
                href={`/learn/${course.slug}`}
              />

              {/*
                `/learn/:slug` resolves the first incomplete lesson server-side and
                redirects there, so this button does not need to work out which lesson
                is next — and cannot get it wrong if the student completes one in
                another tab.
              */}
              <Button variant="secondary" render={<Link href={`/learn/${course.slug}`} />}>
                {progress.percentage === 100 ? "Review course" : "Continue learning"}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
