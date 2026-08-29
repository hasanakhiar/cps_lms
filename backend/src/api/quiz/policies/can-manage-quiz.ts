import type { PolicyContext } from '../../../types/api-context';
import { canManageCourseChild } from '../../../utils/course-ownership';

/**
 * `api::quiz.can-manage-quiz` — guards quiz create, update and delete.
 *
 * The same rule as `can-manage-lesson`, asked about quizzes. It matters slightly more
 * here: a quiz's `questions` component carries `isCorrect` on every option, so write
 * access to another instructor's quiz would also be read access to their answer key.
 */
export default (policyContext: PolicyContext): Promise<boolean> =>
  canManageCourseChild(policyContext, 'api::quiz.quiz');
