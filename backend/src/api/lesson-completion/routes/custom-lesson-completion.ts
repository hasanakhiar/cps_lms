export default {
  routes: [
    {
      method: 'POST',
      path: '/lessons/:id/complete',
      handler: 'lesson-completion.complete',
      config: {
        policies: [
          'global::is-authenticated',
          { name: 'global::has-role', config: { roles: ['student'] } },
          { name: 'api::enrollment.is-enrolled', config: { resource: 'lesson' } },
        ],
      },
    },
    {
      method: 'DELETE',
      path: '/lessons/:id/complete',
      handler: 'lesson-completion.uncomplete',
      config: {
        policies: [
          'global::is-authenticated',
          { name: 'global::has-role', config: { roles: ['student'] } },
          { name: 'api::enrollment.is-enrolled', config: { resource: 'lesson' } },
        ],
      },
    },
  ],
};
