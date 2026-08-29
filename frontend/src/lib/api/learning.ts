import "server-only";
import { strapi, StrapiError } from "@/lib/strapi";
import type {
  EnrollmentWithProgress,
  LessonDetail,
  QuizAttempt,
  QuizDetail,
  StrapiResponse,
} from "@/types";

/** The signed-in student's enrolments, each with a live progress summary. */
export async function getMyEnrollments(): Promise<EnrollmentWithProgress[]> {
  const response = await strapi<StrapiResponse<EnrollmentWithProgress[]>>(
    "/api/enrollments/me"
  );
  return response.data ?? [];
}

/**
 * One lesson, including its body.
 *
 * Returns `null` on 403 as well as 404. The backend gates this endpoint behind
 * enrolment, so a student who is not enrolled genuinely gets 403 — and for the reader
 * "you may not see this" and "this does not exist" should look the same, or the error
 * page becomes a way to confirm which lessons a course contains.
 */
export async function getLesson(lessonDocumentId: string): Promise<LessonDetail | null> {
  try {
    const response = await strapi<StrapiResponse<LessonDetail>>(
      `/api/lessons/${lessonDocumentId}`
    );
    return response.data ?? null;
  } catch (error) {
    if (error instanceof StrapiError && (error.status === 403 || error.status === 404)) {
      return null;
    }
    throw error;
  }
}

/**
 * One quiz, with its questions and options.
 *
 * The options carry no `isCorrect` — the controller strips it before the response
 * leaves the server. That is why `QuizOption` has no such field: a component that
 * tried to read it would fail to compile rather than silently render `undefined`.
 */
export async function getQuiz(quizDocumentId: string): Promise<QuizDetail | null> {
  try {
    const response = await strapi<StrapiResponse<QuizDetail>>(`/api/quizzes/${quizDocumentId}`);
    return response.data ?? null;
  } catch (error) {
    if (error instanceof StrapiError && (error.status === 403 || error.status === 404)) {
      return null;
    }
    throw error;
  }
}

/** The signed-in student's quiz attempts, newest first. */
export async function getMyAttempts(): Promise<QuizAttempt[]> {
  const response = await strapi<StrapiResponse<QuizAttempt[]>>("/api/quiz-attempts/me");
  return response.data ?? [];
}
