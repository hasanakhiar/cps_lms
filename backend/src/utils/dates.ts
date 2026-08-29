/**
 * Normalise a Strapi `datetime` attribute to an ISO 8601 string.
 *
 * Strapi types these attributes as `Date | string` because what comes back depends on
 * the driver, not on the schema: node-postgres parses timestamp columns into `Date`
 * objects, while the SQLite driver hands back the text it stored. Strapi's own REST
 * controllers hide that behind a serialisation layer — but a response assembled by
 * hand, as `/api/enrollments/me` and `/api/quiz-attempts/me` are, has no such layer and
 * would ship whichever shape the local database happened to produce.
 *
 * That is a difference which only appears after deploying: dates render fine against
 * SQLite locally and arrive in a different format from Postgres in production. Picking
 * one format here, in one function, removes the question.
 *
 * ISO 8601 is the pick because it is what `JSON.stringify` produces from a `Date`
 * anyway — so nothing on the wire changes for the Postgres case — and because it
 * carries an explicit timezone, which SQLite's `"2026-01-01 09:00:00"` does not.
 */
export const toIsoString = (value: Date | string | null | undefined): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  // An unparseable value produces `Invalid Date`, and `Invalid Date.toISOString()`
  // throws a RangeError. Returning `null` instead means one malformed row degrades to a
  // missing date rather than turning a whole list response into a 500.
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};
