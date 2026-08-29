"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { strapi, StrapiError } from "@/lib/strapi";
import { requireRole } from "@/lib/auth-guards";
import type { ActionResult } from "@/types";

const lessonSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(160),
  content: z.string().trim().max(50_000).optional().or(z.literal("")),
  videoUrl: z.string().trim().url("Video must be a valid URL").optional().or(z.literal("")),
  order: z.coerce.number().int().min(0, "Order must be zero or greater"),
});

function readLessonForm(formData: FormData) {
  return lessonSchema.safeParse({
    title: formData.get("title"),
    content: formData.get("content") ?? "",
    videoUrl: formData.get("videoUrl") ?? "",
    order: formData.get("order") ?? 0,
  });
}

/**
 * Create a lesson inside a course.
 *
 * `course` is sent in the body, and that is legitimate: on a create, the body is the
 * only thing that says which course the lesson belongs to. The backend policy
 * `can-manage-lesson` then verifies *against the database* that the caller owns that
 * course. The pattern is: trust the body to say what is being written, never to say who
 * is writing it.
 */
export async function createLessonAction(
  courseDocumentId: string,
  courseSlug: string,
  _prev: unknown,
  formData: FormData
): Promise<ActionResult> {
  await requireRole("admin", "content-manager", "instructor");

  const parsed = readLessonForm(formData);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  try {
    await strapi("/api/lessons", {
      method: "POST",
      body: { data: { ...parsed.data, course: courseDocumentId } },
    });

    revalidateLesson(courseDocumentId, courseSlug);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: toMessage(error, "Could not create the lesson") };
  }
}

export async function updateLessonAction(
  lessonDocumentId: string,
  courseDocumentId: string,
  courseSlug: string,
  _prev: unknown,
  formData: FormData
): Promise<ActionResult> {
  await requireRole("admin", "content-manager", "instructor");

  const parsed = readLessonForm(formData);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  try {
    // `course` is deliberately not sent on update. Moving a lesson between courses is
    // not a feature here, and omitting the field means the reassignment path in
    // `can-manage-lesson` is never exercised from this UI.
    await strapi(`/api/lessons/${lessonDocumentId}`, {
      method: "PUT",
      body: { data: parsed.data },
    });

    revalidateLesson(courseDocumentId, courseSlug);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: toMessage(error, "Could not update the lesson") };
  }
}

export async function deleteLessonAction(
  lessonDocumentId: string,
  courseDocumentId: string,
  courseSlug: string
): Promise<ActionResult> {
  await requireRole("admin", "content-manager", "instructor");

  try {
    // The backend's `afterDelete` lifecycle removes the orphaned completion rows, so
    // no student is left showing 4/3 lessons complete. Nothing to do here for that.
    await strapi(`/api/lessons/${lessonDocumentId}`, { method: "DELETE" });

    revalidateLesson(courseDocumentId, courseSlug);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: toMessage(error, "Could not delete the lesson") };
  }
}

/**
 * Reorder by writing a new `order` to one lesson at a time.
 *
 * Sequential rather than parallel on purpose: each write goes through
 * `can-manage-lesson`, which reads the lesson and its course, and firing a burst of
 * them concurrently multiplies that read load for no benefit on a list this size.
 * Stopping at the first failure also leaves a partially reordered list rather than an
 * unpredictable one — and the caller re-reads the true order afterwards either way.
 */
export async function reorderLessonsAction(
  orderedLessonIds: string[],
  courseDocumentId: string,
  courseSlug: string
): Promise<ActionResult> {
  await requireRole("admin", "content-manager", "instructor");

  try {
    for (const [index, lessonDocumentId] of orderedLessonIds.entries()) {
      await strapi(`/api/lessons/${lessonDocumentId}`, {
        method: "PUT",
        body: { data: { order: index + 1 } },
      });
    }

    revalidateLesson(courseDocumentId, courseSlug);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: toMessage(error, "Could not save the new order") };
  }
}

function revalidateLesson(courseDocumentId: string, courseSlug: string): void {
  revalidatePath(`/teach/courses/${courseDocumentId}/lessons`);
  revalidatePath(`/courses/${courseSlug}`);
  revalidatePath(`/learn/${courseSlug}`, "layout");
}

function toMessage(error: unknown, fallback: string): string {
  if (error instanceof StrapiError) {
    if (error.status === 403) {
      return "You can only manage lessons in courses you own";
    }
    return error.message || fallback;
  }
  return fallback;
}
