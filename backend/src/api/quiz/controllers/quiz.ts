import { factories } from '@strapi/strapi';
import { ownedCourseDocumentIds } from '../../../utils/course-ownership';

/**
 * Roles that may read any quiz's answer key, because they manage the whole catalogue.
 * An instructor is *not* on this list — an instructor's entitlement is per course and
 * is checked against the database below.
 */
const MANAGES_ALL_CONTENT = (role?: string): boolean =>
  role === 'admin' || role === 'content-manager';

/**
 * The populate tree a quiz response is allowed to have.
 *
 * Built here rather than taken from the caller. `?populate=` on a quiz is the direct
 * route to the answer key, and a caller-supplied populate is a caller-supplied
 * decision about what to include. Overwriting it means the shape of a quiz response is
 * a property of this file.
 *
 * `isCorrect` *is* in this tree, because grading and quiz authoring both need it. It is
 * removed for callers who are not entitled to it, below, after the query has run.
 */
const QUIZ_POPULATE = {
  questions: {
    populate: {
      options: { fields: ['label', 'isCorrect'] },
    },
  },
  course: { fields: ['documentId', 'title', 'slug'] },
} as const;

/**
 * Remove the answer key from a quiz response.
 *
 * Applied to the response body rather than to the query, because a student *does* need
 * the options — they have to be able to pick one — and only the flag saying which one
 * is right has to go. Excluding `isCorrect` from the query instead would work equally
 * well for this route; doing it on the way out keeps the query in one place and makes
 * the two branches below differ by one statement rather than by a whole query.
 *
 * `global::strip-answer-key` does the same thing at the response boundary for every
 * other route. Both exist: this one is the specific, auditable check on the route where
 * it matters most, and the middleware is the net for the routes nobody thought about.
 */
const stripAnswerKey = (node: unknown): void => {
  if (Array.isArray(node)) {
    for (const item of node) stripAnswerKey(item);
    return;
  }
  if (node === null || typeof node !== 'object') return;

  const record = node as Record<string, unknown>;
  if ('isCorrect' in record) {
    delete record.isCorrect;
  }
  for (const value of Object.values(record)) {
    stripAnswerKey(value);
  }
};

export default factories.createCoreController('api::quiz.quiz', ({ strapi }) => ({
  /**
   * GET /api/quizzes — instructor, content-manager, admin.
   *
   * Not granted to students or to the public: a quiz list is an answer-key list, and
   * students reach individual quizzes through `findOne` on a course they are enrolled
   * in.
   *
   * Instructors are scoped by a forced filter to quizzes in their own courses. Without
   * it, `quiz.find` would hand instructor A every answer key instructor B has written —
   * a leak between peers rather than downwards, which is easy to miss because the role
   * check passes.
   */
  async find(ctx) {
    const user = ctx.state.user;
    const role = user?.role?.type;

    if (MANAGES_ALL_CONTENT(role)) {
      return super.find(ctx);
    }

    // Anything other than an instructor should not have reached this action at all —
    // no other role is granted it. Fail closed rather than fall through to a query.
    if (role !== 'instructor' || !user) {
      return ctx.forbidden('Not authorized');
    }

    ctx.query = {
      ...ctx.query,
      // Overwrite, not merge. An `$and`-merged filter can be widened back out by a
      // crafted `?filters[$or][0][id][$notNull]=true`; assignment leaves nothing to
      // widen.
      //
      // Scoped by resolved course ids rather than by `course.instructor.id` — see
      // `ownedCourseDocumentIds` for why the content API cannot filter through the
      // user relation.
      filters: { course: { documentId: { $in: await ownedCourseDocumentIds(user.id) } } },
      populate: QUIZ_POPULATE,
    };

    return super.find(ctx);
  },

  /**
   * GET /api/quizzes/:id — authenticated.
   *
   * Leak test 5: a student's response must not contain `isCorrect` anywhere, at any
   * nesting depth. The test greps the raw response text, which is the right way to
   * check it.
   *
   * Three outcomes:
   *
   *  - admin / content-manager: the quiz with its answer key.
   *  - the owning instructor: the same.
   *  - everyone else, including every student: the quiz with `isCorrect` removed.
   *
   * A student is not required to be enrolled to *read* a quiz — the enrolment check
   * lives on `POST /api/quizzes/:id/submit`, where it matters, and a quiz with no
   * answer key is not sensitive. Requiring it here would also mean the course page
   * could not show what a course assesses before someone joins.
   */
  async findOne(ctx) {
    // The populate tree is fixed server-side for every caller, entitled or not. This is
    // the assignment that makes the answer key unreachable by a crafted query rather
    // than merely stripped after the fact.
    ctx.query = { ...ctx.query, populate: QUIZ_POPULATE };

    const response = await super.findOne(ctx);
    if (!response?.data) {
      return response;
    }

    const user = ctx.state.user;
    const role = user?.role?.type;

    if (MANAGES_ALL_CONTENT(role)) {
      return response;
    }

    if (role === 'instructor' && user) {
      // One extra query to establish ownership. It could be avoided by adding
      // `instructor` to `QUIZ_POPULATE`, but that would put the instructor's id into
      // every student's quiz response to save a query on an instructor's, which is the
      // wrong trade — the response shape should be driven by what the reader needs, not
      // by what happens to be convenient for the authorisation check.
      const owner = await strapi.db.query('api::quiz.quiz').findOne({
        where: { documentId: ctx.params.id },
        select: ['id'],
        populate: { course: { select: ['id'], populate: { instructor: { select: ['id'] } } } },
      });

      // Compared against `ctx.state.user.id` — the session — never against anything in
      // the request.
      if (owner?.course?.instructor?.id === user.id) {
        return response;
      }
    }

    stripAnswerKey(response.data);
    return response;
  },
}));
