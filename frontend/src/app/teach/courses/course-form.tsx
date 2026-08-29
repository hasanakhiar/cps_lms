"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult, CourseDetail } from "@/types";

/**
 * Create / edit a course.
 *
 * **There is no instructor field, and that is the point.** Ownership is set by the
 * backend from the session on create and stripped from the body on update, so there is
 * nothing for this form to send. Rendering a disabled "owner" input would imply the
 * value travels with the request and merely happens to be read-only, which is the wrong
 * mental model to leave a reviewer with.
 */
export function CourseForm({
  action,
  course,
  submitLabel,
}: {
  action: (prev: unknown, formData: FormData) => Promise<ActionResult<{ slug: string }>>;
  course?: CourseDetail;
  submitLabel: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<
    ActionResult<{ slug: string }> | null,
    FormData
  >(action, null);

  useEffect(() => {
    if (!state) return;

    if (state.ok) {
      toast.success("Course saved");
      router.push("/teach/courses");
      router.refresh();
      return;
    }

    toast.error(state.message);
  }, [state, router]);

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" defaultValue={course?.title ?? ""} required minLength={3} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="slug">Slug</Label>
        <Input
          id="slug"
          name="slug"
          defaultValue={course?.slug ?? ""}
          required
          minLength={3}
          pattern="[a-z0-9\-]+"
          aria-describedby="slug-help"
        />
        <p id="slug-help" className="text-xs text-muted-foreground">
          Lowercase letters, numbers and hyphens. This becomes the course URL, so changing
          it breaks existing links.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={course?.description ?? ""}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="coverImageUrl">Cover image URL</Label>
        <Input
          id="coverImageUrl"
          name="coverImageUrl"
          type="url"
          defaultValue={course?.coverImageUrl ?? ""}
          placeholder="https://…"
          aria-describedby="cover-help"
        />
        <p id="cover-help" className="text-xs text-muted-foreground">
          A link to an image used as the course cover.
        </p>
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        <Button type="button" variant="outline" render={<Link href="/teach/courses" />}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
