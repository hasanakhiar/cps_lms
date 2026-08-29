/**
 * The shapes the Strapi backend actually returns.
 *
 * Every type here was written against a real response captured from the running
 * backend, not inferred from the schema — the two differ in ways that matter.
 * `sanitizeOutput` drops relations the caller may not read, the hardened controllers
 * replace the caller's `fields`/`populate` with server-side allow-lists, and the
 * custom endpoints return hand-assembled objects rather than database rows. So a
 * student's course is a genuinely different shape from an instructor's, and pretending
 * otherwise with one optimistic interface is how `undefined` reaches the DOM.
 */

/**
 * The four roles, by `type` slug.
 *
 * The code branches on `type` and never on `name`, because names are editable in the
 * Strapi admin UI and types are not.
 */
export type RoleType = "admin" | "content-manager" | "instructor" | "student";

/** Roles that manage the platform rather than learn from it. */
export const STAFF_ROLES: readonly RoleType[] = ["admin", "content-manager", "instructor"];

/** `GET /api/me` — note this endpoint is unwrapped, with no `data` envelope. */
export interface CurrentUser {
  id: number;
  username: string;
  email: string;
  role: { type: RoleType; name: string };
}

/** Strapi's standard envelope for core CRUD routes. */
export interface StrapiResponse<T> {
  data: T;
  meta?: { pagination?: StrapiPagination };
}

export interface StrapiPagination {
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
}

/**
 * A course as it appears in the public catalogue.
 *
 * Note the two ways the instructor appears, which is not redundancy:
 *
 * `instructor` is the real relation, and it is `null` for anonymous and student
 * callers — Strapi strips a populated relation when the caller has no read permission
 * on the target content type, and nobody is granted `users-permissions.user.find`.
 *
 * `instructorName` is a scalar the course controller attaches server-side precisely
 * because of that. It is the field to render; `instructor` is only populated for staff
 * and should not be relied on for display.
 */
export interface CourseSummary {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  description: string | null;
  coverImageUrl: string | null;
  instructorName: string | null;
  instructor?: { id: number; username: string } | null;
  lessons?: Array<{ id: number; documentId: string }>;
}

/** A course detail response, with the syllabus as titles only. */
export interface CourseDetail extends CourseSummary {
  lessons?: LessonSummary[];
  quizzes?: QuizSummary[];
}

/**
 * A lesson as listed in a syllabus — no body, deliberately.
 *
 * `createdAt` is included so the home page can tell which lessons appeared after a
 * student enrolled. It is a timestamp on content whose title is already public, and
 * `content` and `videoUrl` stay excluded, which is the part that matters.
 */
export interface LessonSummary {
  id: number;
  documentId: string;
  title: string;
  order: number;
  createdAt: string;
}

/** A lesson with its body, returned only to staff, the owner, or an enrolled student. */
export interface LessonDetail extends LessonSummary {
  content: string | null;
  videoUrl: string | null;
  course?: { documentId: string; title: string; slug: string };
}

export interface QuizSummary {
  id: number;
  documentId: string;
  title: string;
}

/** A quiz as served to a student: options carry no `isCorrect`. */
export interface QuizDetail extends QuizSummary {
  passingScore: number;
  questions: QuizQuestion[];
  course?: { documentId: string; title: string; slug: string };
}

export interface QuizQuestion {
  id: number;
  prompt: string;
  options: QuizOption[];
}

/**
 * A quiz option as a student sees it.
 *
 * There is no `isCorrect` field on this type, and that absence is deliberate: the
 * server strips it, so a component that tried to read it would be a type error rather
 * than a silent `undefined` that happens to look fine.
 */
export interface QuizOption {
  id: number;
  label: string;
}

/** `GET /api/courses/:id/progress` — computed live on every read, never stored. */
export interface CourseProgress {
  courseId: string;
  completed: number;
  totalLessons: number;
  percentage: number;
  completedLessonIds: string[];
}

/** `GET /api/enrollments/me` */
export interface EnrollmentWithProgress {
  enrollmentId: string;
  enrolledAt: string;
  course: {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    coverImageUrl: string | null;
  };
  progress: CourseProgress;
}

/** `GET /api/courses/teaching` */
export interface TeachingCourse {
  documentId: string;
  title: string;
  slug: string;
  description: string | null;
  coverImageUrl: string | null;
  lessonCount: number;
  quizCount: number;
  studentCount: number;
}

/** `GET /api/courses/:id/students` */
export interface EnrolledStudent {
  id: number;
  username: string;
  email: string;
  enrolledAt: string;
  progress: { completed: number; totalLessons: number; percentage: number };
}

/**
 * One question's outcome, frozen at submit time.
 *
 * The labels are stored rather than referenced so that editing the quiz afterwards —
 * reordering options, fixing a typo, deleting a question — cannot make an old result
 * page unreadable.
 *
 * The field is `wasCorrect`, not `isCorrect`, and the difference is load-bearing.
 * `isCorrect` on a quiz option means "this is the answer" and must never reach a
 * student; `wasCorrect` means "this student got it right" and is exactly the feedback
 * they earned. Keeping the names distinct means grepping a response body for
 * `isCorrect` is an unambiguous leak test rather than a result needing interpretation.
 */
export interface GradedQuestion {
  prompt: string;
  chosenLabel: string | null;
  correctLabel: string | null;
  answered: boolean;
  wasCorrect: boolean;
}

/** The response to `POST /api/quizzes/:id/submit`. */
export interface QuizResult {
  attemptId: string;
  score: number;
  total: number;
  percentage: number;
  passed: boolean;
  breakdown: GradedQuestion[];
}

/**
 * `GET /api/quiz-attempts/me`
 *
 * Hand-assembled by the backend rather than a raw row, so the field names differ from
 * the database columns: `attemptId` not `documentId`, `breakdown` not
 * `gradedBreakdown`. `passed` is recomputed on read against the quiz's *current* pass
 * mark rather than stored, so an instructor lowering the bar cannot leave two screens
 * disagreeing about the same attempt.
 *
 * Note what is absent: `quiz.questions`. Populating it would carry `isCorrect` for
 * every option — including questions this student has never seen — out through a route
 * that does no answer-stripping.
 */
export interface QuizAttempt {
  attemptId: string;
  score: number | null;
  total: number | null;
  percentage: number | null;
  passed: boolean;
  submittedAt: string | null;
  quiz: {
    id: string;
    title: string | null;
    passingScore: number | null;
    course: { id: string; title: string | null; slug: string | null } | null;
  } | null;
  breakdown: GradedQuestion[];
}

export interface BlogPost {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  body: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  publishedAt: string | null;
  createdAt: string;
  author?: { id: number; username: string };
}

/** `GET /api/platform/stats` */
export interface PlatformStats {
  users: { total: number; perRole: Record<RoleType, number> };
  courses: number;
  lessons: number;
  enrollments: number;
  quizzes: number;
  quizAttempts: number;
  blogPosts: { published: number; draft: number };
}

/**
 * `GET /api/platform/users`
 *
 * Fields are selected explicitly by the backend rather than deleted after the fact, so
 * `password`, `resetPasswordToken` and `confirmationToken` are not merely stripped —
 * they are never read out of the database. Verified by grepping the raw response.
 */
export interface PlatformUser {
  id: number;
  username: string;
  email: string;
  confirmed: boolean;
  blocked: boolean;
  createdAt: string;
  role: { id: number; type: RoleType; name: string } | null;
}

/**
 * What every Server Action returns.
 *
 * A discriminated union rather than a thrown error, because the caller is a form in
 * the browser and the failure has to arrive as a value it can render. Phase 12 of the
 * spec requires every failure to surface as a toast — that is only possible if the
 * message is part of the return type.
 */
export type ActionResult<T = void> =
  | ({ ok: true } & (T extends void ? object : { data: T }))
  | { ok: false; message: string };
