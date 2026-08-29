import type { HasRoleConfig, PolicyContext } from '../types/api-context';

/**
 * `global::has-role` — is the caller one of the roles this route accepts?
 *
 * Configured per route rather than per policy, so there is one implementation instead
 * of four near-identical `is-student` / `is-instructor` / `is-admin` files:
 *
 *   { name: 'global::has-role', config: { roles: ['admin', 'content-manager'] } }
 *
 * The role is read from `ctx.state.user.role.type`, which the users-permissions JWT
 * strategy populates via `fetchAuthenticatedUser`. It is never read from the request:
 * the JWT carries only a user id, and the role is resolved from the database on every
 * request, so a role change takes effect immediately rather than when the token
 * expires.
 *
 * Fails closed twice over. No user or no role is a denial, and so is a route that
 * forgot its `config.roles` — an empty list matches nobody. The failure mode of a
 * misconfigured route is therefore "nobody can use this feature", which shows up
 * immediately, rather than "everybody can", which does not.
 */
export default (policyContext: PolicyContext, config: HasRoleConfig): boolean => {
  const role = policyContext.state.user?.role?.type;
  if (!role) return false;

  const allowed = config?.roles ?? [];
  return allowed.includes(role);
};
