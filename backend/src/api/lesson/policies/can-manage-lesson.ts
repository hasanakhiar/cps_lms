import type { PolicyContext } from '../../../types/api-context';
import { canManageCourseChild } from '../../../utils/course-ownership';

/**
 * `api::lesson.can-manage-lesson` — guards lesson create, update and delete.
 *
 * An instructor may write lessons only inside courses they own. The rule itself lives
 * in `utils/course-ownership.ts`, shared with the quiz policy, because the two are the
 * same question asked about a different content type — including the part that is easy
 * to get wrong, where an update tries to move a lesson into someone else's course.
 */
export default (policyContext: PolicyContext): Promise<boolean> =>
  canManageCourseChild(policyContext, 'api::lesson.lesson');
