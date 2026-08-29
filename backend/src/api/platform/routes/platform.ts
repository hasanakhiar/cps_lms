export default {
  routes: [
    {
      method: 'GET',
      path: '/me',
      handler: 'platform.me',
      config: {
        policies: ['global::is-authenticated'],
      },
    },
    {
      method: 'GET',
      path: '/platform/stats',
      handler: 'platform.stats',
      config: {
        policies: [
          'global::is-authenticated',
          { name: 'global::has-role', config: { roles: ['admin'] } },
        ],
      },
    },
    {
      method: 'GET',
      path: '/platform/users',
      handler: 'platform.users',
      config: {
        policies: [
          'global::is-authenticated',
          { name: 'global::has-role', config: { roles: ['admin'] } },
        ],
      },
    },
    {
      method: 'PUT',
      path: '/platform/users/:id/role',
      handler: 'platform.setUserRole',
      config: {
        policies: [
          'global::is-authenticated',
          { name: 'global::has-role', config: { roles: ['admin'] } },
        ],
      },
    },
  ],
};
