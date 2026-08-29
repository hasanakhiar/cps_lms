import { factories } from '@strapi/strapi';
import { scopeFindToOwnStudentRows } from '../../../utils/scope-find';

export default factories.createCoreController('api::quiz-attempt.quiz-attempt', ({ strapi }) => ({
  /**
   * A student's own attempt history. `gradedBreakdown` is a frozen snapshot taken at
   * submit time and already contains only that student's own answers plus which of
   * them were right, so it is safe to return here — but the quiz relation is
   * populated by title only, never by `questions`, since that would carry
   * `isCorrect` back out through a route that does no answer-stripping.
   */
  async find(ctx) {
    await scopeFindToOwnStudentRows(ctx, 'api::quiz-attempt.quiz-attempt', {
      quiz: { fields: ['documentId', 'title'] },
    });
    return super.find(ctx);
  },
}));
