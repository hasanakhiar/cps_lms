import type { IsEnrolledConfig, PolicyContext } from '../../../types/api-context';

/**
 * `api::enrollment.is-enrolled` — is the caller enrolled in the course this resource
 * belongs to?
 *
 * Guards `GET /api/courses/:id/progress` and `POST /api/quizzes/:id/submit`. Leak
 * test 8: a student who never joined a course cannot complete its lessons.
 *
 * One policy rather than three, configured per route with the kind of resource the
 * `:id` refers to:
 *
 *   { name: 'api::enrollment.is-enrolled', config: { resource: 'quiz' } }
 *
 * because the question is always the same — "does an enrolment row exist for this user
 * and the course upstream of this resource" — and only the path from the `:id` to the
 * course differs.
 */

/**
 * Given the resource kind and its documentId, produce the `where` clause that walks
 * from an enrolment to that resource.
 *
 * The traversal is expressed as a nested relation filter rather than as a chain of
 * lookups. Resolving lesson → course → numeric id → enrolment is three round trips to
 * answer a yes/no question that the database can answer with joins in one. Every one
 * of those intermediate fetches is also a place where a null could be mishandled into
 * an accidental `true`.
 */
const buildEnrollmentWhere = (
  resource: NonNullable<IsEnrolledConfig['resource']>,
  documentId: string,
  studentId: number
): Record<string, unknown> | null => {
  switch (resource) {
    // The `:id` is already the course, so no traversal is needed.
    case 'course':
      return { student: { id: studentId }, course: { documentId } };

    // enrollment -> course -> lessons, matching the lesson the caller asked for.
    case 'lesson':
      return { student: { id: studentId }, course: { lessons: { documentId } } };

    // enrollment -> course -> quizzes, same shape.
    case 'quiz':
      return { student: { id: studentId }, course: { quizzes: { documentId } } };

    // Unreachable given the type, but a route could be written in JavaScript or with a
    // typo in `config`, and the safe answer to "I do not know what this resource is"
    // is to deny.
    default:
      return null;
  }
};

export default async (
  policyContext: PolicyContext,
  config: IsEnrolledConfig
): Promise<boolean> => {
  const user = policyContext.state.user;
  if (!user) return false;

  const resource = config?.resource;
  const documentId = policyContext.params.id;

  // A route that forgot its `config.resource` denies every request. That is a visible
  // failure — the feature stops working and someone fixes the route — where the
  // alternative, treating a missing config as "no check required", would be an
  // invisible one.
  if (!resource || !documentId) {
    return false;
  }

  const where = buildEnrollmentWhere(resource, documentId, user.id);
  if (!where) return false;

  // `select: ['id']` because this is an existence check. The enrolment row's contents
  // are irrelevant; only whether one exists.
  const enrollment = await strapi.db.query('api::enrollment.enrollment').findOne({
    where,
    select: ['id'],
  });

  return Boolean(enrollment);
};
