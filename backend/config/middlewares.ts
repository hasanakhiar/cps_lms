import type { Core } from '@strapi/strapi';

const config = ({
  env,
}: Core.Config.Shared.ConfigParams): Core.Config.Middlewares => [
  'strapi::logger',
  'strapi::errors',
  'strapi::security',
  {
    name: 'strapi::cors',
    config: {
      origin: [env('FRONTEND_URL', 'http://localhost:3000')],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
      headers: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
      keepHeaderOnError: true,
      credentials: true, // Allow credentials/cookies
      maxAge: 31536000, // 1 year
    },
  },
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
  // Strips `isCorrect` from every content-API response to a student or anonymous
  // caller, on the way out, regardless of which route produced it. The quiz controller
  // also does this precisely for its own routes; this catches the paths that reach the
  // `quiz.option` component through someone else's populate. See
  // `src/middlewares/strip-answer-key.ts`.
  'global::strip-answer-key',
];

export default config;
