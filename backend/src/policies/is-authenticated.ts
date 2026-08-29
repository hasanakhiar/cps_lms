import type { PolicyContext } from '../types/api-context';

/**
 * `global::is-authenticated` — is there a session at all?
 *
 * The narrowest possible policy, and the first entry in every custom route's
 * `policies` array. Its only job is to turn "no valid JWT" into 403 before any
 * handler runs, so that the handlers downstream can treat `ctx.state.user` as
 * guaranteed rather than checking for it individually.
 *
 * Note what this does *not* do: it says nothing about what the user may do. Layering
 * it with `has-role` and the ownership policies is deliberate — each answers one
 * question, and a route's `policies` array reads as the list of conditions it
 * requires.
 */
export default (policyContext: PolicyContext): boolean => Boolean(policyContext.state.user);
