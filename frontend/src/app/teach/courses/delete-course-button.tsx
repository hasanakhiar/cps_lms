"use client";

import { ConfirmDelete } from "@/components/confirm-delete";
import { deleteCourseAction } from "@/actions/courses";

/**
 * Deleting a course is the most destructive action in the app, so the dialog spells
 * out the cascade rather than asking a generic "are you sure".
 */
export function DeleteCourseButton({
  courseDocumentId,
  title,
  lessonCount,
  quizCount,
  studentCount,
}: {
  courseDocumentId: string;
  title: string;
  lessonCount: number;
  quizCount: number;
  studentCount: number;
}) {
  const parts = [
    `${lessonCount} ${lessonCount === 1 ? "lesson" : "lessons"}`,
    `${quizCount} ${quizCount === 1 ? "quiz" : "quizzes"}`,
  ];

  const enrolments =
    studentCount > 0
      ? ` ${studentCount} enrolled ${studentCount === 1 ? "student" : "students"} will lose their progress.`
      : "";

  return (
    <ConfirmDelete
      title={title}
      consequence={`This permanently deletes ${parts.join(" and ")}, along with every completion record and quiz attempt for this course.${enrolments} This cannot be undone.`}
      onConfirm={() => deleteCourseAction(courseDocumentId)}
    />
  );
}
