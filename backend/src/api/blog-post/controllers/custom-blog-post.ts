import type { AuthenticatedContext } from '../../../types/api-context';

/**
 * POST /api/blog-posts/:id/unpublish — admin and content-manager only.
 *
 * Exists because Strapi 5's REST content API has no way to unpublish.
 *
 * The three things that look like they should work, and do not:
 *
 *  - `POST /api/blog-posts/:id/actions/publish` — 405. The `/actions/*` routes are
 *    part of the *admin* API, not the content API.
 *  - `PUT /api/blog-posts/:id?status=draft` — 200, and it writes the draft version
 *    while leaving the published version untouched and still live. It looks like it
 *    worked and the post stays public, which is the worst of the three outcomes.
 *  - `DELETE /api/blog-posts/:id?status=published` — 204, and it deletes the **whole
 *    document**, draft included. Not an unpublish; a data-loss bug wearing its clothes.
 *
 * The Document Service does expose the operation, so the route is written here rather
 * than approximated in the frontend. Publishing needs no equivalent: a write with
 * `?status=published` genuinely publishes.
 */
export default {
  async unpublish(ctx: AuthenticatedContext) {
    const documentId = ctx.params.id;

    if (!documentId) {
      return ctx.badRequest('A blog post id is required');
    }

    // Confirm the document exists before unpublishing it, so a bad id is a 404 rather
    // than a silent success on nothing.
    const existing = await strapi.documents('api::blog-post.blog-post').findOne({
      documentId,
      fields: ['title'],
      // Read the draft version: a published-only lookup would 404 for a post that is
      // already unpublished, turning a harmless repeat into an error.
      status: 'draft',
    });

    if (!existing) {
      return ctx.notFound('Blog post not found');
    }

    // Idempotent: unpublishing something already unpublished is a success, matching
    // the way lesson completion treats a repeated delete.
    await strapi.documents('api::blog-post.blog-post').unpublish({ documentId });

    return { data: { documentId, published: false } };
  },
};
