import { factories } from '@strapi/strapi';
import { withPriorityRoutes } from '../../../utils/priority-router';

const coreRouter = factories.createCoreRouter('api::course.course', {
  config: {
    find: { policies: [] },
    findOne: { policies: [] },
    create: {
      policies: [
        'global::is-authenticated',
        { name: 'global::has-role', config: { roles: ['admin', 'content-manager', 'instructor'] } }
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
