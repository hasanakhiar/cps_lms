import { factories } from '@strapi/strapi';

/**
 * Roles that manage the whole catalogue and may read any course in full.
 *
 * An instructor is deliberately **not** here. Instructors author material too, but only
 * their own — see `canReadCourseInFull`, which checks ownership per course rather than
 * treating the role as a blanket entitlement.
 */
const MANAGES_ALL_COURSES = (role?: string): boolean =>
  role === 'admin' || role === 'content-manager';

/**
 * May this caller read this course unrestricted — lesson bodies, and quiz options
 * including `isCorrect`?
 *
 * This function exists because the earlier version of it did not check ownership, and
 * that was a real answer-key leak. `GET /api/courses/:id` carries no ownership policy,
 * because the course page is public. So an instructor could request
 * `?populate[quizzes][populate][questions][populate]=options` against *another
 * instructor's* course and receive the full answer key, plus every lesson body. The
 * direct `/api/quizzes/:id` route strips `isCorrect` for a non-owning instructor; this
 * longer path around it did not.
 *
 * The leak is between peers rather than downwards, which is what made it easy to miss:
 * every role check passed, because the caller genuinely is an instructor.
 */
const canReadCourseInFull = async (
  courseDocumentId: string | undefined,
  user?: { id: number; role?: { type?: string } }
): Promise<boolean> => {
  const role = user?.role?.type;

  if (MANAGES_ALL_COURSES(role)) return true;
  if (role !== 'instructor' || !user || !courseDocumentId) return false;

  const course = await strapi.db.query('api::course.course').findOne({
    where: { documentId: courseDocumentId },
    select: ['id'],
    populate: { instructor: { select: ['id'] } },
  });

  // Compared against the session, never against anything in the request.
  return course?.instructor?.id === user.id;
};

/**
 * The only fields a course exposes on a public listing. `slug` is load-bearing —
 * the frontend routes are `/courses/[slug]` — and `documentId` is what every
 * subsequent API call keys on, so both stay. There is deliberately no `price`
 * field on this content type; an earlier version of this list asked for one, which
 * Strapi silently ignored while also dropping `slug`, breaking every catalogue
 * link.
 */
const PUBLIC_COURSE_FIELDS = ['documentId', 'title', 'slug', 'description', 'coverImageUrl'] as const;

/** The shape this controller mutates on the way out. */
type CoursePayload = {
  documentId?: string;
  instructorName?: string | null;
};

/**
 * Attach each course's instructor name as a plain string.
 *
 * The catalogue has to say who teaches a course, and `populate: { instructor }` cannot
 * deliver it: `sanitizeOutput` drops a populated relation whenever the caller has no
 * read permission on the target content type, and nobody here is granted
 * `users-permissions.user.find` — deliberately, because that would hand the entire user
 * table to anonymous visitors in exchange for one display name.
 *
 * So the name is resolved separately through the Query Engine, which is not
 * permission-filtered, and attached as a scalar. One extra query per response, and the
 * only thing crossing the boundary is a username that was always going to be rendered.
 * The relation itself stays unreadable, so `?populate[instructor][fields][0]=email`
 * still returns nothing.
 */
const attachInstructorNames = async (payload: unknown): Promise<void> => {
  const courses: CoursePayload[] = Array.isArray(payload) ? payload : [payload as CoursePayload];

  const documentIds = courses
    .map((course) => course?.documentId)
    .filter((id): id is string => typeof id === 'string');

  if (documentIds.length === 0) return;

  const rows = await strapi.db.query('api::course.course').findMany({
    where: { documentId: { $in: documentIds } },
    select: ['documentId'],
    populate: { instructor: { select: ['username'] } },
  });

  const nameByDocumentId = new Map<string, string | null>(
    rows.map((row: { documentId: string; instructor?: { username?: string } }) => [
      row.documentId,
      row.instructor?.username ?? null,
    ])
  );

  for (const course of courses) {
    if (course?.documentId) {
      course.instructorName = nameByDocumentId.get(course.documentId) ?? null;
    }
  }
};

export default factories.createCoreController('api::course.course', ({ strapi }) => ({
  /**
   * Ownership is assigned from the session, never from the request — and assigned
   * *after* the content API has finished with the payload.
   *
   * The obvious implementation is to write `instructor: user.id` into
   * `ctx.request.body.data` and let `super.create` persist it. That produced
   * `ValidationError: Invalid key instructor` for every role. The cause is
   * `throwRestrictedRelations`, one of the visitors Strapi runs over create input
   * in `validate.contentAPI.input`: a relation key is rejected outright unless the
   * caller has read access to the relation's *target* content type. The target here
   * is `plugin::users-permissions.user`, and no role on this platform is granted
   * `users-permissions.user.find` — deliberately, because that would expose the
   * entire user table to get one username. So the validator refused a value the
   * client never sent and the server had just written itself.
   *
   * Granting the user permission to make the error go away would trade a real
   * security property for a convenience, so ownership is applied through the Query
   * Engine instead, which sits below the content API and its permission-derived
   * validation. The security property is unchanged and slightly stronger: the
   * relation is now unreachable from the request body by construction, since the
   * body is never the thing that carries it.
   *
   * A client-supplied `instructor` is still deleted first. Without that, the create
   * would fail validation exactly as before — and a rejected request is a worse
   * answer than an ignored field for something no legitimate client sends.
   */
  async create(ctx) {
    const user = ctx.state.user;

    // The route already carries `is-authenticated`, so reaching here without a
    // user means the policy list was edited. Fail closed rather than creating an
    // ownerless course.
    if (!user) {
      return ctx.unauthorized('Authentication required');
    }

    if (ctx.request.body?.data && 'instructor' in ctx.request.body.data) {
      delete ctx.request.body.data.instructor;
    }

    const response = await super.create(ctx);
    const documentId = (response as { data?: { documentId?: string } })?.data?.documentId;

    if (!documentId) {
      // `super.create` resolved without a documentId, so there is nothing to attach
      // ownership to and nothing to roll back either. Loud, because the course that
      // was just created — if one was — has no owner and only a log line will say so.
      strapi.log.error('course.create: no documentId in response; ownership not assigned');
      return response;
    }

    try {
      await strapi.db.query('api::course.course').update({
        where: { documentId },
        data: { instructor: user.id },
      });
    } catch (error) {
      // An ownerless course is worse than a failed create: it is invisible to
      // `/courses/teaching`, and `is-course-owner-or-manager` denies every
      // instructor for it, so nobody below admin can ever edit or remove it. Undo
      // the create and let the caller see the failure.
      await strapi.db.query('api::course.course').delete({ where: { documentId } });
      throw error;
    }

    return response;
  },

  /**
   * Ownership can never be reassigned through the generic update route.
   *
   * `is-course-owner-or-manager` runs *before* the handler and checks the course
   * as it currently stands. If the body were allowed to carry `instructor`, an
   * owning instructor would pass that check and then hand their course to someone
   * else — or, worse, an instructor could transfer a course to themselves in a
   * single request that the policy had already approved. The key is deleted
   * unconditionally, not only when truthy, so an explicit `instructor: null`
   * cannot orphan the course either.
   */
  async update(ctx) {
    if (ctx.request.body?.data && 'instructor' in ctx.request.body.data) {
      delete ctx.request.body.data.instructor;
    }
    return super.update(ctx);
  },

  /**
   * The course catalogue.
   *
   * Strapi's query parser will happily traverse relations, so
   * `GET /api/courses?populate[lessons][fields][0]=content` returns every lesson
   * body on the platform to an anonymous caller. That is leak test 12.
   *
   * The caller's `fields` and `populate` are **overwritten**, not merged. Merging
   * would leave the attacker's `populate` branch in place alongside ours; there is
   * no safe way to combine an allow-list with arbitrary client input, so the
   * client input is dropped entirely and the shape is rebuilt server-side.
   */
  async find(ctx) {
    // Only the two manager roles get an unrestricted list. An instructor does *not*:
    // a list cannot be ownership-checked per row before the query runs, and
    // `?populate[quizzes][populate][questions][populate]=options` on an unrestricted
    // list would return every answer key on the platform. Instructors list their own
    // courses through `GET /api/courses/teaching`, which is scoped server-side.
    if (!MANAGES_ALL_COURSES(ctx.state.user?.role?.type)) {
      ctx.query = {
        ...ctx.query,
        fields: [...PUBLIC_COURSE_FIELDS],
        populate: {
          instructor: { fields: ['id', 'username'] },
          // `documentId` only: enough for the card to show a lesson count,
          // nothing that reveals the material itself.
          lessons: { fields: ['documentId'] },
        },
      };
    }

    const response = await super.find(ctx);
    await attachInstructorNames(response.data);
    return response;
  },

  /**
   * One course's detail page.
   *
   * Same hole as `find` — `GET /api/courses/:id?populate[lessons][fields][0]=content`
   * is the single-document variant of leak test 12 and is not covered by hardening
   * `find` alone.
   *
   * The syllabus is genuinely wanted here: the detail page lists lesson titles in
   * order so a prospective student can see what they would be buying. So lessons
   * are populated, but with an explicit field allow-list that omits `content` and
   * `videoUrl`.
   */
  async findOne(ctx) {
    // Ownership is resolved per course, not inferred from the role. An instructor gets
    // the full document for a course they own and the public shape for anyone else's.
    if (!(await canReadCourseInFull(ctx.params.id, ctx.state.user))) {
      ctx.query = {
        ...ctx.query,
        fields: [...PUBLIC_COURSE_FIELDS],
        populate: {
          instructor: { fields: ['id', 'username'] },
          // `createdAt` is included so the frontend can tell a student which lessons
          // were added *after* they enrolled — the "new since you joined" badge on the
          // home page. It is a timestamp on content whose title is already public, so
          // it reveals nothing the syllabus does not; `content` and `videoUrl` remain
          // excluded, which is what actually matters here.
          lessons: { fields: ['documentId', 'title', 'order', 'createdAt'] },
          quizzes: { fields: ['documentId', 'title'] },
        },
      };
    }

    const response = await super.findOne(ctx);
    await attachInstructorNames(response.data);
    return response;
  },
}));
