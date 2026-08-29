import "server-only";
import { strapi } from "@/lib/strapi";
import type { BlogPost, StrapiResponse } from "@/types";

/**
 * Read helpers for the blog.
 *
 * Note what is *not* here: any notion of "published". The controller forces
 * `status: 'published'` for every caller who is not an admin or content manager, so
 * this layer does not filter and must not — a client-side filter would imply the
 * server's guard were optional, and someone would eventually "optimise" it away.
 * Drafts are invisible here because Strapi refuses to send them, which is the same
 * reason a hand-crafted `?status=draft` returns nothing (leak test 7).
 */

/** Published posts, newest first. Anonymous read, so it is cacheable. */
export async function listBlogPosts(): Promise<BlogPost[]> {
  const response = await strapi<StrapiResponse<BlogPost[]>>(
    "/api/blog-posts?sort[0]=publishedAt:desc",
    { auth: false }
  );

  return response.data ?? [];
}

/**
 * One post by slug, or `null` when there is no published post with that slug.
 *
 * A draft slug returns `null` and the page renders 404 — deliberately not 403. A 403
 * would confirm that something exists at that address, which tells a reader there is
 * unpublished content and what it is called. 404 reveals nothing.
 */
export async function getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  const params = new URLSearchParams({
    "filters[slug][$eq]": slug,
    "pagination[pageSize]": "1",
  });

  const response = await strapi<StrapiResponse<BlogPost[]>>(
    `/api/blog-posts?${params.toString()}`,
    { auth: false }
  );

  return response.data?.[0] ?? null;
}
