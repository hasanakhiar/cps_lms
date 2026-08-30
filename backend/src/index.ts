import type { Core } from '@strapi/strapi';

/**
 * LMS Bootstrap — runs on every Strapi boot.
 *
 * Everything here is IDEMPOTENT: deleting the database and restarting produces
 * a working system; restarting again changes nothing. This is critical because
 * Railway runs bootstrap on every deploy.
 *
 * Order matters — each step depends on the one before it:
 * 1. Roles must exist before permissions reference them
 * 2. Permissions must exist before seeded users can exercise them
 * 3. Users must exist before content can reference them as instructors/students
 * 4. Courses must exist before lessons and enrollments reference them
 */
export default {
  /**
   * Nothing to do at register time. All of this application's setup needs the database
   * — roles, permissions, seed content — and the database is not connected until
   * bootstrap.
   */
  register() {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    console.log('🚀 LMS Bootstrap starting...');

    const summary: Record<string, string | number> = {
      'Roles': 0,
      'Permissions': 0,
      'Users': 0,
      'Courses': 0,
      'Lessons': 0,
      'Quizzes': 0,
      'Blog Posts': 0,
      'Enrollments': 0,
      'Completions': 0,
    };

    // ───────────────────────────────────────────────────────────
    // 1. ROLES — Create the four application roles if absent.
    //    These are users-permissions roles, NOT Strapi admin roles.
    //    We branch on `type` (immutable slug) never `name` (editable).
    // ───────────────────────────────────────────────────────────
    const roleDefinitions = [
      { name: 'Admin', type: 'admin', description: 'Full platform access' },
      { name: 'Content Manager', type: 'content-manager', description: 'Manages all courses and blog content' },
      { name: 'Instructor', type: 'instructor', description: 'Manages own courses only' },
      { name: 'Student', type: 'student', description: 'Enrolls in courses and takes quizzes' },
    ];

    const roles: Record<string, { id: number; type: string }> = {};

    for (const def of roleDefinitions) {
      let role = await strapi.db.query('plugin::users-permissions.role').findOne({
        where: { type: def.type },
      });

      if (!role) {
        role = await strapi.db.query('plugin::users-permissions.role').create({
          data: def,
        });
        (summary['Roles'] as number)++;
      }
      roles[def.type] = role;
    }

    // Public role (created by Strapi automatically)
    const publicRole = await strapi.db.query('plugin::users-permissions.role').findOne({
      where: { type: 'public' },
    });
    if (publicRole) roles['public'] = publicRole;

    // ───────────────────────────────────────────────────────────
    // 2. REGISTRATION DEFAULTS — Everyone becomes a student at
    //    signup. The registration request has no role field to
    //    tamper with, so privilege escalation at signup is
    //    structurally impossible rather than merely blocked.
    // ───────────────────────────────────────────────────────────
    const pluginStore = strapi.store({
      type: 'plugin',
      name: 'users-permissions',
    });

    const advanced = await pluginStore.get({ key: 'advanced' });
    await pluginStore.set({
      key: 'advanced',
      value: {
        ...(advanced as object),
        allow_register: true,
        default_role: 'student',
        email_confirmation: false,
      },
    });

    // ───────────────────────────────────────────────────────────
    // 3. PERMISSIONS — Grant route permissions per role.
    //
    // These action IDs are not free-form strings: Strapi derives them from the
    // route's `handler`. `createRouteScopeGenerator` in
    // @strapi/core/dist/services/server/register-routes.js builds
    // `api::<apiName>.<handler>`, so a route whose handler is
    // `custom-course.enroll` inside the `course` api gets the action
    // `api::course.custom-course.enroll` — the *controller file name*, not the
    // content type name. Getting this wrong does not error; the route simply has
    // no matching permission row and returns 403 for every role, which is a
    // miserable thing to debug. Each custom entry below is annotated with the
    // route it unlocks.
    //
    // Composed rather than copy-pasted so that "content-manager is instructor
    // plus blog" is enforced by the code instead of by careful editing.
    // ───────────────────────────────────────────────────────────
    const publicActions = [
      'api::course.course.find',
      'api::course.course.findOne',
      'api::lesson.lesson.find',
      'api::blog-post.blog-post.find',
      'api::blog-post.blog-post.findOne',
    ];

    // Every signed-in role needs to resolve its own identity and role.
    const meAction = 'api::platform.platform.me'; // GET /api/me

    const studentActions = [
      ...publicActions,
      meAction,
      'api::course.custom-course.enroll', // POST   /api/courses/:id/enroll
      'api::course.custom-course.myProgress', // GET    /api/courses/:id/progress
      'api::enrollment.custom-enrollment.myEnrollments', // GET    /api/enrollments/me
      // GET /api/enrollments — reachable, and safe because it is reachable.
      //
      // `/enrollments/me` is the endpoint the frontend actually uses; this generic one
      // is granted so that leak test 3 exercises a route a student can really call.
      // The controller overwrites `filters` with `{ student: <session id> }` before the
      // query runs, so `?populate=*` returns the caller's own rows and nothing else.
      // Withholding the permission would hide that hardening rather than prove it, and
      // the permission table is editable from the Strapi admin panel — the route has to
      // be safe on its own terms either way.
      'api::enrollment.enrollment.find',
      'api::lesson.lesson.findOne',
      'api::quiz.quiz.findOne',
      // Granted so that the *relation* survives, not so the route can be called.
      //
      // `sanitizeOutput` drops a populated relation when the caller has no read
      // permission on the target content type — which is why an anonymous
      // `/api/courses` response has no `instructor`. Without this, the quizzes
      // populated onto `course.findOne` disappear for students and the course page
      // cannot list what a course assesses.
      //
      // Calling `GET /api/quizzes` directly is still refused: `quiz.find` returns 403
      // for any role that is not instructor, content-manager or admin, because a quiz
      // list is an answer-key list. So this permission widens what a student may see
      // *through a course*, and nothing else.
      'api::quiz.quiz.find',
      'api::quiz.custom-quiz.submit', // POST   /api/quizzes/:id/submit
      'api::quiz-attempt.custom-quiz-attempt.myAttempts', // GET    /api/quiz-attempts/me
      'api::lesson-completion.lesson-completion.complete', // POST   /api/lessons/:id/complete
      'api::lesson-completion.lesson-completion.uncomplete', // DELETE /api/lessons/:id/complete
    ];

    const instructorActions = [
      ...publicActions,
      meAction,
      // `api::course.course.create` is deliberately absent — see
      // `contentManagerActions`. Instructors manage courses they own; they do not
      // add courses to the catalogue.
      'api::course.course.update',
      'api::course.course.delete',
      'api::lesson.lesson.findOne',
      'api::lesson.lesson.create',
      'api::lesson.lesson.update',
      'api::lesson.lesson.delete',
      'api::quiz.quiz.find',
      'api::quiz.quiz.findOne',
      'api::quiz.quiz.create',
      'api::quiz.quiz.update',
      'api::quiz.quiz.delete',
      'api::course.custom-course.teaching', // GET /api/courses/teaching
      'api::course.custom-course.students', // GET /api/courses/:id/students
    ];

    const contentManagerActions = [
      ...instructorActions,
      // Catalogue authorship starts here rather than in `instructorActions`, so the
      // permission table and the route policy in `course.ts` say the same thing. The
      // route would refuse an instructor either way; a permission they can never use
      // would just be a lie in the table.
      'api::course.course.create',
      'api::blog-post.blog-post.create',
      'api::blog-post.blog-post.update',
      'api::blog-post.blog-post.delete',
      // POST /api/blog-posts/:id/unpublish — see the controller for why the content
      // API cannot express this and a custom route is needed.
      'api::blog-post.custom-blog-post.unpublish',
    ];

    const adminActions = [
      ...contentManagerActions,
      'api::platform.platform.stats', // GET /api/platform/stats
      'api::platform.platform.users', // GET /api/platform/users
      'api::platform.platform.setUserRole', // PUT /api/platform/users/:id/role
      // Admin screens list every enrollment and attempt, not just their own.
      'api::enrollment.enrollment.find',
      'api::enrollment.enrollment.findOne',
      'api::quiz-attempt.quiz-attempt.find',
      'api::quiz-attempt.quiz-attempt.findOne',
    ];

    const permissionsMap: Record<string, string[]> = {
      public: publicActions,
      student: studentActions,
      instructor: instructorActions,
      'content-manager': contentManagerActions,
      admin: adminActions,
    };

    // Explicitly NEVER granted to any role. `plugin::users-permissions.user.update` is
    // the generic `PUT /api/users/:id`, and granting it to any role would hand that
    // role the ability to write its own `role` field — self-promotion to admin in one
    // request. `.destroy` is the same shape of hole for deletion. Role changes go
    // through `PUT /api/platform/users/:id/role` instead, which is admin-only and
    // refuses self-demotion and last-admin demotion.
    //
    // This is asserted rather than filtered. An earlier version skipped forbidden
    // actions silently with `continue`, which meant that adding one to the map above by
    // mistake would look like it had been granted while quietly doing nothing — the
    // list would stop describing reality and nobody would find out. Throwing means the
    // application refuses to boot, which is the only failure mode that cannot be
    // ignored.
    const FORBIDDEN_ACTIONS = [
      'plugin::users-permissions.user.update',
      'plugin::users-permissions.user.destroy',
    ];

    for (const [roleType, actions] of Object.entries(permissionsMap)) {
      const forbidden = actions.filter((action) => FORBIDDEN_ACTIONS.includes(action));
      if (forbidden.length > 0) {
        throw new Error(
          `Refusing to boot: role "${roleType}" would be granted forbidden action(s) ` +
            `${forbidden.join(', ')}. These allow privilege escalation and must never be granted. ` +
            `Use PUT /api/platform/users/:id/role instead.`
        );
      }
    }

    for (const [roleType, actions] of Object.entries(permissionsMap)) {
      const role = roles[roleType];
      if (!role) continue;

      for (const action of actions) {
        // Upsert, not insert. The bootstrap runs on every boot, so a plain create would
        // fail on the second boot with a duplicate row.
        const existing = await strapi.db.query('plugin::users-permissions.permission').findOne({
          where: { action, role: role.id },
          select: ['id'],
        });

        if (!existing) {
          await strapi.db.query('plugin::users-permissions.permission').create({
            data: { action, role: role.id },
          });
          (summary['Permissions'] as number)++;
        }
      }
    }

    // ───────────────────────────────────────────────────────────
    // 4. SEED DATA — Only when SEED_DEMO_DATA=true AND the user
    //    table is empty. This prevents duplicates on redeploy.
    // ───────────────────────────────────────────────────────────
    const shouldSeed = process.env.SEED_DEMO_DATA === 'true';
    const demoPassword = process.env.DEMO_USER_PASSWORD;

    if (shouldSeed && demoPassword) {
      const userCount = await strapi.db.query('plugin::users-permissions.user').count();

      if (userCount === 0) {
        console.log('📦 Seeding demo data...');

        // Create demo users
        const userDefs = [
          { username: 'admin', email: 'admin@lms.test', roleType: 'admin' },
          { username: 'manager', email: 'manager@lms.test', roleType: 'content-manager' },
          { username: 'instructor', email: 'instructor@lms.test', roleType: 'instructor' },
          { username: 'instructor2', email: 'instructor2@lms.test', roleType: 'instructor' },
          { username: 'student', email: 'student@lms.test', roleType: 'student' },
          { username: 'student2', email: 'student2@lms.test', roleType: 'student' },
        ];

        const users: Record<string, { id: number }> = {};

        for (const u of userDefs) {
          const role = roles[u.roleType];
          if (!role) continue;

          // Go through the users-permissions `user` service rather than the Query
          // Engine: the service runs `ensureHashedPasswords`, so `password` is
          // bcrypt-hashed on the way in. A raw `db.query().create()` would store
          // the plaintext and every demo login would then fail.
          const user = await strapi
            .plugin('users-permissions')
            .service('user')
            .add({
              username: u.username,
              email: u.email,
              password: demoPassword,
              confirmed: true,
              blocked: false,
              role: role.id,
              provider: 'local',
            });

          users[u.username] = user;
          (summary['Users'] as number)++;
        }

        // ─── Seed courses ───
        const courseDefs = [
          {
            title: 'Introduction to Web Development',
            slug: 'intro-web-dev',
            description: 'Learn the fundamentals of HTML, CSS, and JavaScript to build your first website.',
            coverImageUrl: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800',
            instructorId: users['instructor'].id,
          },
          {
            title: 'React for Beginners',
            slug: 'react-beginners',
            description: 'A comprehensive introduction to React, covering components, hooks, and state management.',
            coverImageUrl: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800',
            instructorId: users['instructor'].id,
          },
          {
            title: 'Mastering Node.js',
            slug: 'mastering-nodejs',
            description: 'Build scalable server-side applications with Node.js, Express, and PostgreSQL.',
            coverImageUrl: 'https://images.unsplash.com/photo-1627398242454-45a1465c2479?w=800',
            instructorId: users['instructor2'].id,
          },
        ];

        const courses: Array<{ id: number; documentId: string; title: string }> = [];

        for (const c of courseDefs) {
          const course = await strapi.documents('api::course.course').create({
            data: {
              title: c.title,
              slug: c.slug,
              description: c.description,
              coverImageUrl: c.coverImageUrl,
              instructor: c.instructorId, // numeric id for user relation
            },
          });
          courses.push(course as { id: number; documentId: string; title: string });
          (summary['Courses'] as number)++;
        }

        // ─── Seed lessons ───
        const lessonDefs = [
          // Course 0: Intro to Web Dev — 5 lessons
          { courseIdx: 0, title: 'What is the Web?', content: '# What is the Web?\n\nThe World Wide Web is a system of interlinked hypertext documents accessed via the Internet. In this lesson, we explore the history of the web, how browsers work, and the role of HTTP in delivering content to users.\n\n## Key Concepts\n- HTTP/HTTPS protocols\n- Client-server architecture\n- Domain names and DNS', order: 1 },
          { courseIdx: 0, title: 'HTML Fundamentals', content: '# HTML Fundamentals\n\nHTML (HyperText Markup Language) is the standard markup language for creating web pages. Learn about elements, attributes, semantic tags, and document structure.\n\n## Topics Covered\n- Document structure (DOCTYPE, html, head, body)\n- Common elements: headings, paragraphs, links, images\n- Semantic HTML5 elements\n- Forms and input types', order: 2 },
          { courseIdx: 0, title: 'CSS Styling Basics', content: '# CSS Styling Basics\n\nCSS (Cascading Style Sheets) controls the visual presentation of HTML elements. Learn selectors, properties, the box model, and responsive design fundamentals.\n\n## What You Will Learn\n- Selectors and specificity\n- Box model: margin, border, padding, content\n- Flexbox layout\n- Media queries for responsiveness', order: 3 },
          { courseIdx: 0, title: 'JavaScript Essentials', content: '# JavaScript Essentials\n\nJavaScript is the programming language of the web. In this lesson, we cover variables, data types, functions, DOM manipulation, and event handling.\n\n## Core Topics\n- Variables: let, const, var\n- Functions and arrow functions\n- DOM selection and manipulation\n- Event listeners and handlers', order: 4 },
          { courseIdx: 0, title: 'Building Your First Website', content: '# Building Your First Website\n\nPut everything together by building a complete, responsive website from scratch. We will create a personal portfolio with navigation, a hero section, project cards, and a contact form.\n\n## Project Structure\n- index.html — Main page\n- styles.css — All styling\n- script.js — Interactivity', order: 5 },
          // Course 1: React for Beginners — 4 lessons
          { courseIdx: 1, title: 'What is React?', content: '# What is React?\n\nReact is a JavaScript library for building user interfaces. Created by Facebook, it uses a component-based architecture and a virtual DOM for efficient rendering.\n\n## Why React?\n- Declarative UI\n- Component reusability\n- Large ecosystem and community\n- Used by Facebook, Instagram, Netflix, and more', order: 1 },
          { courseIdx: 1, title: 'Components and Props', content: '# Components and Props\n\nComponents are the building blocks of a React application. Learn how to create functional components and pass data between them using props.\n\n## Key Concepts\n- Functional vs class components\n- Props: passing data to children\n- Default props and prop types\n- Component composition patterns', order: 2 },
          { courseIdx: 1, title: 'State and Hooks', content: '# State and Hooks\n\nState is what makes React applications interactive. Learn useState for local state, useEffect for side effects, and custom hooks for reusable logic.\n\n## Hooks Covered\n- useState — managing local state\n- useEffect — side effects and cleanup\n- useContext — avoiding prop drilling\n- Custom hooks — extracting reusable logic', order: 3 },
          { courseIdx: 1, title: 'Building a Todo App', content: '# Building a Todo App\n\nApply everything you have learned by building a complete Todo application with add, delete, toggle, and filter functionality.\n\n## Features\n- Add new todos\n- Mark as complete/incomplete\n- Filter: All / Active / Completed\n- Local storage persistence', order: 4 },
          // Course 2: Mastering Node.js — 4 lessons
          { courseIdx: 2, title: 'Node.js Fundamentals', content: '# Node.js Fundamentals\n\nNode.js is a runtime that lets you run JavaScript on the server. Learn about the event loop, modules, the file system, and npm.\n\n## Topics\n- What is Node.js and why use it?\n- The event loop and non-blocking I/O\n- CommonJS and ES modules\n- npm and package management', order: 1 },
          { courseIdx: 2, title: 'Building REST APIs with Express', content: '# Building REST APIs with Express\n\nExpress is the most popular Node.js web framework. Learn routing, middleware, error handling, and building a complete REST API.\n\n## What You Will Build\n- Express application setup\n- Route handlers for CRUD operations\n- Middleware: logging, auth, error handling\n- Input validation', order: 2 },
          { courseIdx: 2, title: 'Database Integration', content: '# Database Integration\n\nConnect your Node.js application to PostgreSQL using an ORM. Learn about migrations, models, queries, and database design.\n\n## Topics\n- SQL vs NoSQL for different use cases\n- Setting up PostgreSQL\n- ORM: models, migrations, and seeds\n- Query optimization basics', order: 3 },
          { courseIdx: 2, title: 'Authentication and Deployment', content: '# Authentication and Deployment\n\nSecure your API with JWT authentication and deploy it to production. Learn about password hashing, token management, and environment configuration.\n\n## What You Will Learn\n- Password hashing with bcrypt\n- JWT creation and verification\n- Protected routes with middleware\n- Deploying to Railway', order: 4 },
        ];

        const createdLessons: Array<{ id: number; documentId: string; courseIdx: number }> = [];

        for (const l of lessonDefs) {
          const lesson = await strapi.documents('api::lesson.lesson').create({
            data: {
              title: l.title,
              content: l.content,
              order: l.order,
              course: courses[l.courseIdx].documentId, // documentId for content relations
            },
          });
          createdLessons.push({
            id: (lesson as { id: number }).id,
            documentId: lesson.documentId,
            courseIdx: l.courseIdx,
          });
          (summary['Lessons'] as number)++;
        }

        // ─── Seed quizzes ───
        // One quiz for the first course with 4 MCQ questions
        // Uses quiz.question and quiz.option components
        await strapi.documents('api::quiz.quiz').create({
          data: {
            title: 'Web Development Fundamentals Quiz',
            passingScore: 60,
            course: courses[0].documentId,
            questions: [
              {
                prompt: 'What does HTML stand for?',
                options: [
                  { label: 'Hyper Text Markup Language', isCorrect: true },
                  { label: 'High Tech Modern Language', isCorrect: false },
                  { label: 'Hyper Transfer Markup Language', isCorrect: false },
                  { label: 'Home Tool Markup Language', isCorrect: false },
                ],
              },
              {
                prompt: 'Which CSS property is used to change the text color?',
                options: [
                  { label: 'font-color', isCorrect: false },
                  { label: 'text-color', isCorrect: false },
                  { label: 'color', isCorrect: true },
                  { label: 'foreground-color', isCorrect: false },
                ],
              },
              {
                prompt: 'Which keyword declares a variable that cannot be reassigned in JavaScript?',
                options: [
                  { label: 'var', isCorrect: false },
                  { label: 'let', isCorrect: false },
                  { label: 'const', isCorrect: true },
                  { label: 'static', isCorrect: false },
                ],
              },
              {
                prompt: 'What is the correct HTML element for the largest heading?',
                options: [
                  { label: '<heading>', isCorrect: false },
                  { label: '<h6>', isCorrect: false },
                  { label: '<head>', isCorrect: false },
                  { label: '<h1>', isCorrect: true },
                ],
              },
            ],
          },
        });
        (summary['Quizzes'] as number)++;

        // ─── Seed blog posts ───
        const blogDefs = [
          {
            title: 'Getting Started with Online Learning',
            slug: 'getting-started-online-learning',
            body: '# Getting Started with Online Learning\n\nOnline learning has transformed education. Here are our top tips for making the most of your learning journey.\n\n## Tips\n1. Set a consistent schedule\n2. Find a quiet study space\n3. Take notes actively\n4. Join study groups\n5. Practice what you learn',
            excerpt: 'Top tips for making the most of your online learning journey.',
            coverImageUrl: 'https://images.unsplash.com/photo-1501504905252-473c47e087f8?w=800',
            publish: true,
          },
          {
            title: 'Why Every Developer Should Learn TypeScript',
            slug: 'learn-typescript',
            body: '# Why Every Developer Should Learn TypeScript\n\nTypeScript adds static type checking to JavaScript, catching bugs before they reach production.\n\n## Benefits\n- Catch errors at compile time\n- Better IDE support and autocompletion\n- Self-documenting code\n- Easier refactoring\n- Growing industry adoption',
            excerpt: 'TypeScript catches bugs before they reach production. Here is why you should learn it.',
            coverImageUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800',
            publish: true,
          },
          {
            title: 'The Future of AI in Education (Draft)',
            slug: 'future-ai-education',
            body: '# The Future of AI in Education\n\nThis is a draft post exploring how artificial intelligence will shape the future of education. More research needed before publishing.',
            excerpt: 'An exploration of AI in education — coming soon.',
            coverImageUrl: 'https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=800',
            publish: false, // This stays as a draft
          },
        ];

        for (const bp of blogDefs) {
          await strapi.documents('api::blog-post.blog-post').create({
            data: {
              title: bp.title,
              slug: bp.slug,
              body: bp.body,
              excerpt: bp.excerpt,
              coverImageUrl: bp.coverImageUrl,
              author: users['manager'].id, // numeric user id
            },
            status: bp.publish ? 'published' : 'draft',
          });
          (summary['Blog Posts'] as number)++;
        }

        // ─── Seed enrollment + completions for visible progress ───
        // One student enrolled in the first course, with 2 of its 5 lessons completed,
        // so the dashboard shows a 40% bar the moment the app is opened rather than an
        // empty state that has to be explained.
        await strapi.documents('api::enrollment.enrollment').create({
          data: {
            student: users['student'].id, // numeric user id
            course: courses[0].documentId, // documentId for content relation
            enrolledAt: new Date(),
          },
        });
        (summary['Enrollments'] as number)++;

        // Complete 2 of 5 lessons → 40% progress
        const course0Lessons = createdLessons.filter((l) => l.courseIdx === 0);
        for (let i = 0; i < 2 && i < course0Lessons.length; i++) {
          await strapi.documents('api::lesson-completion.lesson-completion').create({
            data: {
              student: users['student'].id,
              lesson: course0Lessons[i].documentId,
              course: courses[0].documentId,
              completedAt: new Date(),
            },
          });
          (summary['Completions'] as number)++;
        }

        console.log('📦 Demo data seeded successfully.');
      } else {
        console.log('📦 Users exist — skipping seed.');
      }
    }

    // ───────────────────────────────────────────────────────────
    // 6. SUMMARY
    // ───────────────────────────────────────────────────────────
    console.log('\n📊 Bootstrap Summary:');
    console.table(summary);
    console.log('✅ LMS Bootstrap complete.\n');
  },
};
