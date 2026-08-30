"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { strapi, StrapiError } from "@/lib/strapi";
import { requireRole } from "@/lib/auth-guards";
import type { ActionResult, CourseSummary, StrapiResponse } from "@/types";

/**
 * Course create / update / delete.
 *
 * Note the absence of an `instructor` field in the schema below, and that no form in
 * this app renders one. Ownership is set by the backend from `ctx.state.user.id` on
 * create and stripped from the body on update, so there is nothing here to send and
 * nothing a crafted request could achieve. The form does not omit the field as a
 * courtesy — the field does not exist as far as this layer is concerned.
 */
const courseSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(120),
  slug: z
    .string()
    .trim()
    .min(3, "Slug must be at least 3 characters")
    .max(120)
    .regex(/^[a-z0-9-]+$/, "Slug may contain only lowercase letters, numbers and hyphens"),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  coverImageUrl: z
    .string()
    .trim()
    .url("Cover image must be a valid URL")
    .optional()
    .or(z.literal("")),
});

function readCourseForm(formData: FormData) {
  return courseSchema.safeParse({
    title: formData.get("title"),
    slug: formData.get("slug"),
    description: formData.get("description") ?? "",
    coverImageUrl: formData.get("coverImageUrl") ?? "",
  });
}

/**
 * Creation is narrower than editing on purpose: an instructor may change every field
 * of a course they own, but the course is added to the catalogue by an admin or a
 * content manager. `update` and `delete` below keep the wider role list for exactly
 * that reason — the same asymmetry the Strapi route policies encode.
 */
export async function createCourseAction(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<{ slug: string }>> {
  await requireRole("admin", "content-manager");

  const parsed = readCourseForm(formData);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  try {
    const response = await strapi<StrapiResponse<CourseSummary>>("/api/courses", {
      method: "POST",
      body: { data: parsed.data },
    });

    revalidatePath("/teach/courses");
    revalidatePath("/courses");

    return { ok: true, data: { slug: response.data.slug } };
  } catch (error) {
    return { ok: false, message: toMessage(error, "Could not create the course") };
  }
}

export async function updateCourseAction(
  courseDocumentId: string,
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<{ slug: string }>> {
  await requireRole("admin", "content-manager", "instructor");

  const parsed = readCourseForm(formData);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  try {
    const response = await strapi<StrapiResponse<CourseSummary>>(
      `/api/courses/${courseDocumentId}`,
      { method: "PUT", body: { data: parsed.data } }
    );

    revalidatePath("/teach/courses");
    revalidatePath(`/courses/${response.data.slug}`);

    return { ok: true, data: { slug: response.data.slug } };
  } catch (error) {
    return { ok: false, message: toMessage(error, "Could not update the course") };
  }
}

export async function deleteCourseAction(courseDocumentId: string): Promise<ActionResult> {
  await requireRole("admin", "content-manager", "instructor");

  try {
    await strapi(`/api/courses/${courseDocumentId}`, { method: "DELETE" });

    revalidatePath("/teach/courses");
    revalidatePath("/courses");

    return { ok: true };
  } catch (error) {
    return { ok: false, message: toMessage(error, "Could not delete the course") };
  }
}

/**
 * Turn a thrown error into a message a toast can show.
 *
 * Strapi's own message is preferred because it is usually the specific and useful one
 * — "This attribute must be unique" for a duplicate slug, or the 403 an instructor gets
 * for someone else's course. The fallback covers a network failure, where there is no
 * server message to relay.
 */
function toMessage(error: unknown, fallback: string): string {
  if (error instanceof StrapiError) {
    if (error.status === 403) {
      return "You can only manage courses you own";
    }
    return error.message || fallback;
  }
  return fallback;
}
