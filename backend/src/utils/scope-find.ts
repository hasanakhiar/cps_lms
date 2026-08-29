/**
 * Structural shape of the bits of the Koa context this helper touches. Declared
 * locally rather than imported so the helper stays independent of Strapi's
 * controller typings, and so it is obvious at a glance that nothing else on the
 * context is read or written.
 */
type ScopableContext = {
  state: { user?: { id: number; role?: { type?: string } } };
  query: Record<string, unknown>;
};

/**
 * The three content types where every row belongs to exactly one student.
 */
type ScopableUid =
  | 'api::enrollment.enrollment'
  | 'api::lesson-completion.lesson-completion'
  | 'api::quiz-attempt.quiz-attempt';

/**
 * Restrict a collection `find` to the rows owned by the calling student.
 *
 * Applies to `enrollment`, `lesson-completion` and `quiz-attempt` — the three
 * content types where every row belongs to exactly one student and no student has
 * any business reading another's.
 *
 * Three things matter here, and each is easy to get subtly wrong.
 *
 * **The filter is overwritten, not merged.** Merging our clause into a
 * caller-supplied `filters` object looks safer than it is: Strapi's query parser
 * supports `$or`, so a request carrying
 * `?filters[$or][0][student][id][$notNull]=true` merges into a predicate that is
 * satisfied by every row on the platform. There is no way to combine an
 * allow-list with arbitrary client input and still reason about the result, so the
 * client's filters are discarded outright.
 *
 * **The rows are resolved first, and the filter is by primary key.** The obvious
 * filter is `{ student: user.id }`, and that is what this helper used to write. It
 * does not survive the content API: `student` targets
 * `plugin::users-permissions.user`, and Strapi's query validator rejects a filter
 * path into a content type the caller has no read permission on — the request comes
 * back `400 Invalid key student` rather than unscoped rows. It fails safe, but it
 * fails. Granting students `users-permissions.user.find` would make the filter legal
 * at the cost of exposing the user list, which is the wrong half of the trade. So
 * ownership is resolved here with the Query Engine, which is not subject to the
 * content API's permission-aware validation, and the caller-visible query filters on
 * `documentId` — a plain scalar the validator is happy with.
 *
 * That costs one extra query and holds the caller's own row ids in memory. At one
 * row per enrolment and per completed lesson, per student, that is a list of tens.
 * If a student could ever have tens of thousands, this would need to become a
 * `findMany` on the Query Engine plus a hand-rolled `transformResponse` instead.
 *
 * An empty result yields `{ $in: [] }`, which matches nothing. That is the correct
 * answer for a student who owns no rows — and it is worth being explicit about,
 * because the failure mode of the alternative (dropping the filter when there is
 * nothing to filter by) would return the whole table.
 *
 * **The populate tree is rebuilt server-side.** `?populate=*` on an enrollment
 * walks the `student` relation, and a deep populate can be chained from there onto
 * data belonging to other people. `sanitizeOutput` would strip password hashes,
 * but "the sanitizer happens to catch it" is not an access-control model. The
 * caller's populate is replaced with an explicit tree per route.
 *
 * Staff are left alone deliberately: admins need the unscoped view for the admin
 * screens, and their routes are gated by role permissions instead.
 */
export async function scopeFindToOwnStudentRows(
  ctx: ScopableContext,
  uid: ScopableUid,
  populate: Record<string, unknown>
): Promise<void> {
  const user = ctx.state.user;
  if (user?.role?.type !== 'student') {
    return;
  }

  // Users are not documents — the users-permissions plugin predates the Document
  // Service — so the ownership join is on the numeric user id.
  const ownRows = await strapi.db.query(uid).findMany({
    where: { student: { id: user.id } },
    select: ['documentId'],
  });

  ctx.query = {
    ...ctx.query,
    filters: { documentId: { $in: ownRows.map((row: { documentId: string }) => row.documentId) } },
    populate,
  };
}
