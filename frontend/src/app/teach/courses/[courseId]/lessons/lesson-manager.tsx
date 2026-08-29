"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Pencil, Plus, X } from "lucide-react";
import {
  createLessonAction,
  deleteLessonAction,
  reorderLessonsAction,
  updateLessonAction,
} from "@/actions/lessons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDelete } from "@/components/confirm-delete";
import type { ActionResult, LessonSummary } from "@/types";

type EditableLesson = LessonSummary & { content?: string | null; videoUrl?: string | null };

/**
 * Lesson list, reordering, and the create/edit form.
 *
 * Reordering is up/down buttons rather than drag-and-drop. Drag needs pointer handlers,
 * a keyboard alternative to stay accessible, and a drop-target model — three things to
 * get wrong for the same outcome. Two buttons are keyboard-operable and screen-reader
 * legible by default.
 *
 * The optimistic list is local state so the arrows feel instant; the server is the
 * authority and `router.refresh()` pulls the true order back once the writes land.
 */
export function LessonManager({
  courseDocumentId,
  courseSlug,
  lessons: initialLessons,
}: {
  courseDocumentId: string;
  courseSlug: string;
  lessons: EditableLesson[];
}) {
  const router = useRouter();
  const [lessons, setLessons] = useState(initialLessons);
  const [editing, setEditing] = useState<EditableLesson | null>(null);
  const [creating, setCreating] = useState(false);
  const [reordering, startReorder] = useTransition();

  // The server list wins whenever the page re-renders with fresh data.
  useEffect(() => setLessons(initialLessons), [initialLessons]);

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= lessons.length) return;

    const next = [...lessons];
    [next[index], next[target]] = [next[target], next[index]];
    setLessons(next);

    startReorder(async () => {
      const result = await reorderLessonsAction(
        next.map((lesson) => lesson.documentId),
        courseDocumentId,
        courseSlug
      );

      if (!result.ok) {
        toast.error(result.message);
        setLessons(initialLessons);
        return;
      }

      toast.success("Order saved");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight">
          {lessons.length} {lessons.length === 1 ? "lesson" : "lessons"}
        </h2>

        <Button
          onClick={() => {
            setCreating(true);
            setEditing(null);
          }}
        >
          <Plus className="size-4" aria-hidden="true" />
          Add lesson
        </Button>
      </div>

      {creating || editing ? (
        <LessonForm
          key={editing?.documentId ?? "new"}
          courseDocumentId={courseDocumentId}
          courseSlug={courseSlug}
          lesson={editing}
          nextOrder={lessons.length + 1}
          onDone={() => {
            setCreating(false);
            setEditing(null);
            router.refresh();
          }}
        />
      ) : null}

      {lessons.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No lessons yet. Add one to give students something to work through.
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {lessons.map((lesson, index) => (
            <li key={lesson.documentId}>
              <Card>
                <CardContent className="flex flex-wrap items-center gap-3 py-4">
                  <span className="w-6 text-sm text-muted-foreground tabular-nums">
                    {index + 1}
                  </span>

                  <span className="min-w-0 flex-1 truncate font-medium">{lesson.title}</span>

                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Move ${lesson.title} up`}
                      disabled={index === 0 || reordering}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp className="size-4" aria-hidden="true" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Move ${lesson.title} down`}
                      disabled={index === lessons.length - 1 || reordering}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown className="size-4" aria-hidden="true" />
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditing(lesson);
                        setCreating(false);
                      }}
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                      Edit
                    </Button>

                    <ConfirmDelete
                      title={lesson.title}
                      consequence="This deletes the lesson and every student's completion record for it. Course progress percentages recalculate automatically."
                      onConfirm={() =>
                        deleteLessonAction(lesson.documentId, courseDocumentId, courseSlug)
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function LessonForm({
  courseDocumentId,
  courseSlug,
  lesson,
  nextOrder,
  onDone,
}: {
  courseDocumentId: string;
  courseSlug: string;
  lesson: EditableLesson | null;
  nextOrder: number;
  onDone: () => void;
}) {
  const action = lesson
    ? updateLessonAction.bind(null, lesson.documentId, courseDocumentId, courseSlug)
    : createLessonAction.bind(null, courseDocumentId, courseSlug);

  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    action,
    null
  );

  useEffect(() => {
    if (!state) return;

    if (state.ok) {
      toast.success(lesson ? "Lesson updated" : "Lesson created");
      onDone();
      return;
    }

    toast.error(state.message);
  }, [state, lesson, onDone]);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">{lesson ? "Edit lesson" : "New lesson"}</CardTitle>
        <Button size="icon" variant="ghost" aria-label="Close form" onClick={onDone}>
          <X className="size-4" aria-hidden="true" />
        </Button>
      </CardHeader>

      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="lesson-title">Title</Label>
            <Input
              id="lesson-title"
              name="title"
              defaultValue={lesson?.title ?? ""}
              required
              minLength={3}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="lesson-order">Order</Label>
            <Input
              id="lesson-order"
              name="order"
              type="number"
              min={0}
              defaultValue={lesson?.order ?? nextOrder}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="lesson-video">Video URL</Label>
            <Input
              id="lesson-video"
              name="videoUrl"
              type="url"
              defaultValue={lesson?.videoUrl ?? ""}
              placeholder="https://www.youtube.com/watch?v=…"
              aria-describedby="video-help"
            />
            <p id="video-help" className="text-xs text-muted-foreground">
              YouTube and Vimeo links are embedded. Anything else renders as a link.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="lesson-content">Content (Markdown)</Label>
            <Textarea
              id="lesson-content"
              name="content"
              rows={10}
              defaultValue={lesson?.content ?? ""}
              className="font-mono text-sm"
            />
          </div>

          <div className="flex gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : lesson ? "Save lesson" : "Create lesson"}
            </Button>
            <Button type="button" variant="outline" onClick={onDone}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
