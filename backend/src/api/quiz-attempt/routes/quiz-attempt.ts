import { factories } from '@strapi/strapi';
import { withPriorityRoutes } from '../../../utils/priority-router';

const coreRouter = factories.createCoreRouter('api::quiz-attempt.quiz-attempt', {
  config: {
    find: { policies: ['global::is-authenticated'] },
    findOne: { policies: ['global::is-authenticated'] },
    create: { policies: ['global::is-authenticated'] },
    update: { policies: ['global::is-authenticated'] },
    delete: { policies: ['global::is-authenticated'] }
  }
});

// `/quiz-attempts/me` would otherwise be read as `/quiz-attempts/:id` with
// `documentId: "me"`.
export default withPriorityRoutes(
  [
    {
      method: 'GET',
      path: '/quiz-attempts/me',
      handler: 'custom-quiz-attempt.myAttempts',
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
