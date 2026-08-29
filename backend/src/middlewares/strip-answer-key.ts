import type { Core } from '@strapi/strapi';

/**
 * `global::strip-answer-key` — the last line of defence for leak test 5.
 *
 * `isCorrect` lives on the `quiz.option` component, which means it can be reached
 * through *any* route that populates its way down to a quiz. The quiz controller
 * handles its own routes precisely, but a component is reachable by more paths than
 * one controller can see:
 *
 *   GET /api/lessons/:id?populate[course][populate][quizzes][populate][questions][populate][options]=*
 *
 * That request never touches the quiz controller. Every controller that populates a
 * relation is therefore a potential path to the answer key, and "remember to strip it
 * in each one" is a rule that holds until the next controller is written.
 *
 * So it is stripped once, here, on the way out. The controllers still do their own
 * checks — this is a net, not a replacement for them — but the net is what makes the
 * guarantee "no student response ever contains `isCorrect`" true of the whole API
 * rather than of the routes someone remembered.
 *
 * Leak test 5 greps the raw response text rather than a parsed field, which is exactly
 * the right way to test this: it does not care which route or which nesting depth put
 * the string there.
 */

/** Roles that legitimately need the answer key in order to author and review quizzes. */
const AUTHORING_ROLES = new Set(['admin', 'content-manager', 'instructor']);

/**
 * Recursively delete `isCorrect` from a response body.
 *
 * Keyed on the property name rather than on a known shape. The shape varies —
 * `data.questions[].options[]` on a quiz, but arbitrarily deeper when a quiz is reached
 * through a chain of populates — and matching on the name is the one thing that stays
 * true regardless of the path taken to get there.
 *
 * Mutates in place. Rebuilding the object would mean re-serialising the whole response
 * to remove a boolean, and the body is about to be discarded anyway.
 */
const stripIsCorrect = (node: unknown): void => {
  if (Array.isArray(node)) {
    for (const item of node) {
      stripIsCorrect(item);
    }
    return;
  }

  // `typeof null === 'object'`, so the null check comes first. Dates and Buffers also
  // pass `typeof === 'object'`; recursing into them is harmless because they have no
  // `isCorrect` key, and special-casing them would be more code for no behaviour.
  if (node === null || typeof node !== 'object') {
    return;
  }

  const record = node as Record<string, unknown>;

  if ('isCorrect' in record) {
    delete record.isCorrect;
  }

  for (const value of Object.values(record)) {
    stripIsCorrect(value);
  }
};

const middleware = (_config: unknown, { strapi }: { strapi: Core.Strapi }): Core.MiddlewareHandler => {
  // Read the content-API prefix from config rather than hardcoding `/api`, so that
  // changing `api.rest.prefix` cannot silently disable this middleware.
  const apiPrefix: string = strapi.config.get('api.rest.prefix', '/api');

  return async (ctx, next) => {
    await next();

    // Only content-API routes. The Strapi admin panel is served from its own prefix
    // and authenticates with the admin strategy, so its users have no `role.type` from
    // our four-role set and would all be treated as students by the check below —
    // which would strip `isCorrect` out of the quiz editor and make quizzes
    // unauthorable from the panel.
    if (!ctx.request.url.startsWith(apiPrefix)) {
      return;
    }

    const role = ctx.state.user?.role?.type;
    if (role && AUTHORING_ROLES.has(role)) {
      return;
    }

    // Everyone else: anonymous callers and every student.
    stripIsCorrect(ctx.body);
  };
};

export default middleware;
