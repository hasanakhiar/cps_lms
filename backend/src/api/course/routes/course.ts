import { factories } from '@strapi/strapi';
import { withPriorityRoutes } from '../../../utils/priority-router';

const coreRouter = factories.createCoreRouter('api::course.course', {
  config: {
    find: { policies: [] },
    findOne: { policies: [] },
    // Creating a course is a catalogue decision, so it belongs to the two roles that
    // own the catalogue. An instructor still edits and deletes any course they own —
    // `update` and `delete` below are unchanged — but the course itself is brought
    // into existence by an admin or a content manager.
    create: {
      policies: [
        'global::is-authenticated',
        { name: 'global::has-role', config: { roles: ['admin', 'content-manager'] } }
      ]
    },
    update: {
      policies: ['global::is-authenticated', 'api::course.is-course-owner-or-manager']
    },
    delete: {
      policies: ['global::is-authenticated', 'api::course.is-course-owner-or-manager']
    }
  }
});

// `/courses/teaching` is static but also matches the core `/courses/:id`, so it
// has to be registered first. See `withPriorityRoutes` for why this cannot be
// left to file ordering.
export default withPriorityRoutes(
  [
    {
      method: 'GET',
      path: '/courses/teaching',
      handler: 'custom-course.teaching',
      config: {
        policies: [
          'global::is-authenticated',
          {
            name: 'global::has-role',
            config: { roles: ['admin', 'content-manager', 'instructor'] }
          }
        ]
      }
    }
  ],
  coreRouter
);
