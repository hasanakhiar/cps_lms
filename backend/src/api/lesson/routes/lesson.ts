import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::lesson.lesson', {
  config: {
    find: { policies: [] },
    findOne: { policies: ['global::is-authenticated'] },
    create: { policies: ['global::is-authenticated', 'api::lesson.can-manage-lesson'] },
    update: { policies: ['global::is-authenticated', 'api::lesson.can-manage-lesson'] },
    delete: { policies: ['global::is-authenticated', 'api::lesson.can-manage-lesson'] }
  }
});
