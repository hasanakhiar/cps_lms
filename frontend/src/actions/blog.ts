"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { strapi, StrapiError } from "@/lib/strapi";
import { requireRole } from "@/lib/auth-guards";
import type { ActionResult, BlogPost, StrapiResponse } from "@/types";

/**
 * Blog authoring — admins and content managers only.
 *
 * Instructors are excluded here, in `/teach/blog`'s own guard, and in Strapi's role
 * permissions. The last of those is the one that matters; the first two just stop an
 * instructor reaching a screen that would only fail.
 *
 * Draft and publish are Strapi's native Draft & Publish rather than a status enum, so
 * "save a draft" and "publish" are the same write with a different `status`, not two
 * different fields to keep in step.
 */
const postSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(200),
  slug: z
    .string()
    .trim()
    .min(3, "Slug must be at least 3 characters")
    .max(200)
    .regex(/^[a-z0-9-]+$/, "Slug may contain only lowercase letters, numbers and hyphens"),
  body: z.string().trim().min(1, "A post needs a body"),
  excerpt: z.string().trim().max(500).optional().or(z.literal("")),
  coverImageUrl: z
    .string()
    .trim()
    .url("Cover image must be a valid URL")
    .optional()
    .or(z.literal("")),
});

const STAFF = ["admin", "content-manager"] as const;

function readPostForm(formData: FormData) {
  return postSchema.safeParse({
    title: formData.get("title"),
    slug: formData.get("slug"),
    body: formData.get("body"),
    excerpt: formData.get("excerpt") ?? "",
    coverImageUrl: formData.get("coverImageUrl") ?? "",
  });
}

/**
 * Create or update a post, as a draft or published.
 *
 * One action rather than a create pair and an update pair, because of how it is
 * reached: the editor is a Client Component, and a Server Component cannot hand it an
 * inline arrow function — only a Server Action, or a `.bind()` of one, can cross that
 * boundary. Binding `postDocumentId` leaves exactly `(publish, formData)`, which is the
 * signature the form calls.
 *
 * Passing `(publish, formData) => updatePostAction(id, publish, null, formData)` is what
 * the previous version did, and it failed at render with "Event handlers cannot be
 * passed to Client Component props".
 *
 * `status` decides draft or live and comes from which button was pressed. `author` is
 * never sent — the backend sets it from the session, the same way courses get their
 * instructor.
 */
export async function savePostAction(
  postDocumentId: string | null,
  publish: boolean,
  formData: FormData
): Promise<ActionResult<{ documentId: string }>> {
  await requireRole(...STAFF);

  const parsed = readPostForm(formData);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const status = publish ? "published" : "draft";

  try {
    const response = await strapi<StrapiResponse<BlogPost>>(
      postDocumentId
        ? `/api/blog-posts/${postDocumentId}?status=${status}`
        : `/api/blog-posts?status=${status}`,
      { method: postDocumentId ? "PUT" : "POST", body: { data: parsed.data } }
    );

    revalidateBlog(parsed.data.slug);
    return { ok: true, data: { documentId: response.data.documentId } };
  } catch (error) {
    return { ok: false, message: toMessage(error, "Could not save the post") };
  }
}

/**
 * Unpublish: keep the document, drop its published version.
 *
 * This calls a **custom backend route**, because Strapi 5's REST content API cannot
 * express unpublishing. The three plausible alternatives all fail, two of them
 * silently:
 *
 *  - `POST /:id/actions/unpublish` is an admin-API route and returns 405 here.
 *  - `PUT /:id?status=draft` returns 200, writes the draft, and leaves the published
 *    version live — it looks like it worked and the post stays public.
 *  - `DELETE /:id?status=published` returns 204 and deletes the entire document,
 *    draft included.
 *
 * See `backend/src/api/blog-post/controllers/custom-blog-post.ts`.
 */
export async function unpublishPostAction(
  postDocumentId: string,
  slug: string
): Promise<ActionResult> {
  await requireRole(...STAFF);

  try {
    await strapi(`/api/blog-posts/${postDocumentId}/unpublish`, {
      method: "POST",
      body: {},
    });

    revalidateBlog(slug);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: toMessage(error, "Could not unpublish the post") };
  }
}

/**
 * Publish an existing post.
 *
 * Unlike unpublishing, this needs no custom route: a write with `?status=published`
 * genuinely publishes. The body is empty because the intent is only to change the
 * status — the content is whatever the draft already holds.
 */
export async function publishPostAction(
  postDocumentId: string,
  slug: string
): Promise<ActionResult> {
  await requireRole(...STAFF);

  try {
    await strapi(`/api/blog-posts/${postDocumentId}?status=published`, {
      method: "PUT",
      body: { data: {} },
    });

    revalidateBlog(slug);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: toMessage(error, "Could not publish the post") };
  }
}

export async function deletePostAction(
  postDocumentId: string,
  slug: string
): Promise<ActionResult> {
  await requireRole(...STAFF);

  try {
    await strapi(`/api/blog-posts/${postDocumentId}`, { method: "DELETE" });

    revalidateBlog(slug);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: toMessage(error, "Could not delete the post") };
  }
}

function revalidateBlog(slug: string): void {
  revalidatePath("/teach/blog");
  revalidatePath("/blog");
  revalidatePath(`/blog/${slug}`);
}

function toMessage(error: unknown, fallback: string): string {
  if (error instanceof StrapiError) {
    if (error.status === 403) {
      return "Only admins and content managers can manage blog posts";
    }
    return error.message || fallback;
  }
  return fallback;
}
