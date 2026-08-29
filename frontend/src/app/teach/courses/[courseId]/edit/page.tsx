import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth-guards";
import { getCourseForManagement } from "@/lib/api/teach";
import { PageHeader } from "@/components/page-header";
import { CourseForm } from "../../course-form";
import { updateCourseAction } from "@/actions/courses";

export const metadata: Metadata = { title: "Edit course" };

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  await requireRole("admin", "content-manager", "instructor");

  // `null` covers both "no such course" and the 403 an instructor gets for someone
  // else's course. Both render 404 — a distinct "forbidden" page here would confirm
  // the course exists, which is information the owner has not shared.
  const course = await getCourseForManagement(courseId);
  if (!course) notFound();

  return (
    <div className="container flex flex-col gap-8 py-10">
      <PageHeader title="Edit course" description={course.title} />
      <CourseForm
        action={updateCourseAction.bind(null, courseId)}
        course={course}
        submitLabel="Save changes"
      />
    </div>
  );
}
