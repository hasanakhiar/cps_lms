"use server";

import { revalidatePath } from "next/cache";
import { strapi, StrapiError } from "@/lib/strapi";
import { auth } from "@/auth";
import type { ActionResult, QuizResult, StrapiResponse } from "@/types";

/**
 * Submit quiz answers for grading.
 *
 * The body is `{ answers: (number | null)[] }` — the index of the chosen option per
 * question, positionally matched, `null` for unanswered. **No score is sent**, and if
 * one were, the backend would ignore it: grading happens server-side in a request the
 * student cannot see into. That is leak test 6, and it is the single clearest
 * demonstration of "never trust the client" in the whole project.
 *
 * Indices rather than option ids, deliberately: Strapi regenerates component row ids
 * when a quiz is edited, which would silently invalidate stored answers. Indices are
 * stable within a request, and the server freezes the meaning into `gradedBreakdown`
 * at submit time so old results stay readable after the quiz changes.
 */
export async function submitQuizAction(
  quizDocumentId: string,
  courseSlug: string,
  answers: (number | null)[]
): Promise<ActionResult<QuizResult>> {
  const session = await auth();

  if (!session?.user) {
    return { ok: false, message: "Sign in to take this quiz" };
  }

  if (session.user.role !== "student") {
    return { ok: false, message: "Only students can take quizzes" };
  }

  if (!Array.isArray(answers) || answers.length === 0) {
    return { ok: false, message: "Answer at least one question before submitting" };
  }

  try {
    const response = await strapi<StrapiResponse<QuizResult>>(
      `/api/quizzes/${quizDocumentId}/submit`,
      { method: "POST", body: { answers } }
    );

    // Attempts are append-only, so the history page has a new row to show.
    revalidatePath("/my-results");
    revalidatePath(`/courses/${courseSlug}`);

    return { ok: true, data: response.data };
  } catch (error) {
    if (error instanceof StrapiError) {
      return { ok: false, message: error.message };
    }
    return { ok: false, message: "Could not submit your answers" };
  }
}
