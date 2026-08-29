import "server-only";
import { strapi } from "@/lib/strapi";
import { getMyEnrollments, getMyAttempts } from "@/lib/api/learning";
import type { CourseDetail, StrapiResponse } from "@/types";

/**
 * The signed-in student's home summary: what to carry on with, what is outstanding,
 * and what has appeared since they enrolled.
 *
 * Three things this deliberately does not invent, because the data model has no such
 * concept and a home page that promises them would be lying:
 *
 *  - **Assignments.** There are lessons and quizzes. Nothing else.
 *  - **Locked or unlocked content.** Enrolment is all-or-nothing; there are no
 *    prerequisites, so no lesson is ever "unlocked" by finishing another. What *is*
 *    real is that an instructor can add a lesson to a course you already joined, which
 *    is what "new since you enrolled" below actually measures.
 *  - **Levels, streaks or leaderboards.** No such fields exist — and a leaderboard
 *    would contradict the access model, which goes out of its way to stop one student
 *    seeing another's rows.
 */

export type ContinueLearning = {
  courseTitle: string;
  courseSlug: string;
  percentage: number;
  completed: number;
  totalLessons: number;
  nextLessonTitle: string | null;
};

export type PendingQuiz = {
  quizDocumentId: string;
  title: string;
  courseTitle: string;
  courseSlug: string;
  /** `not-attempted` has never been submitted; `not-passed` scored below the pass mark. */
  status: "not-attempted" | "not-passed";
  bestPercentage: number | null;
  passingScore: number | null;
};

export type NewLesson = {
  documentId: string;
  title: string;
  courseTitle: string;
  courseSlug: string;
  addedAt: string;
};

export type StudentHome = {
  continueLearning: ContinueLearning | null;
  pendingQuizzes: PendingQuiz[];
  newLessons: NewLesson[];
  enrolledCount: number;
  lessonsCompleted: number;
  quizzesPassed: number;
};

export async function getStudentHome(): Promise<StudentHome> {
  const [enrollments, attempts] = await Promise.all([getMyEnrollments(), getMyAttempts()]);

  if (enrollments.length === 0) {
    return {
      continueLearning: null,
      pendingQuizzes: [],
      newLessons: [],
      enrolledCount: 0,
      lessonsCompleted: 0,
      quizzesPassed: 0,
    };
  }

  /**
   * One request per enrolled course, issued together.
   *
   * `/api/enrollments/me` returns progress but not the syllabus, and the lesson titles
   * and quiz list are needed to say *which* lesson is next and *which* quizzes are
   * outstanding. At a handful of enrolments this is fine; if a student could join
   * dozens, this would want a purpose-built endpoint rather than a fan-out.
   */
  const courses = await Promise.all(
    enrollments.map(async (enrollment) => {
      const response = await strapi<StrapiResponse<CourseDetail>>(
        `/api/courses/${enrollment.course.id}`
      );
      return { enrollment, detail: response.data };
    })
  );

  // Carry on with the course that is started but unfinished; fall back to the first
  // unfinished one, so a student who has only just enrolled still gets a next step.
  const inProgress =
    courses.find(
      ({ enrollment }) =>
        enrollment.progress.percentage > 0 && enrollment.progress.percentage < 100
    ) ?? courses.find(({ enrollment }) => enrollment.progress.percentage < 100);

  let continueLearning: ContinueLearning | null = null;

  if (inProgress) {
    const { enrollment, detail } = inProgress;
    const done = new Set(enrollment.progress.completedLessonIds);
    const ordered = [...(detail?.lessons ?? [])].sort((a, b) => a.order - b.order);
    const next = ordered.find((lesson) => !done.has(lesson.documentId));

    continueLearning = {
      courseTitle: enrollment.course.title,
      courseSlug: enrollment.course.slug,
      percentage: enrollment.progress.percentage,
      completed: enrollment.progress.completed,
      totalLessons: enrollment.progress.totalLessons,
      nextLessonTitle: next?.title ?? null,
    };
  }

  /**
   * Outstanding quizzes: never submitted, or submitted and not passed.
   *
   * `passed` is recomputed server-side against the quiz's current pass mark on every
   * read, so this reflects the mark as it stands rather than as it was at submit time.
   * Only the *best* attempt counts — retakes are additive, and having failed once should
   * not keep a quiz on this list forever after passing it.
   */
  const bestByQuiz = new Map<string, { percentage: number; passed: boolean; passingScore: number | null }>();

  for (const attempt of attempts) {
    const quizId = attempt.quiz?.id;
    if (!quizId) continue;

    const percentage = attempt.percentage ?? 0;
    const existing = bestByQuiz.get(quizId);

    if (!existing || percentage > existing.percentage) {
      bestByQuiz.set(quizId, {
        percentage,
        passed: attempt.passed,
        passingScore: attempt.quiz?.passingScore ?? null,
      });
    }
  }

  const pendingQuizzes: PendingQuiz[] = [];

  for (const { enrollment, detail } of courses) {
    for (const quiz of detail?.quizzes ?? []) {
      const best = bestByQuiz.get(quiz.documentId);

      if (best?.passed) continue;

      pendingQuizzes.push({
        quizDocumentId: quiz.documentId,
        title: quiz.title,
        courseTitle: enrollment.course.title,
        courseSlug: enrollment.course.slug,
        status: best ? "not-passed" : "not-attempted",
        bestPercentage: best?.percentage ?? null,
        passingScore: best?.passingScore ?? null,
      });
    }
  }

  /**
   * Lessons added to a course *after* the student enrolled.
   *
   * Derived by comparing each lesson's `createdAt` against the enrolment timestamp —
   * there is no per-student "last seen" marker to compare against instead, and adding
   * one would be a schema change for a home-page badge. The consequence is honest but
   * worth knowing: this list does not clear when the student reads the lesson, it
   * simply reflects what arrived after they joined.
   */
  const newLessons: NewLesson[] = [];

  for (const { enrollment, detail } of courses) {
    const enrolledAt = new Date(enrollment.enrolledAt).getTime();

    for (const lesson of detail?.lessons ?? []) {
      if (!lesson.createdAt) continue;
      if (new Date(lesson.createdAt).getTime() <= enrolledAt) continue;

      newLessons.push({
        documentId: lesson.documentId,
        title: lesson.title,
        courseTitle: enrollment.course.title,
        courseSlug: enrollment.course.slug,
        addedAt: lesson.createdAt,
      });
    }
  }

  newLessons.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());

  return {
    continueLearning,
    pendingQuizzes,
    newLessons,
    enrolledCount: enrollments.length,
    lessonsCompleted: enrollments.reduce((sum, e) => sum + e.progress.completed, 0),
    quizzesPassed: [...bestByQuiz.values()].filter((best) => best.passed).length,
  };
}
