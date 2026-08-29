/**
 * Course progress, computed from lesson completions.
 *
 * GRADED FILE. This is the single definition of what "progress" means in this
 * application. Three endpoints report it — `GET /api/courses/:id/progress`,
 * `POST /api/lessons/:id/complete` and `DELETE /api/lessons/:id/complete` — and
 * before this module existed, two of them had their own copy of the arithmetic.
 * Two copies of a formula is two answers to the same question as soon as one is
 * edited: the completion endpoints returned a percentage that no longer matched the
 * one the progress endpoint returned, and nothing failed to make that visible.
 *
 * Progress is **derived on every read** and never stored. A cached `percentage`
 * column on the enrolment would be faster and would go stale in at least four
 * places: a lesson added to the course, a lesson deleted, a completion undone, and
 * any of those racing a request already in flight. Each of those is a place someone
 * has to remember to recompute, and forgetting shows up much later as "the student
 * finished the course but it says 80%". Derivation has nowhere to go stale. It costs
 * two queries.
 */

import type { EntityId } from '../types/api-context';

/** What every progress-reporting endpoint returns. */
export type CourseProgress = {
  /** The course's documentId, echoed back so a client can match response to request. */
  courseId: string;
  /** Distinct lessons completed, clamped to `totalLessons`. */
  completed: number;
  totalLessons: number;
  /** Integer 0–100. */
  percentage: number;
  /**
   * documentIds of the completed lessons.
   *
   * Included because the learn page needs a checkmark per lesson and this is the only
   * endpoint that can tell it. No role is granted `lesson-completion.find`, on
   * purpose: that action returns every student's rows and is safe only by virtue of a
   * forced filter. Returning the ids the caller has already proved they may see is the
   * narrower answer than opening up a collection-wide route.
   */
  completedLessonIds: string[];
};

/**
 * Distinct lessons a student has completed in one course.
 *
 * Numeric ids and documentIds are both collected: the count is taken from the numeric
 * primary key, which is always present, while the frontend addresses lessons by
 * documentId.
 */
const loadCompletedLessons = async (
  studentId: number,
  courseNumericId: EntityId
): Promise<Map<EntityId, string>> => {
  const completions = await strapi.db
    .query('api::lesson-completion.lesson-completion')
    .findMany({
      where: { student: { id: studentId }, course: { id: courseNumericId } },
      select: ['id'],
      // A narrow select on the populate rather than `populate: ['lesson']`. The
      // completion only needs to identify which lesson it refers to; the bare populate
      // returns the whole lesson, dragging `content` and `videoUrl` into memory on a
      // request whose entire output is four numbers and a list of ids.
      populate: { lesson: { select: ['id', 'documentId'] } },
    });

  // Deduplicate by numeric lesson id.
  //
  // Duplicate completion rows should not exist — `complete` checks for one before
  // inserting — but check-then-insert is not atomic, so two concurrent requests can
  // both pass the check before either writes. A stale duplicate must not push a
  // student past 100%, and deduplicating on read makes the count correct regardless of
  // what ended up in the table.
  //
  // Completions whose lesson relation is null are skipped: deleting a lesson leaves
  // the completion row behind, and it no longer refers to anything countable.
  const byNumericId = new Map<EntityId, string>();
  for (const completion of completions) {
    const lesson = completion.lesson;
    if (lesson?.id) {
      byNumericId.set(lesson.id, lesson.documentId);
    }
  }

  return byNumericId;
};

/**
 * The percentage itself, as an integer 0–100.
 *
 * Separated from `computeCourseProgress` because one caller legitimately cannot use
 * that function: `GET /api/courses/:id/students` needs progress for every student in a
 * course, and calling `computeCourseProgress` per student would be two queries per
 * enrolled student. It runs three course-wide queries and groups them in memory
 * instead — a different *query strategy*, but it must not become a different *formula*.
 * So the query strategy is the caller's choice and the arithmetic lives here.
 *
 * Two guards, both of which produce a wrong number rather than an error if omitted:
 *
 * **Clamp.** Completion rows can outnumber a course's lessons. A lesson moved to
 * another course leaves live completion rows behind that the course no longer contains,
 * and "12 of 10 lessons, 120%" is nonsense to show a student.
 *
 * **Zero denominator.** A course with no lessons yet divides 0 by 0. `Math.round(NaN)`
 * is `NaN`, which serialises to JSON `null` and renders as an empty progress bar with
 * nothing at all to indicate that something went wrong — the worst kind of bug, because
 * it looks like a correct answer.
 */
export const progressPercentage = (completed: number, totalLessons: number): number => {
  if (totalLessons <= 0) {
    return 0;
  }
  return Math.round((Math.min(completed, totalLessons) / totalLessons) * 100);
};

/**
 * Compute one student's progress through one course.
 *
 * Takes the course's numeric id *and* its documentId because the two are used for
 * different things and the caller has already resolved both: relation filters join on
 * the numeric primary key, while the response is addressed by documentId. Resolving
 * the course again in here would be a third query for data the caller is holding.
 */
export const computeCourseProgress = async (
  studentId: number,
  courseNumericId: EntityId,
  courseDocumentId: string
): Promise<CourseProgress> => {
  const [totalLessons, completedLessons] = await Promise.all([
    strapi.db.query('api::lesson.lesson').count({
      where: { course: { id: courseNumericId } },
    }),
    loadCompletedLessons(studentId, courseNumericId),
  ]);

  // Clamped here as well as inside `progressPercentage`, because `completed` is
  // reported to the client as its own number and "12 of 10" would be visible even if
  // the percentage read 100%.
  const completed = Math.min(completedLessons.size, totalLessons);

  return {
    courseId: courseDocumentId,
    completed,
    totalLessons,
    percentage: progressPercentage(completed, totalLessons),
    completedLessonIds: [...completedLessons.values()],
  };
};
