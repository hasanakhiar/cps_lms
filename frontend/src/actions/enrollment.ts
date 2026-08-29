"use server";

import { revalidatePath } from "next/cache";
import { strapi, StrapiError } from "@/lib/strapi";
import { auth } from "@/auth";
import type { ActionResult } from "@/types";

/**
 * Enrol the signed-in student in a course.
 *
 * The action sends only the course id. It does not send who is enrolling — the backend
 * takes the student from `ctx.state.user`, so there is no field here that could be
 * tampered with to enrol somebody else. That is the pattern throughout: the client says
 * *what*, the server decides *who*.
 *
 * The backend is idempotent, returning the existing row rather than a 400 when the
 * student is already enrolled, so a double-click is a no-op rather than an error.
 */
export async function enrollAction(
  courseDocumentId: string,
  courseSlug: string
): Promise<ActionResult> {
  const session = await auth();

  // Fail before the network call. A signed-out visitor pressing Enrol should be told
  // to sign in, not shown whatever Strapi says about an anonymous request.
  if (!session?.user) {
    return { ok: false, message: "Sign in to enrol in this course" };
  }

  if (session.user.role !== "student") {
    // Mirrors the backend's `has-role: ['student']`. Staff enrolling would create
    // progress rows for a non-student and skew every enrolment statistic.
    return { ok: false, message: "Only students can enrol in courses" };
  }

  try {
    await strapi(`/api/courses/${courseDocumentId}/enroll`, { method: "POST", body: {} });
  } catch (error) {
    if (error instanceof StrapiError) {
      return { ok: false, message: error.message };
    }
    return { ok: false, message: "Could not enrol you in this course" };
  }

  // Both pages show enrolment state, so both are stale now.
  revalidatePath(`/courses/${courseSlug}`);
  revalidatePath("/my-courses");

  return { ok: true };
}
