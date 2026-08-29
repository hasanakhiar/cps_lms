import type { AuthenticatedContext } from '../../../types/api-context';
import { computeCourseProgress, type CourseProgress } from '../../../utils/course-progress';
import { toIsoString } from '../../../utils/dates';

/**
 * GET /api/enrollments/me — student only.
 *
 * The data behind `/my-courses`: every course this student has joined, each with its
 * progress bar already computed. One request, because the page has nothing else to
 * show and a second round trip per course from the browser would be worse.
 *
 * Identity comes from `ctx.state.user.id` — the JWT — and from nowhere else. There is
 * no `studentId` parameter to tamper with, which is why this route exists at all
 * instead of `GET /api/enrollments?filters[student][id]=…`.
 */

/** The summary of a course as it appears on the student's own course list. */
type EnrolledCourse = {
  /** The enrolment's own documentId, so the UI has a stable key. */
  enrollmentId: string;
  enrolledAt: string | null;
  course: {
    id: string;
    title: string | null;
    slug: string | null;
    description: string | null;
    coverImageUrl: string | null;
  };
  progress: CourseProgress;
};

export default {
  async myEnrollments(ctx: AuthenticatedContext) {
    const user = ctx.state.user;

    // The Document Service rather than the Query Engine. Not for the field casting —
    // neither one normalises datetimes, which is why `toIsoString` exists below — but
    // because `filters` and `populate` here read exactly like they do in every other
    // document-service call in this codebase, and mixing the two query APIs across
    // files that do the same job is how `where` and `filters` get confused.
    const enrollments = await strapi.documents('api::enrollment.enrollment').findMany({
      // Users are not documents: the relation joins on the numeric id.
      filters: { student: { id: user.id } },
      fields: ['enrolledAt'],
      // An explicit field list, not `populate: ['course']`. This response is assembled
      // by hand, so Strapi's output sanitiser never runs on it and every field named
      // here is a field the student will actually receive.
      populate: { course: { fields: ['title', 'slug', 'description', 'coverImageUrl'] } },
      sort: 'enrolledAt:desc',
    });

    // Two queries per enrolment, run concurrently. That is deliberately not optimised
    // into one grouped aggregate: `computeCourseProgress` is the single definition of
    // what progress means, shared with `GET /api/courses/:id/progress` and with the
    // complete/uncomplete handlers, and a bespoke aggregate here would be a second
    // definition that could disagree with it. A student is enrolled in a handful of
    // courses, so the cost is a handful of indexed lookups; the cost of two answers to
    // "how far through am I" is a bug report nobody can reproduce.
    const courses = await Promise.all(
      enrollments.map(async (enrollment): Promise<EnrolledCourse | null> => {
        const course = enrollment.course;

        // An enrolment whose course has been deleted has nothing to render. Dropped
        // rather than returned with a null course, so the frontend never has to
        // special-case it.
        if (!course) {
          return null;
        }

        const progress = await computeCourseProgress(user.id, course.id, course.documentId);

        return {
          enrollmentId: enrollment.documentId,
          enrolledAt: toIsoString(enrollment.enrolledAt),
          course: {
            id: course.documentId,
            title: course.title ?? null,
            slug: course.slug ?? null,
            description: course.description ?? null,
            coverImageUrl: course.coverImageUrl ?? null,
          },
          progress,
        };
      })
    );

    return { data: courses.filter((entry): entry is EnrolledCourse => entry !== null) };
  },
};
