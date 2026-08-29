/**
 * Context types for hand-written controllers and policies.
 *
 * Strapi's published typings do not describe the controller context: `Core.Strapi`
 * is typed, and so is the Koa context, but the response helpers Strapi bolts on
 * (`ctx.badRequest`, `ctx.forbidden`, …) are added by middleware at runtime and are
 * absent from `@strapi/types`. The usual workaround is `ctx: any`, which throws away
 * type checking on `ctx.state.user` — the single most security-relevant value in the
 * whole request.
 *
 * So the surface is declared here instead: only the members these controllers
 * actually touch, spelled out once. It is narrower than the real context on purpose.
 * If a controller reaches for something new, it has to be added here first, which is
 * a useful moment to think about it.
 */

/** The four roles the bootstrap creates. Anything else is a bug. */
export type RoleType = 'admin' | 'content-manager' | 'instructor' | 'student';

/**
 * A row's numeric primary key, as Strapi types it.
 *
 * Strapi declares this as `string | number` (`Data.ID`) because different database
 * drivers return integer keys differently — SQLite and Postgres both back these
 * columns with integers, but the type has to cover drivers that hand back strings.
 * There is no runtime coercion here on purpose: the value is only ever passed back
 * into a query `where` clause, where the driver compares it against the same column it
 * came from. Narrowing it with `Number()` would introduce a conversion that could fail
 * silently on a driver where the string form is the correct one.
 */
export type EntityId = string | number;

/**
 * `ctx.state.user` as populated by the users-permissions JWT strategy.
 *
 * `id` is numeric. Users are not documents in Strapi 5 — the users-permissions
 * plugin predates the Document Service and still keys on the integer primary key —
 * so every relation to a user, and every `strapi.db.query` `where` clause against
 * one, uses this rather than a `documentId`.
 */
export type AuthenticatedUser = {
  id: number;
  username: string;
  email: string;
  role?: { id: number; type: RoleType; name: string };
};

/**
 * Strapi's response helpers. Each one sets the status and body and returns a value
 * suitable for returning straight out of a controller.
 */
type ResponseHelpers = {
  badRequest(message?: string, details?: unknown): unknown;
  unauthorized(message?: string, details?: unknown): unknown;
  forbidden(message?: string, details?: unknown): unknown;
  notFound(message?: string, details?: unknown): unknown;
  internalServerError(message?: string, details?: unknown): unknown;
};

/** A request that has passed `is-authenticated`, so `user` is guaranteed present. */
export type AuthenticatedContext = ResponseHelpers & {
  state: { user: AuthenticatedUser };
  params: Record<string, string>;
  query: Record<string, unknown>;
  request: { body?: Record<string, unknown> };
};

/** A request that may or may not be authenticated. */
export type MaybeAuthenticatedContext = ResponseHelpers & {
  state: { user?: AuthenticatedUser };
  params: Record<string, string>;
  query: Record<string, unknown>;
  request: { body?: Record<string, unknown> };
};

/**
 * The first argument every policy receives.
 *
 * A policy runs *before* the controller and answers one question — may this request
 * proceed — by returning a boolean. It has no response helpers, which is the point:
 * a policy cannot shape a response, only permit or deny one, and Strapi turns `false`
 * into 403 on its behalf.
 *
 * `user` is optional here even on routes that pair the policy with
 * `global::is-authenticated`. Policy order is a property of the route config, which
 * is a different file, so a policy that assumed a user would be one edit away from
 * dereferencing `undefined` and returning 500 where it should have returned 403.
 * Every policy below therefore checks.
 */
export type PolicyContext = {
  state: { user?: AuthenticatedUser };
  params: Record<string, string>;
  request: {
    method: string;
    /**
     * Strapi's REST convention nests the payload under `data`. Typed loosely because
     * policies read it to find out *what* is being written before anything has
     * validated it — this is untrusted input by definition.
     */
    body?: { data?: Record<string, unknown> };
  };
};

/** Config for `global::has-role`, supplied per route. */
export type HasRoleConfig = { roles?: readonly RoleType[] };

/** Config for `api::enrollment.is-enrolled`, supplied per route. */
export type IsEnrolledConfig = { resource?: 'course' | 'lesson' | 'quiz' };
