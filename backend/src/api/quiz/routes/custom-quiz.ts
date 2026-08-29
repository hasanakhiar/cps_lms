export default {
  routes: [
    {
      method: 'POST',
      path: '/quizzes/:id/submit',
      handler: 'custom-quiz.submit',
      config: {
        policies: [
          'global::is-authenticated',
          { name: 'global::has-role', config: { roles: ['student'] } },
          { name: 'api::enrollment.is-enrolled', config: { resource: 'quiz' } },
        ],
      },
    },
  ],
};
