import type { AuthenticatedContext } from '../../../types/api-context';
import { computeCourseProgress, progressPercentage } from '../../../utils/course-progress';
import { toIsoString } from '../../../utils/dates';

/**
 * Course endpoints that the core controller cannot express: enrolment, progress,
 * the instructor's roster, and the instructor's own course list.
 *
 * Every handler here is reached through a route that declares its own policies, so
 * `ctx.state.user` is guaranteed present by `global::is-authenticated` before any of
 * this code runs. That is why the type is `AuthenticatedContext` rather than the
 * optional-user variant — the guarantee comes from the route definition, and the type
 * records it.
 */

/**
 * A course as returned to an instructor or manager listing their own courses.
 *
 * The response is assembled field by field rather than handing back database rows,
 * so adding a column to the schema cannot silently start exposing it here.
 */
type TeachingCourse = {
  documentId: string;
  title: string;
  slug: string;
  description: string | null;
  coverImageUrl: string | null;
  lessonCount: number;
  quizCount: number;
  studentCount: number;
};

/**
 * Roles that manage the whole catalogue rather than their own courses.
 */
const MANAGES_ALL_COURSES = new Set(['admin', 'content-manager']);

export default {
  /**
   * POST /api/courses/:id/enroll — student only.
   *
   * Idempotent: enrolling twice returns the existing row with 200 rather than
   * creating a second one or failing. A student who double-clicks the button, or
   * whose request is retried by a flaky connection, should end up enrolled once.
   *
   * `student` comes from the session. The body is not read at all — there is nothing
   * in it this endpoint needs, and accepting a `student` field would let any student
   * enrol anyone.
   */
  async enroll(ctx: AuthenticatedContext) {
    const courseDocumentId = ctx.params.id;
    const user = ctx.state.user;

    const course = await strapi.documents('api::course.course').findOne({
      documentId: courseDocumentId,
      fields: ['title'],
    });

    if (!course) {
      return ctx.notFound('Course not found');
    }

    const existingEnrollment = await strapi.db.query('api::enrollment.enrollment').findOne({
      where: {
        student: { id: user.id },
        course: { documentId: courseDocumentId },
      },
      select: ['id', 'documentId', 'enrolledAt'],
    });

    if (existingEnrollment) {
      return { data: existingEnrollment };
    }

    const newEnrollment = await strapi.documents('api::enrollment.enrollment').create({
      data: {
        enrolledAt: new Date(),
        // Users are not documents, so the user relation takes the numeric id while
        // the course relation — a normal document — takes the documentId.
        student: user.id,
        course: courseDocumentId,
      },
      fields: ['enrolledAt'],
    });

    return { data: newEnrollment };
  },

  /**
   * GET /api/courses/:id/progress — student, enrolled.
   *
   * The arithmetic lives in `utils/course-progress.ts`, shared with the two lesson
   * completion endpoints so all three can never disagree about what a percentage
   * means. See that file for why progress is derived rather than stored.
   *
   * Route policies guarantee the caller is an enrolled student, so this handler
   * answers only for `ctx.state.user` and never takes a student id from the request.
   * There is no endpoint through which one student can read another's progress; an
   * instructor reads their class through `/courses/:id/students` instead.
   */
  async myProgress(ctx: AuthenticatedContext) {
    const courseDocumentId = ctx.params.id;
    const user = ctx.state.user;

    // The numeric id is what the relation filters join on, so the course has to be
    // resolved from its documentId first.
    const course = await strapi.documents('api::course.course').findOne({
      documentId: courseDocumentId,
      fields: ['title'],
    });

    if (!course) {
      return ctx.notFound('Course not found');
    }

    return { data: await computeCourseProgress(user.id, course.id, course.documentId) };
  },

  /**
   * GET /api/courses/:id/students — course owner or manager.
   *
   * The roster with each student's progress. Ownership is enforced by
   * `api::course.is-course-owner-or-manager` on the route, so by the time this runs
   * the caller is known to be entitled to this specific course's students.
   */
  async students(ctx: AuthenticatedContext) {
    const courseDocumentId = ctx.params.id;

    const course = await strapi.documents('api::course.course').findOne({
      documentId: courseDocumentId,
      fields: ['title'],
    });

    if (!course) {
      return ctx.notFound('Course not found');
    }

    const [enrollments, totalLessons, allCompletions] = await Promise.all([
      strapi.db.query('api::enrollment.enrollment').findMany({
        where: { course: { id: course.id } },
        select: ['id', 'enrolledAt'],
        // `select` on the populate, not a bare `populate: ['student']`. A bare
        // populate returns the whole user row — `password`, `resetPasswordToken`,
        // `confirmationToken` — and this response is built by hand, so the core
        // controller's output sanitisation never runs to strip them. The allow-list
        // is the only thing standing between an instructor and every enrolled
        // student's password hash.
        populate: { student: { select: ['id', 'username', 'email'] } },
      }),
      strapi.db.query('api::lesson.lesson').count({
        where: { course: { id: course.id } },
      }),
      // One query for every completion in the course, grouped in memory below,
      // instead of one progress query per enrolled student. A class of 200 would
      // otherwise be 200 round trips.
      strapi.db.query('api::lesson-completion.lesson-completion').findMany({
        where: { course: { id: course.id } },
        select: ['id'],
        populate: {
          student: { select: ['id'] },
          lesson: { select: ['id'] },
        },
      }),
    ]);

    // student id -> distinct lesson ids completed. Deduplicated for the same reason
    // `utils/course-progress.ts` deduplicates: check-then-insert in `complete` is not
    // atomic, so a duplicate row is possible and must not push anyone past 100%.
    //
    // This deliberately does not call `computeCourseProgress` per student — that would
    // be two queries per enrolled student, where grouping one course-wide query in
    // memory is a fixed three. Only the *query strategy* differs: the percentage comes
    // from `progressPercentage`, the same function `computeCourseProgress` uses, so the
    // roster can never disagree with the student's own progress bar.
    const completedByStudent = new Map<number, Set<number>>();
    for (const completion of allCompletions) {
      const studentId = completion.student?.id;
      const lessonId = completion.lesson?.id;
      if (!studentId || !lessonId) continue;

      const existing = completedByStudent.get(studentId);
      if (existing) {
        existing.add(lessonId);
      } else {
        completedByStudent.set(studentId, new Set([lessonId]));
      }
    }

    const students = enrollments
      // An enrolment whose student was deleted has nothing to report.
      .filter((enrollment) => enrollment.student)
      .map((enrollment) => {
        const student = enrollment.student;
        const distinct = completedByStudent.get(student.id)?.size ?? 0;
        const completed = Math.min(distinct, totalLessons);

        return {
          id: student.id,
          username: student.username,
          email: student.email,
          enrolledAt: toIsoString(enrollment.enrolledAt),
          progress: {
            completed,
            totalLessons,
            percentage: progressPercentage(completed, totalLessons),
          },
        };
      })
      // Furthest along first — the useful default for an instructor scanning a class.
      .sort((a, b) => b.progress.percentage - a.progress.percentage);

    return { data: students };
  },

  /**
   * GET /api/courses/teaching — instructor, content-manager, admin.
   *
   * An instructor's own courses; the whole catalogue for the two roles that manage
   * all of it. Note the route for this lives in `routes/course.ts` rather than
   * `routes/custom-course.ts`, because `/courses/teaching` also matches the core
   * `/courses/:id` and has to be registered ahead of it.
   *
   * `ctx.state.user.role` is already populated — the users-permissions JWT strategy
   * resolves the user through `fetchAuthenticatedUser`, which populates `role` — so
   * there is no reason to query for it again. `global::has-role` reads the same
   * field to guard this route.
   */
  async teaching(ctx: AuthenticatedContext) {
    const user = ctx.state.user;
    const managesAll = MANAGES_ALL_COURSES.has(user.role?.type ?? '');

    // A single query shape for both branches, differing only in the filter. Two
    // different queries would be two different response shapes, and the frontend
    // would have to cope with the caller's role changing the fields it gets back.
    const courses = await strapi.db.query('api::course.course').findMany({
      where: managesAll ? {} : { instructor: { id: user.id } },
      select: ['id', 'documentId', 'title', 'slug', 'description', 'coverImageUrl'],
      populate: {
        // documentId-only populates: the counts are all that is wanted, and pulling
        // lesson `content` here would put the whole course text into a list response.
        lessons: { select: ['id'] },
        quizzes: { select: ['id'] },
        enrollments: { select: ['id'] },
      },
      orderBy: { title: 'asc' },
    });

    const data: TeachingCourse[] = courses.map((course) => ({
      documentId: course.documentId,
      title: course.title,
      slug: course.slug,
      description: course.description ?? null,
      coverImageUrl: course.coverImageUrl ?? null,
      lessonCount: course.lessons?.length ?? 0,
      quizCount: course.quizzes?.length ?? 0,
      studentCount: course.enrollments?.length ?? 0,
    }));

    return { data };
  },
};
