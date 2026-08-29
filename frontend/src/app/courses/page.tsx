import { Suspense } from "react";
import { Search, BookOpen } from "lucide-react";
import type { Metadata } from "next";
import { listCourses } from "@/lib/api/courses";
import { CourseCard } from "@/components/course-card";
import { CourseGridSkeleton } from "@/components/course-grid-skeleton";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Courses",
  description: "Browse every course on the platform.",
};

/**
 * The loading state is a `<Suspense>` boundary here rather than a `loading.tsx`, and
 * that is a correctness decision rather than a stylistic one.
 *
 * A `loading.tsx` applies to its whole segment *including nested routes*, so putting
 * one at `app/courses/` also wraps `app/courses/[slug]`. That makes the detail route
 * stream, which commits the HTTP status before the component body runs — and a
 * `notFound()` thrown afterwards can then only swap the markup, not the status. The
 * observable symptom was `/blog/<draft-slug>` returning **200 with 404 content**,
 * which defeats the point of answering 404 for unpublished posts at all.
 *
 * Scoping the boundary to just the results grid keeps the skeleton on this page while
 * leaving the detail routes non-streaming, so their `notFound()` still sets a real 404.
 */
export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  return (
    <div className="container flex flex-col gap-8 py-10">
      <PageHeader
        title="Courses"
        description="Browse every course and enrol to start learning."
      />

      {/*
        A plain GET form, not a controlled input with a debounced fetch. The query
        lives in the URL, so a search is shareable, survives a refresh and works with
        the back button — and the page stays a Server Component with no client-side
        data fetching.
      */}
      <form method="GET" action="/courses" role="search" className="flex max-w-md gap-2">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search courses by title"
            aria-label="Search courses by title"
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      {/* `key` on the query so a new search shows the skeleton again rather than
          holding the previous results while the next set loads. */}
      <Suspense key={q ?? ""} fallback={<CourseGridSkeleton />}>
        <CourseResults query={q} />
      </Suspense>
    </div>
  );
}

async function CourseResults({ query }: { query?: string }) {
  const courses = await listCourses(query);

  if (courses.length === 0) {
    return query ? (
      <EmptyState
        icon={Search}
        title={`No courses match “${query}”`}
        description="Try a shorter or different search term."
        action={{ href: "/courses", label: "Clear search" }}
      />
    ) : (
      <EmptyState
        icon={BookOpen}
        title="No courses yet"
        description="Once an instructor publishes a course, it will appear here."
        action={{ href: "/", label: "Back to home" }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {courses.length} {courses.length === 1 ? "course" : "courses"}
        {query ? ` matching “${query}”` : ""}
      </p>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => (
          <CourseCard key={course.documentId} course={course} />
        ))}
      </div>
    </div>
  );
}
