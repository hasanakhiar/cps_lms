import { factories } from '@strapi/strapi';

/**
 * The core service for `enrollment`. See `api/course/services/course.ts` for why every
 * hand-authored api needs this file: without it `strapi.service(uid)` is
 * `undefined` and the core controller 500s instead of serving CRUD.
 */
export default factories.createCoreService('api::enrollment.enrollment');
