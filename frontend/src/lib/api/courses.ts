import "server-only";
import { strapi, StrapiError } from "@/lib/strapi";
import type { CourseDetail, CourseProgress, CourseSummary, StrapiResponse } from "@/types";

/**
 * Read helpers for courses.
 *
 * These exist so that pages never hand-write Strapi query strings. A page asking for
 * "the catalogue" should not have to know that lesson counts arrive as a populated
 * relation, or that search is `filters[title][$containsi]`. Keeping that here means the
 * query syntax is in one place per domain, and a page is a page.
 */

/**
 * The public catalogue, optionally filtered by title.
 *
 * Read without a session (`auth: false`), which is what makes the response cacheable —
 * the catalogue is identical for every visitor. Authenticated reads are never cached,
 * so passing a token here would quietly cost every visitor a fresh render.
 *
 * The backend decides what a course listing contains; there is deliberately no
 * `populate` or `fields` here. Sending one would be ignored anyway — the hardened
 * controller overwrites both — and writing it would imply the client had a say.
 */
export async function listCourses(search?: string): Promise<CourseSummary[]> {
  const params = new URLSearchParams({ "sort[0]": "createdAt:desc" });

  const query = search?.trim();
  if (query) {
    // `$containsi` is case-insensitive contains. Searching title only, because
    // description search on a catalogue this size adds noise rather than recall.
    params.set("filters[title][$containsi]", query);
  }

  const response = await strapi<StrapiResponse<CourseSummary[]>>(
    `/api/courses?${params.toString()}`,
    { auth: false }
  );

  return response.data ?? [];
}

/**
 * One course by slug, or `null` if there is no such course.
 *
 * Two calls, and the reason is worth stating: URLs carry the slug because it is
 * readable, but every other endpoint keys on `documentId`. So this resolves slug →
 * documentId with a filtered list, then fetches the document. Filtering `findOne` by
 * slug directly is not possible — `findOne` takes an id.
 *
 * `null` rather than a throw, so callers can render `notFound()` themselves and a
 * mistyped URL is a 404 rather than a 500.
 */
export async function getCourseBySlug(
  slug: string,
  opts: { authenticated?: boolean } = {}
): Promise<CourseDetail | null> {
  const authenticated = opts.authenticated ?? false;

  const params = new URLSearchParams({ "filters[slug][$eq]": slug, "pagination[pageSize]": "1" });

  const list = await strapi<StrapiResponse<CourseSummary[]>>(`/api/courses?${params.toString()}`, {
    auth: authenticated,
  });

  const match = list.data?.[0];
  if (!match) return null;

  const detail = await strapi<StrapiResponse<CourseDetail>>(`/api/courses/${match.documentId}`, {
    auth: authenticated,
  });

  return detail.data ?? null;
}

/**
 * This student's progress in one course, or `null` when they are not enrolled.
 *
 * The endpoint is gated by `is-enrolled`, so a non-enrolled student gets a 403 — which
 * is the correct answer, not an error worth propagating. A course page renders "not
 * enrolled" for exactly the same reason it renders "0% complete", so the 403 is
 * translated into `null` here and every other status still throws.
 */
export async function getCourseProgress(courseDocumentId: string): Promise<CourseProgress | null> {
  try {
    const response = await strapi<StrapiResponse<CourseProgress>>(
      `/api/courses/${courseDocumentId}/progress`
    );
    return response.data ?? null;
  } catch (error) {
    if (error instanceof StrapiError && (error.status === 403 || error.status === 404)) {
      return null;
    }
    throw error;
  }
}
