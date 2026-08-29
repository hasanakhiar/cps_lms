import { factories } from '@strapi/strapi';

/**
 * The core service for courses.
 *
 * Strapi's core *controller* falls back to a generated implementation when an api
 * folder does not supply one, but the core *service* does not: `strapi.service(uid)`
 * returns `undefined` if no service file was registered, and the core controller's
 * `find` then dies on `strapi.service(uid).find(...)` with a 500.
 *
 * These content types were authored by writing `schema.json` by hand rather than
 * through `strapi generate api`, which is what would normally have created this file
 * — so it has to be written explicitly. It is one line because there is no
 * course-specific business logic here: the controller does the hardening, the
 * policies do the authorisation, and the service stays the stock CRUD layer.
 */
export default factories.createCoreService('api::course.course');
