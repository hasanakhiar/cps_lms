import type { AuthenticatedContext, RoleType } from '../../../types/api-context';

/** The roles `setUserRole` will accept. Anything outside this list is rejected. */
const ASSIGNABLE_ROLES: readonly RoleType[] = ['admin', 'content-manager', 'instructor', 'student'];

/**
 * Upper bound on `/api/platform/users?pageSize=`. Without it, `pageSize=1000000`
 * turns a paginated admin screen into a full table dump in one request.
 */
const MAX_PAGE_SIZE = 100;

const isAssignableRole = (value: unknown): value is RoleType =>
  typeof value === 'string' && (ASSIGNABLE_ROLES as readonly string[]).includes(value);

/**
 * Parse a positive integer from a query param, falling back when it is absent or
 * junk. `Number.parseInt` on `undefined` gives `NaN`, and `NaN || fallback` happens
 * to work, but relying on that makes the intent hard to read.
 */
const positiveInt = (value: unknown, fallback: number, max: number): number => {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

export default {
  /**
   * GET /api/me
   *
   * Exists because `/api/users/me` does not populate the role, and Auth.js needs the
   * role at login in order to put it in the session — which is what every
   * server-side authorisation check in the frontend then reads.
   *
   * The role is re-read from the database rather than taken from `ctx.state.user`.
   * The JWT carries only the user id, so this is the authoritative answer even if the
   * role changed after the token was issued.
   */
  async me(ctx: AuthenticatedContext) {
    const user = ctx.state.user;

    // Users are not documents, so this is the Query Engine and a numeric id.
    const fullUser = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { id: user.id },
      select: ['id', 'username', 'email'],
      populate: ['role'],
    });

    if (!fullUser) {
      // The JWT referenced a user that no longer exists.
      return ctx.unauthorized('User not found');
    }

    // Deliberately flat, not wrapped in `{ data }`, matching the documented contract
    // for this endpoint. `select` above is what keeps the password hash and the
    // reset/confirmation tokens out of the response — this route does not go through
    // the core controller's `sanitizeOutput`, so nothing else would.
    return {
      id: fullUser.id,
      username: fullUser.username,
      email: fullUser.email,
      role: fullUser.role ? { type: fullUser.role.type, name: fullUser.role.name } : null,
    };
  },

  /**
   * GET /api/platform/stats — admin only.
   *
   * Counts are issued concurrently because they are independent; the endpoint is
   * then as slow as the slowest single count rather than their sum.
   */
  async stats(ctx: AuthenticatedContext) {
    const [totalUsers, totalCourses, totalLessons, totalEnrollments, totalQuizzes, totalAttempts] =
      await Promise.all([
        strapi.db.query('plugin::users-permissions.user').count(),
        strapi.db.query('api::course.course').count(),
        strapi.db.query('api::lesson.lesson').count(),
        strapi.db.query('api::enrollment.enrollment').count(),
        strapi.db.query('api::quiz.quiz').count(),
        strapi.db.query('api::quiz-attempt.quiz-attempt').count(),
      ]);

    // Blog posts are the one content type with Draft & Publish on, and counting them
    // is where it is easy to be wrong. Strapi 5 stores each *status* as its own row:
    // publishing a document does not move a row, it adds a second one. So a blog with
    // three posts of which one is unpublished has three draft rows and two published
    // rows, and a Query Engine `count({ publishedAt: { $null: true } })` reports three
    // drafts instead of one.
    //
    // The Document Service counts documents rather than rows, so `status: 'draft'`
    // returns the true total (every document has a draft) and the difference is the
    // number that have never been published.
    const [totalPosts, publishedPosts] = await Promise.all([
      strapi.documents('api::blog-post.blog-post').count({ status: 'draft' }),
      strapi.documents('api::blog-post.blog-post').count({ status: 'published' }),
    ]);

    // One count per role rather than populating each role's `users` relation and
    // taking its length — that would load every user row on the platform into memory
    // to produce four integers.
    const perRoleEntries = await Promise.all(
      ASSIGNABLE_ROLES.map(async (type) => {
        const count = await strapi.db.query('plugin::users-permissions.user').count({
          where: { role: { type } },
        });
        return [type, count] as const;
      })
    );

    return {
      data: {
        users: {
          total: totalUsers,
          perRole: Object.fromEntries(perRoleEntries) as Record<RoleType, number>,
        },
        courses: totalCourses,
        lessons: totalLessons,
        enrollments: totalEnrollments,
        quizzes: totalQuizzes,
        quizAttempts: totalAttempts,
        blogPosts: {
          published: publishedPosts,
          draft: totalPosts - publishedPosts,
        },
      },
    };
  },

  /**
   * GET /api/platform/users — admin only. Paginated, sorted by id.
   */
  async users(ctx: AuthenticatedContext) {
    const page = positiveInt(ctx.query.page, 1, Number.MAX_SAFE_INTEGER);
    const pageSize = positiveInt(ctx.query.pageSize, 25, MAX_PAGE_SIZE);

    // `select` is an allow-list, not a convenience. This route builds its own
    // response, so the core controller's output sanitisation never runs — without an
    // explicit select, `password`, `resetPasswordToken` and `confirmationToken` would
    // all be in the JSON.
    const { results, pagination } = await strapi.db
      .query('plugin::users-permissions.user')
      .findPage({
        page,
        pageSize,
        orderBy: { id: 'asc' },
        select: ['id', 'username', 'email', 'confirmed', 'blocked', 'createdAt'],
        populate: ['role'],
      });

    return { data: results, meta: { pagination } };
  },

  /**
   * PUT /api/platform/users/:id/role — admin only.
   *
   * This endpoint exists so that the generic `PUT /api/users/:id` can stay disabled
   * for every role. That is the decision that makes self-promotion structurally
   * impossible: there is no route through which a user can write their own `role`,
   * so the escalation path does not exist rather than being guarded.
   *
   * Two guards on top of the admin-only permission:
   *
   *  1. **No self-demotion.** An admin who demotes themselves by accident cannot
   *     undo it, because undoing it requires being an admin.
   *  2. **No demoting the last admin.** Same failure, reached from the other side —
   *     it would leave the platform with no one who can administer it, and the only
   *     recovery would be editing the database by hand.
   *
   * Both are checked against the database at request time rather than trusting
   * anything in the body.
   */
  async setUserRole(ctx: AuthenticatedContext) {
    const currentUser = ctx.state.user;
    const targetUserId = Number.parseInt(ctx.params.id, 10);

    if (!Number.isInteger(targetUserId) || targetUserId < 1) {
      return ctx.badRequest('Invalid user id');
    }

    // Users are numeric-id, so `:id` here is a real integer, unlike every other
    // `:id` in this API which is a documentId.
    const roleType = ctx.request.body?.roleType;
    if (!isAssignableRole(roleType)) {
      return ctx.badRequest(`roleType must be one of: ${ASSIGNABLE_ROLES.join(', ')}`);
    }

    const targetUser = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { id: targetUserId },
      select: ['id'],
      populate: ['role'],
    });

    if (!targetUser) {
      return ctx.notFound('User not found');
    }

    // Guard 1 — self-demotion.
    if (targetUser.id === currentUser.id) {
      return ctx.badRequest('You cannot change your own role');
    }

    // Guard 2 — last admin. Only relevant when the target is currently an admin and
    // is being moved to something else.
    const isDemotingAnAdmin = targetUser.role?.type === 'admin' && roleType !== 'admin';
    if (isDemotingAnAdmin) {
      const adminCount = await strapi.db.query('plugin::users-permissions.user').count({
        where: { role: { type: 'admin' } },
      });
      if (adminCount <= 1) {
        return ctx.badRequest('Cannot demote the last remaining admin');
      }
    }

    const newRole = await strapi.db.query('plugin::users-permissions.role').findOne({
      where: { type: roleType },
      select: ['id'],
    });

    if (!newRole) {
      // The bootstrap creates all four roles, so this means the database was edited
      // out from under the application.
      return ctx.internalServerError(`Role "${roleType}" is missing from the database`);
    }

    const updatedUser = await strapi.db.query('plugin::users-permissions.user').update({
      where: { id: targetUserId },
      data: { role: newRole.id },
      select: ['id', 'username', 'email'],
      populate: ['role'],
    });

    return { data: updatedUser };
  },
};
