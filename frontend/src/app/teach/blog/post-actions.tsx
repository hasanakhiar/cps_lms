"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { publishPostAction, unpublishPostAction, deletePostAction } from "@/actions/blog";
import { Button } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/confirm-delete";

/**
 * Publish / unpublish / delete for one post.
 *
 * Publish and unpublish are separate buttons rather than a toggle switch, because they
 * are not symmetrical in consequence: publishing makes something world-readable, and
 * that deserves its own deliberate click rather than a control that can be flipped by
 * accident.
 */
export function PostActions({
  postDocumentId,
  slug,
  title,
  isPublished,
}: {
  postDocumentId: string;
  slug: string;
  title: string;
  isPublished: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const result = isPublished
        ? await unpublishPostAction(postDocumentId, slug)
        : await publishPostAction(postDocumentId, slug);

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(
        isPublished ? "Unpublished — no longer visible to the public" : "Published"
      );
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button size="sm" variant="outline" onClick={toggle} disabled={pending}>
        {isPublished ? (
          <>
            <EyeOff className="size-4" aria-hidden="true" />
            Unpublish
          </>
        ) : (
          <>
            <Eye className="size-4" aria-hidden="true" />
            Publish
          </>
        )}
      </Button>

      <ConfirmDelete
        title={title}
        consequence="This permanently deletes the post, both its draft and published versions. This cannot be undone."
        onConfirm={() => deletePostAction(postDocumentId, slug)}
      />
    </div>
  );
}
