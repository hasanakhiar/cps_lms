import "server-only";
import { strapi, StrapiError } from "@/lib/strapi";
import type {
  BlogPost,
  CourseDetail,
  EnrolledStudent,
  StrapiResponse,
  TeachingCourse,
} from "@/types";

/**
 * Read helpers for the teaching and content-management screens.
 *
 * Note what is *not* here: any filtering by ownership. `GET /api/courses/teaching`
 * returns an instructor's own courses and a manager's everything, decided server-side
 * from the session. Re-filtering here would duplicate an authorisation rule in a place
 * that cannot enforce it, and the two copies would eventually disagree.
 */

/** Courses the caller may manage: their own, or all of them for staff. */
export async function getTeachingCourses(): Promise<TeachingCourse[]> {
  const response = await strapi<StrapiResponse<TeachingCourse[]>>("/api/courses/teaching");
  return response.data ?? [];
}

/**
 * One course with everything the management screens need, or `null` if the caller may
 * not manage it.
 *
 * The ownership check is the important half, and it is done by asking the backend
 * rather than by comparing ids here. `GET /api/courses/:id` carries no ownership policy
 * — the course page is public — so it answers happily for any course and cannot be used
 * on its own to decide whether a management screen should render. Without this check a
 * non-owning instructor got a working-looking edit form and quiz builder for someone
 * else's course; every write would then 403, which is safe but is a confusing way to
 * find out.
 *
 * `/api/courses/teaching` already returns exactly the set the caller may manage —
 * their own courses, or all of them for a manager — decided server-side from the
 * session. Reusing it means ownership is defined in one place. Re-deriving it here from
 * `instructor.id` would be a second implementation of the same rule, free to drift.
 *
 * The populate tree is spelled out because a staff query is not rewritten by the course
 * controller, so `isCorrect` comes back for the quiz builder — for owners and managers
 * only, which is what the controller now enforces.
 */
export async function getCourseForManagement(
  courseDocumentId: string
): Promise<CourseDetail | null> {
  const manageable = await getTeachingCourses();
  if (!manageable.some((course) => course.documentId === courseDocumentId)) {
    return null;
  }

  const params = new URLSearchParams({
    "populate[lessons][sort][0]": "order:asc",
    "populate[quizzes][populate][questions][populate]": "options",
  });

  try {
    const response = await strapi<StrapiResponse<CourseDetail>>(
      `/api/courses/${courseDocumentId}?${params.toString()}`
    );
    return response.data ?? null;
  } catch (error) {
    if (error instanceof StrapiError && (error.status === 403 || error.status === 404)) {
      return null;
    }
    throw error;
  }
}

/** Enrolled students with their live progress. Guarded by `is-course-owner-or-manager`. */
export async function getCourseStudents(
  courseDocumentId: string
): Promise<EnrolledStudent[] | null> {
  try {
    const response = await strapi<StrapiResponse<EnrolledStudent[]>>(
      `/api/courses/${courseDocumentId}/students`
    );
    return response.data ?? [];
  } catch (error) {
    if (error instanceof StrapiError && error.status === 403) {
      return null;
    }
    throw error;
  }
}

/** A blog post plus whether it currently has a published version. */
export type ManagedBlogPost = BlogPost & { isPublished: boolean };

/**
 * Every blog post, drafts included, for the editor list.
 *
 * Two requests, because of how Strapi 5 models Draft & Publish. A document has a draft
 * version and *optionally* a published one. `?status=draft` returns the draft version
 * of **every** document — including ones that are published — and those rows all carry
 * `publishedAt: null`, so the field cannot be used to tell the two apart. `?status=
 * published` returns only documents that have a published version.
 *
 * So the published set is fetched separately and used as the authority for the badge.
 * Reading `publishedAt` off the draft rows instead would mark every post as a draft,
 * which is the bug this comment exists to prevent someone reintroducing.
 */
export async function getAllBlogPosts(): Promise<ManagedBlogPost[]> {
  const [draftResponse, publishedResponse] = await Promise.all([
    strapi<StrapiResponse<BlogPost[]>>("/api/blog-posts?status=draft&sort[0]=createdAt:desc"),
    strapi<StrapiResponse<BlogPost[]>>("/api/blog-posts?status=published"),
  ]);

  const publishedIds = new Set((publishedResponse.data ?? []).map((post) => post.documentId));

  return (draftResponse.data ?? []).map((post) => ({
    ...post,
    isPublished: publishedIds.has(post.documentId),
  }));
}

/** One post for the editor, by documentId. Reads the draft version — the editable one. */
export async function getBlogPostForEdit(
  postDocumentId: string
): Promise<ManagedBlogPost | null> {
  try {
    const [draft, published] = await Promise.all([
      strapi<StrapiResponse<BlogPost>>(`/api/blog-posts/${postDocumentId}?status=draft`),
      strapi<StrapiResponse<BlogPost | null>>(
        `/api/blog-posts/${postDocumentId}?status=published`
      ).catch(() => ({ data: null })),
    ]);

    if (!draft.data) return null;

    return { ...draft.data, isPublished: Boolean(published.data) };
  } catch (error) {
    if (error instanceof StrapiError && (error.status === 403 || error.status === 404)) {
      return null;
    }
    throw error;
  }
}
