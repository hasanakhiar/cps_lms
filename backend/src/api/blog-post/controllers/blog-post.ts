import { factories } from '@strapi/strapi';

/**
 * Only these two roles have any business seeing unpublished posts. Instructors and
 * students see the published blog exactly as an anonymous visitor does.
 */
const canSeeDrafts = (role?: string): boolean => role === 'admin' || role === 'content-manager';

export default factories.createCoreController('api::blog-post.blog-post', ({ strapi }) => ({
  /**
   * The public blog index.
   *
   * Draft & Publish is on for this content type, and in Strapi 5 the draft/published
   * selector is the **top-level `status` query param** — not a filter and not a field
   * on the document. `?status=draft` is therefore a complete bypass of anything
   * expressed as `filters`, which is leak test 7.
   *
   * An earlier version of this file wrote `filters: { status: 'published' }`. There is
   * no `status` attribute on the schema, so that filter matched nothing meaningful and
   * every draft was served to anonymous callers while looking, in the source, as
   * though it had been handled.
   *
   * `status` is assigned last so it overwrites whatever the caller sent, rather than
   * being merged with it.
   *
   * Strapi also accepts `publicationFilter` and `hasPublishedVersion` on Draft &
   * Publish types, which look like second ways in. They are not: every mode in
   * `buildPublicationFilterWhere` branches on `status` first, and with `status`
   * pinned to `published` each one can only narrow the set of already-published
   * rows — `never-published` degenerates to an empty selection. Forcing `status` is
   * therefore sufficient, and there is no need to strip the other two.
   */
  async find(ctx) {
    if (!canSeeDrafts(ctx.state.user?.role?.type)) {
      ctx.query = { ...ctx.query, status: 'published' };
    }
    return super.find(ctx);
  },

  /**
   * A single post.
   *
   * Same mechanism as `find`. Forcing `status` before delegating means the document
   * service itself never loads the draft, so an unpublished slug returns a plain 404
   * — the response is indistinguishable from a post that does not exist, which is
   * what we want. Fetching the draft and then deciding whether to return it would
   * work too, but it puts unpublished content in the process's memory on a public
   * route for no reason.
   */
  async findOne(ctx) {
    if (!canSeeDrafts(ctx.state.user?.role?.type)) {
      ctx.query = { ...ctx.query, status: 'published' };
    }
    return super.findOne(ctx);
  },

  /**
   * Authorship comes from the session, for the same reason course ownership does:
   * a client-supplied `author` would let a content-manager publish under someone
   * else's byline.
   */
  async create(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized('Authentication required');
    }

    ctx.request.body = {
      ...ctx.request.body,
      data: { ...(ctx.request.body?.data ?? {}), author: user.id },
    };

    return super.create(ctx);
  },
}));
