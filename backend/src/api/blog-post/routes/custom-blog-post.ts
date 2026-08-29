export default {
  routes: [
    {
      method: 'POST',
      path: '/blog-posts/:id/unpublish',
      handler: 'custom-blog-post.unpublish',
      config: {
        policies: [
          'global::is-authenticated',
          { name: 'global::has-role', config: { roles: ['admin', 'content-manager'] } },
        ],
      },
    },
  ],
};
