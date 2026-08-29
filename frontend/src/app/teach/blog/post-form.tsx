"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ManagedBlogPost } from "@/lib/api/teach";

/**
 * The narrowest shape this form needs back from an action.
 *
 * Deliberately not `ActionResult<T>`: create returns the new documentId and update
 * returns nothing, so a single generic parameter cannot describe both without the
 * caller picking one and casting. The form only reads `ok` and `message`, so asking
 * for exactly that accepts either action with no cast at the call site.
 */
type FormOutcome = { ok: true } | { ok: false; message: string };

/**
 * The post editor.
 *
 * "Save draft" and "Publish" are two submit buttons over one form rather than a status
 * dropdown plus a save button. The distinction the spec asks for is between two
 * *actions*, and a dropdown makes publishing a field you might change without noticing.
 *
 * The form is driven with `useTransition` rather than `useActionState` because the
 * action taken depends on which button was pressed, and that decision has to happen
 * before the action is called.
 */
export function PostForm({
  post,
  onSubmit,
}: {
  post?: ManagedBlogPost;
  onSubmit: (publish: boolean, formData: FormData) => Promise<FormOutcome>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [intent, setIntent] = useState<"draft" | "publish" | null>(null);

  function submit(event: React.FormEvent<HTMLFormElement>, publish: boolean) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setIntent(publish ? "publish" : "draft");

    startTransition(async () => {
      const result = await onSubmit(publish, formData);
      setIntent(null);

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(publish ? "Published" : "Draft saved");
      router.push("/teach/blog");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={(event) => submit(event, false)}
      className="flex max-w-3xl flex-col gap-5"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" defaultValue={post?.title ?? ""} required minLength={3} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="slug">Slug</Label>
        <Input
          id="slug"
          name="slug"
          defaultValue={post?.slug ?? ""}
          required
          minLength={3}
          pattern="[a-z0-9\-]+"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="excerpt">Excerpt</Label>
        <Textarea id="excerpt" name="excerpt" rows={2} defaultValue={post?.excerpt ?? ""} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="coverImageUrl">Cover image URL</Label>
        <Input
          id="coverImageUrl"
          name="coverImageUrl"
          type="url"
          defaultValue={post?.coverImageUrl ?? ""}
          placeholder="https://…"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="body">Body (Markdown)</Label>
        <Textarea
          id="body"
          name="body"
          rows={16}
          defaultValue={post?.body ?? ""}
          required
          className="font-mono text-sm"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="outline" disabled={pending}>
          {pending && intent === "draft" ? "Saving…" : "Save draft"}
        </Button>

        <Button
          type="button"
          disabled={pending}
          onClick={(event) => {
            // Submit the owning form with the publish intent instead of the default.
            const form = event.currentTarget.form;
            if (form) {
              submit(
                { preventDefault: () => {}, currentTarget: form } as unknown as React.FormEvent<HTMLFormElement>,
                true
              );
            }
          }}
        >
          {pending && intent === "publish" ? "Publishing…" : "Publish"}
        </Button>

        <Button type="button" variant="ghost" render={<Link href="/teach/blog" />}>
          Cancel
        </Button>
      </div>

      {post?.isPublished ? (
        <p className="text-xs text-muted-foreground">
          This post is currently published. Saving a draft updates the draft version only —
          use Unpublish on the list to take it down.
        </p>
      ) : null}
    </form>
  );
}
