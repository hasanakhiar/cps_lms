import type { PolicyContext } from '../../../types/api-context';

/**
 * `api::course.is-course-owner-or-manager` — GRADED FILE.
 *
 * Guards `PUT /api/courses/:id`, `DELETE /api/courses/:id` and
 * `GET /api/courses/:id/students`. This is the policy that makes leak test 2 pass:
 * instructor A cannot edit instructor B's course.
 *
 * Ownership is a *per-resource* question, which is exactly why the role permission
 * table cannot answer it. Strapi's Roles & Permissions grants `course.update` to the
 * instructor role as a whole — it can say "instructors may edit courses", but it has
 * no vocabulary for "…their own". That gap is what this policy fills, and it is the
 * reason the three-layer model has a policy layer at all.
 *
 * The check is: load the course from the database, read its `instructor`, compare to
 * the session user. Note which values that uses and which it ignores. The course id
 * comes from the URL, the identity from the session, and the answer from the database.
 * Nothing is read from the request body — a body-supplied `instructor` is the obvious
 * way to defeat an ownership check, and `course.update` deletes that field before it
 * reaches the database for the same reason.
 *
 * Every path out of this function that is not a positive match returns `false`.
 * A policy that returned `undefined` on an unexpected branch would be falsy and
 * therefore still deny, but relying on that is relying on coercion; the denials are
 * written out.
 */
export default async (policyContext: PolicyContext): Promise<boolean> => {
  const user = policyContext.state.user;
  if (!user) return false;

  const role = user.role?.type;
  if (!role) return false;

  // Admins and content-managers manage the whole catalogue, so ownership does not
  // apply to them — an instructor leaving the platform must not strand their courses
  // with nobody able to edit or retire them.
  if (role === 'admin' || role === 'content-manager') {
    return true;
  }

  // Fail closed on any other role. A student reaching this policy is a denial, and so
  // is a role added to the platform later without a decision being made about it here.
  if (role !== 'instructor') {
    return false;
  }

  // Collection-level routes have no `:id`, so there is no single resource whose
  // ownership could be checked. Rather than wave those through, this policy denies
  // them — it is only ever attached to single-resource routes, so a missing `:id`
  // means the route config is wrong, and the safe reading of a wrong route config is
  // "deny".
  const documentId = policyContext.params.id;
  if (!documentId) return false;

  const course = await strapi.documents('api::course.course').findOne({
    documentId,
    // Only what the comparison needs. `fields: ['title']` rather than the default
    // everything, and a narrow populate on the instructor: the decision turns on one
    // integer, so there is no reason to load a course body and a full user row to
    // make it.
    fields: ['title'],
    populate: { instructor: { fields: ['id'] } },
  });

  // No course is a denial rather than a 404. Distinguishing the two here would let an
  // unauthorised caller probe which course ids exist by watching the status code; the
  // controller behind this policy answers that question only for callers who got past
  // it.
  if (!course?.instructor) {
    return false;
  }

  // Users are keyed by numeric id, not documentId, so both sides of this comparison
  // are integers. A `==` here would also match a string id from a hand-rolled query;
  // strict equality means a type mismatch fails closed instead of accidentally
  // passing.
  return course.instructor.id === user.id;
};
