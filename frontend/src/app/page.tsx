import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { auth } from "@/auth";
import { listCourses } from "@/lib/api/courses";
import { CourseCard } from "@/components/course-card";
import { CourseGridSkeleton } from "@/components/course-grid-skeleton";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StudentHome } from "./student-home";

export const metadata: Metadata = {
  title: { absolute: "CPS Learning — Learn Smarter & Faster" },
  description:
    "Structured online courses with lessons, quizzes and progress tracking. Learn at your own pace and track every step.",
};

export default async function HomePage() {
  const session = await auth();
  const isStudent = session?.user?.role === "student";

  return (
    <div className="flex flex-col">
      <section className="container flex flex-col items-center gap-6 py-20 text-center md:py-28">
        <h1 className="max-w-4xl text-4xl font-bold tracking-tight text-balance md:text-6xl">
          Learn Smarter &amp; <span className="text-indigo-600 dark:text-indigo-400">Faster</span>, be quick and ready
          with Online Courses
        </h1>

        <p className="max-w-2xl text-lg text-muted-foreground text-pretty">
          Work through structured lessons at your own pace, test yourself with quizzes that mark
          themselves, and watch your progress build with every step.
        </p>

        <div className="flex flex-wrap justify-center gap-3">
          <Button size="lg" render={<Link href={session ? "/courses" : "/register"} />}>
            Get started
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
          <Button size="lg" variant="outline" render={<Link href="/courses" />}>
            Browse courses
          </Button>
        </div>
      </section>

      {isStudent ? (
        <div className="container pb-16">
          <Suspense fallback={<StudentHomeSkeleton />}>
            <StudentHome name={session?.user?.name} />
          </Suspense>
        </div>
      ) : null}

      <section className="container flex flex-col gap-8 pb-24">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-3xl font-semibold tracking-tight">Explore our courses</h2>
            <p className="text-muted-foreground">
              Start with the fundamentals or go deep — every course is broken into ordered
              lessons.
            </p>
          </div>

          <Button variant="outline" render={<Link href="/courses" />}>
            View all
          </Button>
        </div>

        <Suspense fallback={<CourseGridSkeleton />}>
          <FeaturedCourses />
        </Suspense>
      </section>
    </div>
  );
}

/**
 * The six most recent courses.
 *
 * An unauthenticated read, so the response is cacheable and shared between visitors —
 * the landing page is identical for everyone who is not signed in.
 */
async function FeaturedCourses() {
  const courses = (await listCourses()).slice(0, 6);

  if (courses.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No courses have been published yet. Check back soon.
      </p>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {courses.map((course) => (
        <CourseCard key={course.documentId} course={course} />
      ))}
    </div>
  );
}

function StudentHomeSkeleton() {
  return (
    <section className="flex flex-col gap-4">
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-56 w-full rounded-xl lg:col-span-2" />
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
    </section>
  );
}
