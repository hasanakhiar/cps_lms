import type { AuthenticatedContext } from '../../../types/api-context';

/**
 * POST /api/quizzes/:id/submit
 * Body: `{ "answers": (number | null)[] }` — the chosen option **index** per question.
 *
 * ★ GRADED FILE.
 *
 * Grading happens here, on the server, in a request the student cannot see into. The
 * client sends only which option it picked. It never sends, and cannot influence, the
 * score — a body containing `score: 100` is graded exactly like one that does not,
 * because `score` is never read. That is leak test 6.
 *
 * The answer format is **indices, not option ids**. Ids are the obvious choice and the
 * wrong one: `quiz.option` is a Strapi component, and component rows are deleted and
 * recreated when an instructor edits the parent quiz, so an id stored in an old attempt
 * can end up pointing at a different option or at nothing. An index is stable against
 * that, and positional matching against the question list is unambiguous. `null` means
 * unanswered, which is distinct from "answered wrongly" and is recorded as such.
 */

/**
 * One question's outcome, frozen at submit time.
 *
 * Exported because `GET /api/quiz-attempts/me` reads the same rows back out of the
 * `gradedBreakdown` JSON column. A JSON column has no shape of its own as far as the
 * database is concerned, so the only thing keeping writer and reader in agreement is
 * this type — declaring it twice would be two shapes that happen to match today.
 */
export type GradedQuestion = {
  /** The question text as it read when the attempt was made. */
  prompt: string;
  /** The label the student picked, or `null` if they skipped it. */
  chosenLabel: string | null;
  /** The label that was correct, or `null` if the quiz had no correct option marked. */
  correctLabel: string | null;
  answered: boolean;
  /**
   * Whether the student got this question right.
   *
   * Named `wasCorrect`, not `isCorrect`. `isCorrect` on a `quiz.option` means "this
   * option is the answer" and must never reach a student; `wasCorrect` here is the
   * student's own result on their own attempt, which is the whole point of the
   * response. Two different facts deserve two different names — and it means a grep for
   * `isCorrect` across any response body is unambiguously a leak rather than something
   * that needs a second look.
   */
  wasCorrect: boolean;
};

/**
 * An option as stored on the `quiz.option` component.
 *
 * `label` is `required: true` in the schema, but Strapi's generated types make every
 * attribute optional and nullable — the schema is enforced on write, not expressed in
 * the read type. Matching that here rather than asserting it away means the `?? ''`
 * fallbacks below are visible, instead of being a non-null assertion that would throw
 * on a row written before the field was made required.
 */
type QuizOption = { label?: string | null; isCorrect?: boolean | null };

/** A question as stored on the `quiz.question` component. */
type QuizQuestion = { prompt?: string | null; options?: QuizOption[] | null };

export default {
  async submit(ctx: AuthenticatedContext) {
    const user = ctx.state.user;
    const submitted = ctx.request.body?.answers;

    // Reject anything that is not an array before touching the database — a missing
    // body, an object, a string. Everything downstream indexes into this.
    if (!Array.isArray(submitted)) {
      return ctx.badRequest('Body must be { answers: (number | null)[] }');
    }

    // The full question and option tree, including `isCorrect`. This is the one place
    // the answer key is legitimately loaded for a student's request: it is read in
    // order to grade, and nothing derived from it that reveals which option was correct
    // leaves this function except `correctLabel`, which the student has by then earned
    // by submitting.
    const quiz = await strapi.documents('api::quiz.quiz').findOne({
      documentId: ctx.params.id,
      fields: ['title', 'passingScore'],
      populate: {
        questions: { populate: { options: { fields: ['label', 'isCorrect'] } } },
        course: { fields: ['title'] },
      },
    });

    if (!quiz) {
      return ctx.notFound('Quiz not found');
    }

    const questions: QuizQuestion[] = quiz.questions ?? [];

    // An empty quiz would make the percentage a division by zero. Refused rather than
    // returning a meaningless 0%, because a quiz with no questions is an authoring
    // mistake and a student should be told the quiz is not ready, not scored on it.
    if (questions.length === 0) {
      return ctx.badRequest('This quiz has no questions yet');
    }

    let score = 0;

    // One pass over the **questions** — never over `submitted`. Iterating the
    // server-side list is what makes the length of the request body irrelevant: extra
    // entries are ignored, missing ones are unanswered, and a 10,000-element array
    // cannot make this loop do more work than the quiz has questions.
    //
    // The pass produces the score and a snapshot together. The snapshot is the more
    // important half: if the instructor later reorders the options or deletes a
    // question, a stored answer *index* becomes meaningless, but the frozen labels stay
    // readable forever. `/my-results` therefore keeps working, rather than turning into
    // nonsense the first time a quiz is edited.
    const breakdown: GradedQuestion[] = questions.map((question, index) => {
      const options = question.options ?? [];

      // `findIndex` returns -1 when the instructor forgot to mark a correct option. In
      // that case nothing can match, so the question scores zero for everyone — which
      // is the honest outcome. Defaulting to the first option would silently invent an
      // answer key.
      const correctIndex = options.findIndex((option) => option.isCorrect === true);

      const chosen = submitted[index];

      // Unanswered arrives as `null`; a tampered body could send `99`, `-1`, `"2"`,
      // `1.5` or an object. Every one of those fails this guard and is graded as
      // unanswered rather than crashing on `options[chosen]` two lines down.
      //
      // `Number.isInteger` first, so the comparisons below only ever run on a number.
      const answered =
        Number.isInteger(chosen) &&
        (chosen as number) >= 0 &&
        (chosen as number) < options.length;
      const chosenIndex = answered ? (chosen as number) : -1;

      const wasCorrect = answered && correctIndex >= 0 && chosenIndex === correctIndex;
      if (wasCorrect) {
        score += 1;
      }

      return {
        prompt: question.prompt ?? '',
        chosenLabel: answered ? options[chosenIndex].label ?? null : null,
        correctLabel: correctIndex >= 0 ? options[correctIndex].label ?? null : null,
        answered,
        wasCorrect,
      };
    });

    const total = questions.length;
    const percentage = Math.round((score / total) * 100);

    // The answers as *graded*, not as *received*. Storing the raw body would persist
    // whatever junk a tampered request contained; this stores one entry per question,
    // normalised to an index or `null`, so the stored attempt always lines up with
    // `gradedBreakdown`.
    const normalisedAnswers = breakdown.map((graded, index) =>
      graded.answered ? (submitted[index] as number) : null
    );

    // Attempts are append-only: a retake adds a row rather than overwriting, so the
    // history survives and every attempt stays viewable later.
    const attempt = await strapi.documents('api::quiz-attempt.quiz-attempt').create({
      data: {
        // Users are not documents, so the student relation takes the numeric id while
        // the quiz relation takes a documentId.
        student: user.id,
        quiz: quiz.documentId,
        score,
        total,
        percentage,
        submittedAnswers: normalisedAnswers,
        gradedBreakdown: breakdown,
        submittedAt: new Date(),
      },
      fields: ['score', 'total', 'percentage', 'submittedAt'],
    });

    return {
      data: {
        attemptId: attempt.documentId,
        score,
        total,
        percentage,
        // A quiz with no `passingScore` set passes at 0 — every attempt passes. That is
        // the lenient default on purpose: the alternative is an unset field silently
        // failing every student on a quiz the instructor thought was ungraded.
        passed: percentage >= (quiz.passingScore ?? 0),
        breakdown,
      },
    };
  },
};
