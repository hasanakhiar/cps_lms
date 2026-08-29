import { factories } from '@strapi/strapi';
import { withPriorityRoutes } from '../../../utils/priority-router';

const coreRouter = factories.createCoreRouter('api::enrollment.enrollment', {
  config: {
    find: { policies: ['global::is-authenticated'] },
    findOne: { policies: ['global::is-authenticated'] },
    create: { policies: ['global::is-authenticated'] },
    update: { policies: ['global::is-authenticated'] },
    delete: { policies: ['global::is-authenticated'] }
  }
});

// `/enrollments/me` would otherwise be read as `/enrollments/:id` with
// `documentId: "me"`.
export default withPriorityRoutes(
  [
    {
      method: 'GET',
      path: '/enrollments/me',
      handler: 'custom-enrollment.myEnrollments',
      config: {
        policies: [
          'global::is-authenticated',
          { name: 'global::has-role', config: { roles: ['student'] } }
        ]
      }
    }
  ],
  coreRouter
);
