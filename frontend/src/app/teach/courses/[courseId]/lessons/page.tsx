import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth-guards";
import { getCourseForManagement } from "@/lib/api/teach";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { LessonManager } from "./lesson-manager";
import type { LessonDetail } from "@/types";

export const metadata: Metadata = { title: "Manage lessons" };

export default async function ManageLessonsPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  await requireRole("admin", "content-manager", "instructor");

  const course = await getCourseForManagement(courseId);
  if (!course) notFound();

  // Staff queries are not rewritten by the course controller, so the populated lessons
  // carry `content` and `videoUrl` — which the editor needs and a student's copy of the
  // same endpoint never includes.
  const lessons = ((course.lessons ?? []) as LessonDetail[])
    .slice()
    .sort((a, b) => a.order - b.order);

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
        title="Lessons"
        description={`${course.title} — reorder with the arrows; the new positions are written to each lesson's order field.`}
      />

      <LessonManager
        courseDocumentId={courseId}
        courseSlug={course.slug}
        lessons={lessons}
      />
    </div>
  );
}
