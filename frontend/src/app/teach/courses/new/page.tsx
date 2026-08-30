import type { Metadata } from "next";
import { requireRole } from "@/lib/auth-guards";
import { PageHeader } from "@/components/page-header";
import { CourseForm } from "../course-form";
import { createCourseAction } from "@/actions/courses";

export const metadata: Metadata = { title: "New course" };

export default async function NewCoursePage() {
  // Instructors are refused here, by the middleware before this renders and by the
  // Strapi route policy if they get past both.
  await requireRole("admin", "content-manager");

  return (
    <div className="container flex flex-col gap-8 py-10">
      <PageHeader
        title="New course"
        description="You will be set as the owner automatically — the server takes it from your session."
      />
      <CourseForm action={createCourseAction} submitLabel="Create course" />
    </div>
  );
}
