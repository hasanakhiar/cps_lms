import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::quiz.quiz', {
  config: {
    find: { policies: ['global::is-authenticated'] },
    findOne: { policies: ['global::is-authenticated'] },
    create: { policies: ['global::is-authenticated', 'api::quiz.can-manage-quiz'] },
    update: { policies: ['global::is-authenticated', 'api::quiz.can-manage-quiz'] },
    delete: { policies: ['global::is-authenticated', 'api::quiz.can-manage-quiz'] }
  }
});
