"use server";

import { revalidatePath } from "next/cache";
import { strapi, StrapiError } from "@/lib/strapi";
import { auth } from "@/auth";
import type { ActionResult, CourseProgress, StrapiResponse } from "@/types";

/**
 * Mark a lesson complete, or un-complete it.
 *
 * The client sends a lesson id and nothing else. It does not send who completed it,
 * which course it belongs to, or what the new percentage should be — all three are
 * derived server-side. The percentage in particular is never sent by the client and
 * never stored: it is recomputed from live counts on every read, so it cannot drift and
 * self-corrects when an instructor adds or deletes a lesson.
 *
 * Both directions are idempotent on the backend. Completing twice creates one row;
 * un-completing something already absent is a success, not a 404. That is what makes a
 * double-click harmless and why progress cannot exceed 100%.
 */
async function toggleCompletion(
  lessonDocumentId: string,
  courseSlug: string,
  method: "POST" | "DELETE"
): Promise<ActionResult<CourseProgress>> {
  const session = await auth();

  if (!session?.user) {
    return { ok: false, message: "Sign in to track your progress" };
  }

  if (session.user.role !== "student") {
    return { ok: false, message: "Only students have progress to track" };
  }

  try {
    // The backend returns freshly recomputed progress with the write, so the UI never
    // has to guess or issue a second request to find out where it now stands.
    const response = await strapi<
      StrapiResponse<{ progress: CourseProgress }> | StrapiResponse<CourseProgress>
    >(`/api/lessons/${lessonDocumentId}/complete`, {
      method,
      body: method === "POST" ? {} : undefined,
    });

    const payload = response.data as { progress?: CourseProgress } & CourseProgress;
    const progress = payload.progress ?? payload;

    // The player, the course page and the enrolment list all show progress.
    revalidatePath(`/learn/${courseSlug}`, "layout");
    revalidatePath(`/courses/${courseSlug}`);
    revalidatePath("/my-courses");

    return { ok: true, data: progress };
  } catch (error) {
    if (error instanceof StrapiError) {
      return { ok: false, message: error.message };
    }
    return { ok: false, message: "Could not update your progress" };
  }
}

export async function completeLessonAction(
  lessonDocumentId: string,
  courseSlug: string
): Promise<ActionResult<CourseProgress>> {
  return toggleCompletion(lessonDocumentId, courseSlug, "POST");
}

export async function uncompleteLessonAction(
  lessonDocumentId: string,
  courseSlug: string
): Promise<ActionResult<CourseProgress>> {
  return toggleCompletion(lessonDocumentId, courseSlug, "DELETE");
}
