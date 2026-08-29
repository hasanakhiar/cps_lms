export default {
  routes: [
    {
      method: 'POST',
      path: '/courses/:id/enroll',
      handler: 'custom-course.enroll',
      config: {
        policies: [
          'global::is-authenticated',
          { name: 'global::has-role', config: { roles: ['student'] } },
        ],
      },
    },
    {
      method: 'GET',
      path: '/courses/:id/progress',
      handler: 'custom-course.myProgress',
      config: {
        policies: [
          'global::is-authenticated',
          { name: 'global::has-role', config: { roles: ['student'] } },
          { name: 'api::enrollment.is-enrolled', config: { resource: 'course' } },
        ],
      },
    },
    {
      method: 'GET',
      path: '/courses/:id/students',
      handler: 'custom-course.students',
      config: {
        policies: [
          'global::is-authenticated',
          'api::course.is-course-owner-or-manager',
        ],
      },
    },
    // `GET /courses/teaching` lives in `course.ts`, ahead of the core routes,
    // because it collides with `/courses/:id`.
  ],
};
