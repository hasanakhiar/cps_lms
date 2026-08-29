import type { Core } from '@strapi/strapi';

/**
 * The shape `factories.createCoreRouter` actually returns.
 *
 * Strapi declares this router's `routes` as `Route[] | (() => Route[])`, and its
 * `Route` here is a much looser `{ method, path }` than the `Core.Route` used
 * elsewhere in the same package. Rather than pick a side between two of Strapi's
 * own contradictory declarations, the core router's routes are treated as opaque
 * and passed straight through — they are Strapi's own objects and Strapi is the
 * only consumer. The routes *this* project authors are typed strictly, as
 * `Core.RouteInput[]`, because those are the ones a typo would break.
 */
type CoreRouterLike = {
  type?: Core.RouterType;
  prefix?: string;
  readonly routes: readonly unknown[] | (() => readonly unknown[]);
};

/**
 * Merge static custom routes *ahead* of a core router's generated routes, inside
 * a single router with one explicitly ordered array.
 *
 * Why this exists. Strapi hands every route to @koa/router, which resolves a
 * request to the **first** registered layer that matches. A static path such as
 * `/courses/teaching` also matches the core router's `/courses/:id`, so whichever
 * of the two registers first wins outright. Strapi derives that registration order
 * from `fs.readdir()` of the api's `routes/` directory — see `loadDir` in
 * `@strapi/core/dist/loaders/apis.js`, which iterates the readdir result straight
 * into an object, and `registerAPIRoutes`, which then walks
 * `Object.values(api.routes)`.
 *
 * readdir order is not specified. On the macOS APFS volume this repo is developed
 * on it comes back alphabetical, so `course.ts` (core) registers before
 * `custom-course.ts` and `GET /api/courses/teaching` is swallowed by `findOne` as
 * `documentId: "teaching"`, returning 404. On another filesystem the order could
 * flip and it would appear to work. Either way the behaviour would be decided by
 * the filesystem rather than by the code — the kind of defect that only shows up
 * after deploying.
 *
 * Collapsing both sets into one array makes precedence a property of this file.
 *
 * The merged array is memoised deliberately. Strapi reads `router.routes` three
 * separate times while registering: once to stamp `config.auth.scope` onto each
 * route, once to apply the content-API query params, and once to mount. Each read
 * mutates the array it is handed. A getter that rebuilt the array on every access
 * would hand out three different arrays and discard the first two sets of
 * mutations — leaving every route with no auth scope at all.
 */
export function withPriorityRoutes(priorityRoutes: Core.RouteInput[], coreRouter: CoreRouterLike) {
  let merged: unknown[] | undefined;

  return {
    type: coreRouter.type ?? ('content-api' as const),
    prefix: coreRouter.prefix,
    get routes(): unknown[] {
      merged ??= [
        ...priorityRoutes,
        ...(typeof coreRouter.routes === 'function' ? coreRouter.routes() : coreRouter.routes),
      ];
      return merged;
    },
  };
}
