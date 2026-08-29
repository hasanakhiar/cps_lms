import { factories } from '@strapi/strapi';
import { ownedCourseDocumentIds } from '../../../utils/course-ownership';

/**
 * Roles that may read any lesson's body. Everyone else either owns the course, is
 * enrolled in it, or gets titles only.
 */
const MANAGES_ALL_CONTENT = (role?: string): boolean =>
  role === 'admin' || role === 'content-manager';

/**
 * What a caller who is not entitled to lesson bodies is allowed to see.
 *
 * Titles and ordering are a syllabus — the thing a course page legitimately shows to
 * someone deciding whether to enrol. `content` and `videoUrl` are the product.
 */
const SYLLABUS_FIELDS = ['title', 'order'] as const;

export default factories.createCoreController('api::lesson.lesson', ({ strapi }) => ({
  /**
   * GET /api/lessons — public.
   *
   * This action is granted to the `public` role, so it has to be safe for an
   * anonymous caller. Three cases:
   *
   *  - admin / content-manager: the whole catalogue, unrestricted.
   *  - instructor: their own lessons in full, scoped by a forced filter on the
   *    course's instructor. An instructor managing `/teach/courses/:id/lessons` needs
   *    the bodies in order to edit them; they have no business reading another
   *    instructor's drafts, so the filter is applied rather than the fields being
   *    stripped.
   *  - everyone else, including anonymous and every student: titles and ordering only.
   *
   * Both `fields` and `populate` are **overwritten**, never merged. Merging is the
   * mistake this guards against: stripping `fields` while leaving the caller's
   * `populate` intact leaves `?populate[course][populate][lessons][fields][0]=content`
   * wide open, which reaches the same rows by a longer path. Rebuilding `populate`
   * server-side means there is no path at all.
   */
  async find(ctx) {
    const user = ctx.state.user;
    const role = user?.role?.type;

    if (MANAGES_ALL_CONTENT(role)) {
      return super.find(ctx);
    }

    if (role === 'instructor' && user) {
      ctx.query = {
        ...ctx.query,
        // Overwrite, not merge. A merged filter can be defeated by a crafted `$or`:
        // `?filters[$or][0][id][$notNull]=true` would widen an `$and`-merged clause
        // back out to every row. Assignment leaves nothing to widen.
        //
        // Scoped by resolved course ids rather than by `course.instructor.id` — see
        // `ownedCourseDocumentIds` for why the content API cannot filter through the
        // user relation.
        filters: { course: { documentId: { $in: await ownedCourseDocumentIds(user.id) } } },
        populate: { course: { fields: ['documentId', 'title', 'slug'] } },
      };
      return super.find(ctx);
    }

    ctx.query = {
      ...ctx.query,
      fields: [...SYLLABUS_FIELDS],
      populate: { course: { fields: ['documentId', 'title', 'slug'] } },
    };
    return super.find(ctx);
  },

  /**
   * GET /api/lessons/:id — authenticated.
   *
   * This is the endpoint that actually serves lesson bodies, so it is the one that
   * decides who may read a course's content. Leak test 9: a student who never joined
   * the course gets 403.
   *
   * Entitlement is one of three things, checked in order of cost:
   *
   *  1. admin / content-manager — manage all content.
   *  2. the course's own instructor — wrote it.
   *  3. a student with an enrolment row for the course — paid for it, in the sense
   *     that matters here.
   *
   * Anything else is 403. The default is denial: the function ends in `ctx.forbidden`,
   * so a role added later without a branch here is locked out rather than let through.
   *
   * Note the shape of each successful branch — `return super.findOne(ctx)`. The
   * entitlement check is a gate in front of the core controller, not a reimplementation
   * of it, so sanitisation and query handling stay Strapi's job.
   */
  async findOne(ctx) {
    // `global::is-authenticated` on the route already guarantees this, but the check
    // costs nothing and the alternative is a crash on `user.role` if the route config
    // is ever edited.
    if (!ctx.state.user) {
      return ctx.forbidden('Not authorized');
    }

    const user = ctx.state.user;
    const role = user.role?.type;

    // The populate tree is fixed server-side for every caller. A lesson's only useful
    // relation is its course, and leaving the caller's `populate` intact would let an
    // entitled reader walk from a lesson they may see to things they may not:
    //
    //   ?populate[course][populate][quizzes][populate][questions][populate][options]=*
    //
    // reaches the answer key on the `quiz.option` component without ever touching the
    // quiz controller that guards it.
    ctx.query = {
      ...ctx.query,
      populate: { course: { fields: ['documentId', 'title', 'slug'] } },
    };

    if (MANAGES_ALL_CONTENT(role)) {
      return super.findOne(ctx);
    }

    // The lesson is loaded here only to find out which course it belongs to. `fields`
    // is deliberately minimal — the body is not needed to make an authorisation
    // decision, and this fetch happens before the caller is known to be entitled to
    // it. Every document response carries `id` and `documentId` regardless of `fields`.
    const lesson = await strapi.documents('api::lesson.lesson').findOne({
      documentId: ctx.params.id,
      fields: ['title'],
      populate: { course: { fields: ['title'] } },
    });

    // A lesson with no course has no owner and no enrolments, so nobody outside the
    // two manager roles can be entitled to it.
    if (!lesson?.course) {
      return ctx.notFound('Lesson not found');
    }

    const courseNumericId = lesson.course.id;

    if (role === 'instructor') {
      const course = await strapi.db.query('api::course.course').findOne({
        where: { id: courseNumericId },
        select: ['id'],
        // `select` on the populate: the only thing wanted is whether the instructor's
        // numeric id matches. A bare `populate: ['instructor']` would pull the whole
        // user row into memory to compare one integer.
        populate: { instructor: { select: ['id'] } },
      });

      if (course?.instructor?.id === user.id) {
        return super.findOne(ctx);
      }
    }

    if (role === 'student') {
      const enrollment = await strapi.db.query('api::enrollment.enrollment').findOne({
        where: {
          // Users are not documents: the student relation joins on the numeric id.
          student: { id: user.id },
          course: { id: courseNumericId },
        },
        select: ['id'],
      });

      if (enrollment) {
        return super.findOne(ctx);
      }
    }

    // Deliberately 403, not 404. The lesson exists and the caller has been told
    // nothing about its contents; pretending it is missing would be misleading to a
    // student who genuinely needs to know they have to enrol first.
    return ctx.forbidden('Not authorized');
  },
}));
