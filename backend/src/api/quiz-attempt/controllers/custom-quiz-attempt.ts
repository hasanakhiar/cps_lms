import type { AuthenticatedContext } from '../../../types/api-context';
import { toIsoString } from '../../../utils/dates';
import type { GradedQuestion } from '../../quiz/controllers/custom-quiz';

/**
 * GET /api/quiz-attempts/me — student only.
 *
 * The data behind `/my-results`. Identity comes from the JWT; there is no parameter
 * naming a student, so there is nothing to tamper with.
 *
 * What makes this route safe to return in full is that `gradedBreakdown` was frozen at
 * submit time and contains only *this student's own* outcome — the prompt, the label
 * they picked, the label that was correct, and whether they got it right. That is the
 * feedback they earned by submitting. It is not the answer key: it says nothing about
 * the questions they have not answered yet, and nothing about any other attempt.
 *
 * The one thing this route must never do is populate `quiz.questions`. That component
 * tree carries `isCorrect` for every option of every question, including ones the
 * student has never seen, and a single `populate` away from an already-authorised
 * response is exactly how an answer key escapes. Only the quiz's title, pass mark and
 * course are populated, and the list is written out here rather than taken from the
 * caller's query string.
 */

/** One graded attempt as `/my-results` renders it. */
type AttemptSummary = {
  attemptId: string;
  score: number | null;
  total: number | null;
  percentage: number | null;
  /**
   * Recomputed here from the stored percentage and the quiz's *current* pass mark
   * rather than read from a stored `passed` column — because there is no such column.
   * Storing it would freeze a verdict that an instructor can legitimately change by
   * editing the pass mark, and then two screens would disagree about whether the same
   * attempt passed.
   */
  passed: boolean;
  submittedAt: string | null;
  quiz: {
    id: string;
    title: string | null;
    passingScore: number | null;
    course: { id: string; title: string | null; slug: string | null } | null;
  } | null;
  /** The per-question snapshot written by `POST /api/quizzes/:id/submit`. */
  breakdown: GradedQuestion[];
};

export default {
  async myAttempts(ctx: AuthenticatedContext) {
    const user = ctx.state.user;

    // The Document Service, matching the other hand-built list endpoints so that
    // `filters`/`populate` mean the same thing everywhere. Datetimes are normalised
    // explicitly by `toIsoString` below — neither query API does it for us.
    const attempts = await strapi.documents('api::quiz-attempt.quiz-attempt').findMany({
      // Users are not documents: the relation joins on the numeric id.
      filters: { student: { id: user.id } },
      fields: ['score', 'total', 'percentage', 'submittedAt', 'gradedBreakdown'],
      populate: {
        quiz: {
          fields: ['title', 'passingScore'],
          populate: { course: { fields: ['title', 'slug'] } },
        },
      },
      // Newest first: a retake is the result the student came to look at.
      sort: 'submittedAt:desc',
    });

    const data: AttemptSummary[] = attempts.map((attempt) => {
      const quiz = attempt.quiz;
      const course = quiz?.course ?? null;
      const percentage = attempt.percentage ?? 0;

      return {
        attemptId: attempt.documentId,
        score: attempt.score ?? null,
        total: attempt.total ?? null,
        percentage: attempt.percentage ?? null,
        // A quiz with no pass mark set passes at 0, matching the grading endpoint. The
        // two defaults have to agree or the score shown at submit time and the score
        // shown on `/my-results` would differ for the same attempt.
        passed: percentage >= (quiz?.passingScore ?? 0),
        submittedAt: toIsoString(attempt.submittedAt),
        quiz: quiz
          ? {
              id: quiz.documentId,
              title: quiz.title ?? null,
              passingScore: quiz.passingScore ?? null,
              course: course
                ? { id: course.documentId, title: course.title ?? null, slug: course.slug ?? null }
                : null,
            }
          : null,
        // `gradedBreakdown` is a JSON column, so the database returns it untyped. The
        // assertion is safe in the narrow sense that matters: the only writer is
        // `custom-quiz.submit`, which builds it from the exported `GradedQuestion`
        // type, so writer and reader are checked against the same declaration. The
        // fallback covers a row written before the column existed.
        breakdown: (attempt.gradedBreakdown as GradedQuestion[] | null) ?? [],
      };
    });

    return { data };
  },
};
