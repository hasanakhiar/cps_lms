"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { strapi, StrapiError } from "@/lib/strapi";
import { requireRole } from "@/lib/auth-guards";
import type { ActionResult } from "@/types";

/**
 * Quiz authoring.
 *
 * The validation below is the interesting part. A quiz where a question has no option
 * marked correct is not a validation nicety — the grader treats such a question as
 * unanswerable and scores it zero for **everyone**, forever, silently. A student would
 * see an unexplained failure and the instructor would have no signal that anything was
 * wrong. So the editor refuses to save it and says which question is at fault.
 *
 * `.superRefine` rather than a chain of `.refine` calls, because the message has to
 * name the offending question number to be actionable — "question 3 has no correct
 * answer" is a fix, "invalid quiz" is a puzzle.
 */
const optionSchema = z.object({
  label: z.string().trim().min(1, "Every option needs a label"),
  isCorrect: z.boolean(),
});

const questionSchema = z.object({
  prompt: z.string().trim().min(1, "Every question needs a prompt"),
  options: z.array(optionSchema),
});

const quizSchema = z
  .object({
    title: z.string().trim().min(3, "Title must be at least 3 characters").max(160),
    passingScore: z.coerce
      .number()
      .int()
      .min(0, "Pass mark cannot be negative")
      .max(100, "Pass mark cannot exceed 100"),
    questions: z.array(questionSchema).min(1, "A quiz needs at least one question"),
  })
  .superRefine((quiz, ctx) => {
    quiz.questions.forEach((question, index) => {
      const position = index + 1;

      if (question.options.length < 2) {
        ctx.addIssue({
          code: "custom",
          message: `Question ${position} needs at least two options — a single-option question cannot be got wrong.`,
        });
        return;
      }

      const correctCount = question.options.filter((option) => option.isCorrect).length;

      if (correctCount === 0) {
        ctx.addIssue({
          code: "custom",
          message: `Question ${position} has no correct answer marked. The grader would score it zero for every student.`,
        });
      }

      if (correctCount > 1) {
        ctx.addIssue({
          code: "custom",
          message: `Question ${position} has ${correctCount} correct answers. The grader accepts exactly one.`,
        });
      }
    });
  });

export type QuizInput = z.input<typeof quizSchema>;

export async function saveQuizAction(
  input: QuizInput,
  courseDocumentId: string,
  courseSlug: string,
  quizDocumentId?: string
): Promise<ActionResult> {
  await requireRole("admin", "content-manager", "instructor");

  const parsed = quizSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const body = {
    data: quizDocumentId
      ? // `course` is omitted on update, so a quiz cannot be moved between courses
        // through this form.
        { ...parsed.data }
      : { ...parsed.data, course: courseDocumentId },
  };

  try {
    await strapi(quizDocumentId ? `/api/quizzes/${quizDocumentId}` : "/api/quizzes", {
      method: quizDocumentId ? "PUT" : "POST",
      body,
    });

    revalidateQuiz(courseDocumentId, courseSlug);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: toMessage(error, "Could not save the quiz") };
  }
}

export async function deleteQuizAction(
  quizDocumentId: string,
  courseDocumentId: string,
  courseSlug: string
): Promise<ActionResult> {
  await requireRole("admin", "content-manager", "instructor");

  try {
    await strapi(`/api/quizzes/${quizDocumentId}`, { method: "DELETE" });

    revalidateQuiz(courseDocumentId, courseSlug);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: toMessage(error, "Could not delete the quiz") };
  }
}

function revalidateQuiz(courseDocumentId: string, courseSlug: string): void {
  revalidatePath(`/teach/courses/${courseDocumentId}/quizzes`);
  revalidatePath(`/courses/${courseSlug}`);
  revalidatePath(`/learn/${courseSlug}`, "layout");
}

function toMessage(error: unknown, fallback: string): string {
  if (error instanceof StrapiError) {
    if (error.status === 403) {
      return "You can only manage quizzes in courses you own";
    }
    return error.message || fallback;
  }
  return fallback;
}
