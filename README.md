# CPS Learning — Learning Management System

A learning management system with four roles — `admin`, `content-manager`, `instructor`,
`student` — whose permissions are enforced on the backend rather than by hiding buttons.
Students enrol in courses, work through ordered lessons, and take auto-graded quizzes;
instructors manage only their own courses; content managers run the blog; admins manage
roles across the platform. The browser never talks to the CMS directly: every request
goes Next.js → Strapi, server to server, with the token in an encrypted `httpOnly`
cookie the browser cannot read.

| | |
|---|---|
| **Frontend (Vercel)** | _not yet deployed_ |
| **Backend (Railway)** | _not yet deployed_ |
| **Video walkthrough** | _to be recorded_ |

---

## Demo credentials

Every account uses the password **`Password123!`**. They are also listed on the landing
page, so a reviewer can get in without reading this file first.

| Email | Role | What it demonstrates |
|---|---|---|
| `admin@lms.test` | admin | Platform stats, changing another user's role |
| `manager@lms.test` | content-manager | Every course, plus writing and publishing blog posts |
| `instructor@lms.test` | instructor | Owns two courses and can edit only those |
| `instructor2@lms.test` | instructor | Owns a different course — proves ownership is enforced between peers |
| `student@lms.test` | student | Enrolled with 2 of 5 lessons complete, so a 40% bar is visible immediately |
| `student2@lms.test` | student | Not enrolled — use to see the enrolment flow from the start |

---

## Feature checklist

Verified locally against a running stack. Nothing here is ticked on the strength of the
code looking right; each was exercised over HTTP or in a browser. Items that depend on a
deployment are marked as such rather than claimed.

### Core

| Feature | Status |
|---|---|
| Auth with role-based protected routes | ✅ All six users sign in; role resolves through `/api/me` into the session |
| Course CRUD per the permission matrix | ✅ Instructors restricted to their own courses; forged requests return 403 |
| Lessons under courses (text or video URL) | ✅ Markdown body, YouTube/Vimeo embeds, plain-link fallback for other hosts |
| Student enrolment with a separate "My Courses" | ✅ `/my-courses`, idempotent enrolment |
| Sequential lesson viewing | ✅ Ordered sidebar, Previous/Next, `/learn/[slug]` resolves the first incomplete lesson |

### Differentiators

| Feature | Status |
|---|---|
| Progress tracking, accurate and persistent | ✅ Survives a fresh login; **8 concurrent completes produced one row and 80%**, not 180% |
| MCQ quiz with server-side auto-grading | ✅ `isCorrect` appears **0 times** in the served quiz page; a client-sent `score` is ignored |
| Admin dashboard with role management | ✅ Promoted `student2` → instructor and confirmed `/teach` opened for them after re-login |
| Blog with draft/published states | ✅ A draft slug returns a real **404**, indistinguishable from a slug that never existed |

### Not verified yet

- **Live deployment.** The app has not been deployed; both URLs above are blank on
  purpose. Everything below "Run it locally" has been verified locally only.
- **Postgres.** Local development runs on SQLite. The Postgres path is configured and
  reviewed but has not been exercised against a real database.

### Deliberately out of scope

File uploads (cover images are URLs — the host filesystem is ephemeral), password reset
and email verification (needs SMTP; email confirmation is off on purpose), payments,
certificates, comments, notifications, dark mode, i18n, real-time features, and any test
suite beyond the leak tests.

---

## Tech stack

| Layer | Technology | Version | Host |
|---|---|---|---|
| Frontend | Next.js App Router, TypeScript | 15.5.4 | Vercel |
| UI | Tailwind CSS v4 + shadcn/ui | — | — |
| Auth | Auth.js v5 (`next-auth@beta`) | 5.0.0-beta.32 | — |
| Validation | Zod | 4.5.2 | — |
| Backend / CMS | Strapi | 5.52.2 | Railway |
| Database | PostgreSQL in production, SQLite locally | — | Railway |
| Runtime | Node.js | ≥ 20 | — |

---

## Run it locally

### Prerequisites

Node.js 20 or newer, npm, and `jq` + `curl` if you want to run the leak tests.

### 1 · Backend

```bash
cd backend
npm install
cp .env.example .env
```

Fill in `.env`. Every secret can be generated with `openssl rand -base64 32`:

```bash
# APP_KEYS needs four comma-separated values
echo "APP_KEYS=$(openssl rand -base64 32),$(openssl rand -base64 32),$(openssl rand -base64 32),$(openssl rand -base64 32)"
for k in API_TOKEN_SALT ADMIN_JWT_SECRET TRANSFER_TOKEN_SALT ENCRYPTION_KEY JWT_SECRET; do
  echo "$k=$(openssl rand -base64 32)"
done
```

Set `DEMO_USER_PASSWORD=Password123!` (or anything else — it becomes the password for
all six seeded users), then:

```bash
npm run develop
```

The bootstrap creates the four roles, applies every route permission, and seeds the demo
data on first boot. It is idempotent: restarting logs `Users exist — skipping seed` and
changes nothing.

| Variable | Purpose |
|---|---|
| `HOST` / `PORT` | `0.0.0.0` and `1337` locally |
| `APP_KEYS` | Four comma-separated random strings — session cookie signing |
| `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`, `TRANSFER_TOKEN_SALT`, `ENCRYPTION_KEY` | Strapi refuses to boot without these |
| `JWT_SECRET` | Signs the **user** JWTs Next.js sends back as Bearer tokens |
| `DATABASE_CLIENT` | `sqlite` locally, `postgres` in production |
| `DATABASE_FILENAME` | `.tmp/data.db` for SQLite |
| `DATABASE_URL` | Production only — a variable reference, never a pasted string |
| `DATABASE_SSL` | `false` locally, `true` on Railway |
| `FRONTEND_URL` | CORS allowlist — `http://localhost:3000` |
| `SEED_DEMO_DATA` | `true` to seed on first boot |
| `DEMO_USER_PASSWORD` | Password for all six seeded users |

### 2 · Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
echo "AUTH_SECRET=$(openssl rand -base64 32)" >> .env.local
npm run dev
```

| Variable | Purpose |
|---|---|
| `STRAPI_URL` | `http://localhost:1337`. **No `NEXT_PUBLIC_` prefix, no trailing slash.** |
| `AUTH_SECRET` | Encrypts the Auth.js session cookie |
| `AUTH_TRUST_HOST` | `true` |

Open <http://localhost:3000> and sign in with any account from the table above.

### 3 · Leak tests

With the backend running:

```bash
cd backend && DEMO_USER_PASSWORD=Password123! ./scripts/leak-tests.sh
```

Thirteen attacks, each aimed at a specific way an authorisation model gets holes in it.
The script takes a base URL, so the same tests run against production once deployed:

```bash
./scripts/leak-tests.sh https://your-backend.up.railway.app
```

---

## Architecture

Three programs in two places. **PostgreSQL** holds the data. **Strapi** owns the database
and owns the rules — nothing reaches the data without passing through it. **Next.js**
renders the HTML, holds the session, and is the only thing that talks to Strapi.

The browser never calls Strapi. At login, Auth.js exchanges credentials for a Strapi JWT
and stores it inside an encrypted, `httpOnly` cookie issued by our own domain — so
JavaScript cannot read the token, there is no CORS problem, and protected pages render
on the server with data already in them. Every later call is server-to-server from
Vercel to Railway with the JWT in an `Authorization` header the browser never sees.

`src/lib/strapi.ts` is the single door: it starts with `import "server-only"`, so
importing it from a Client Component is a **build error** rather than a runtime leak.
Reads happen in Server Components, writes in Server Actions that call `revalidatePath`.

Full reasoning, diagrams and the data model are in **[SYSTEM_DESIGN.md](SYSTEM_DESIGN.md)**.

---

## How permissions are enforced

Three layers. **Only the third is security.**

| Layer | Where | What it does | Is it a boundary? |
|---|---|---|---|
| 1 · Middleware | [`frontend/src/middleware.ts`](frontend/src/middleware.ts) | Matches URL prefix against allowed roles; redirects to `/login` or `/forbidden` | ❌ UX only — bypassable with `curl` |
| 2 · Guards | [`frontend/src/lib/auth-guards.ts`](frontend/src/lib/auth-guards.ts) | `requireUser()` / `requireRole()` decide what renders | ❌ UX only |
| 3 · Strapi | `backend/src/` | Decides what data is returned or written | ✅ **The only real boundary** |

Layers 1 and 2 stop a confused user seeing a broken page. They stop nothing else. Layer 3
is the one an attacker cannot go around, because reaching the database means passing
through Strapi.

### Layer 3, in three parts

**Role × route permissions** — [`backend/src/index.ts`](backend/src/index.ts). Every
permission is granted in code in `bootstrap()`, not clicked in the admin UI, because the
settings live in the database: a fresh Railway Postgres would otherwise come up with no
permissions and every endpoint 403ing. `users-permissions.user.update` and `.destroy` are
granted to **nobody**, which is what makes self-promotion impossible.

**Policies** — the "own only" rows of the matrix, which role permissions cannot express:

- [`api/course/policies/is-course-owner-or-manager.ts`](backend/src/api/course/policies/is-course-owner-or-manager.ts)
- [`api/lesson/policies/can-manage-lesson.ts`](backend/src/api/lesson/policies/can-manage-lesson.ts) and the quiz equivalent, both via [`utils/course-ownership.ts`](backend/src/utils/course-ownership.ts)
- [`api/enrollment/policies/is-enrolled.ts`](backend/src/api/enrollment/policies/is-enrolled.ts) — gates lesson reads, completions and quiz submissions
- [`policies/has-role.ts`](backend/src/policies/has-role.ts) — a factory reading `config.roles`

Every policy fails closed: missing user, missing record or unexpected role returns
`false`.

**Controller overrides** — the three things policies cannot do:

- **Forcing filters.** [`utils/scope-find.ts`](backend/src/utils/scope-find.ts) *overwrites*
  `ctx.query.filters` for student list endpoints — never merges, because a crafted `$or`
  defeats a merge.
- **Stripping secrets.** [`api/quiz/controllers/quiz.ts`](backend/src/api/quiz/controllers/quiz.ts)
  removes `isCorrect` from every option unless the caller is staff or the owning instructor.
- **Ignoring client-sent values.** [`api/course/controllers/course.ts`](backend/src/api/course/controllers/course.ts)
  sets `instructor` from the session on create and deletes it from the body on update.

### The permission matrix, and what enforces it

| Action | admin | content-manager | instructor | student | Enforced by |
|---|---|---|---|---|---|
| Manage users & assign roles | ✅ | ❌ | ❌ | ❌ | `PUT /api/platform/users/:id/role` + `has-role: [admin]`; generic user update disabled for everyone |
| Create / edit / delete course | ✅ | ✅ | own only | ❌ | Role permission for create; `is-course-owner-or-manager` for update/delete |
| Add / edit / delete lessons | ✅ | ✅ | own courses | ❌ | `can-manage-lesson` resolves lesson → course → owner |
| Create quizzes | ✅ | ✅ | own courses | ❌ | `can-manage-quiz`, same chain |
| View student progress | ✅ | ✅ | own courses | own only | `/courses/:id/students` for staff, `/enrollments/me` for students |
| Write / manage blog posts | ✅ | ✅ | ❌ | ❌ | Blog routes granted to admin + content-manager only |
| Enrol in a course | ❌ | ❌ | ❌ | ✅ | `has-role: [student]` on `POST /courses/:id/enroll` |
| Take quizzes | ❌ | ❌ | ❌ | ✅ | `has-role: [student]` + `is-enrolled` on submit |

The ❌ for staff on "enrol" and "take quizzes" is a real 403, not an oversight — an admin
enrolling would pollute enrolment statistics and create progress rows for a non-student.

### Two things called "admin"

Strapi has its own admin panel at `/admin` on the **backend**, with a separate user table
for CMS operators. That is not this application's `admin` role, which is a
users-permissions role alongside `student`, and the admin dashboard here is a Next.js
page at `/admin` on the **frontend**. Two systems that share a word.

---

## Design decisions and tradeoffs

| Decision | Why | What it costs |
|---|---|---|
| Browser never calls Strapi | XSS-safe token, no CORS, server-rendered protected pages | Every mutation needs a Server Action |
| Auth.js over hand-rolled cookies | Battle-tested session encryption and CSRF handling | The `auth.config.ts` split is needed to stay edge-safe |
| Everyone registers as **student**; only admin promotes | The registration request has no role field to tamper with, so escalation at signup is structurally impossible rather than merely blocked | Demoing an instructor needs an admin to promote first |
| Percentage computed, never stored | Cannot drift; self-heals when lessons are added or deleted | Two counts per read instead of one field lookup |
| `course` denormalised onto `lesson-completion` | Per-course counts stay a single indexed query | Must be set server-side from the lesson, or the two can disagree |
| Answers submitted as **indices**, not option ids | Strapi regenerates component row ids when a quiz is edited, which would silently invalidate stored answers | Indices are positional, so `gradedBreakdown` has to freeze the meaning at submit time |
| `gradedBreakdown` snapshot on every attempt | Old results stay readable after the instructor edits the quiz | Duplicated text per attempt |
| Cover images as URLs, no upload pipeline | The host filesystem is ephemeral; uploads would need S3 or Cloudinary for no marks | No drag-and-drop upload |
| Strapi's native Draft & Publish for the blog | Uses the CMS feature that exists | `?status=draft` is caller-controllable by default, so it needs an explicit server-side guard |
| Postgres in prod, SQLite locally | An ephemeral filesystem would eat a SQLite file on redeploy | Two database configs to keep in step |
| `wasCorrect` in results, `isCorrect` in the answer key | Two different facts get two different names, so grepping any response for `isCorrect` is an unambiguous leak test | One more name to remember |

Version pins and the reasoning behind later changes are recorded in
[`docs/DECISIONS.md`](docs/DECISIONS.md).

---