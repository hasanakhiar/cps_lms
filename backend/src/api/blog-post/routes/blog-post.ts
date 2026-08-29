import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::blog-post.blog-post', {
  config: {
    find: { policies: [] },
    findOne: { policies: [] },
    create: {
      policies: [
        'global::is-authenticated',
        { name: 'global::has-role', config: { roles: ['admin', 'content-manager'] } }
      ]
    },
    update: {
      policies: [
        'global::is-authenticated',
        { name: 'global::has-role', config: { roles: ['admin', 'content-manager'] } }
      ]
    },
    delete: {
      policies: [
        'global::is-authenticated',
        { name: 'global::has-role', config: { roles: ['admin', 'content-manager'] } }
      ]
    }
  }
});
