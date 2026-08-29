"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ActionResult } from "@/types";

/**
 * Delete, behind a confirmation that says what is actually about to be lost.
 *
 * `consequence` is a required prop rather than an optional flourish. "Are you sure?" is
 * a question nobody can answer usefully — "this will also delete 5 lessons and 12
 * completion records" is. Making it required means a caller has to work out the real
 * blast radius before it can render the button at all.
 */
export function ConfirmDelete({
  label = "Delete",
  title,
  consequence,
  onConfirm,
  redirectTo,
  size = "sm",
}: {
  label?: string;
  title: string;
  consequence: string;
  onConfirm: () => Promise<ActionResult>;
  redirectTo?: string;
  size?: "sm" | "default";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await onConfirm();

      if (!result.ok) {
        toast.error(result.message);
        setOpen(false);
        return;
      }

      toast.success("Deleted");
      setOpen(false);

      if (redirectTo) {
        router.push(redirectTo);
      }
      router.refresh();
    });
  }

  return (
    <>
      <Button
        variant="outline"
        size={size}
        onClick={() => setOpen(true)}
        aria-label={`${label}: ${title}`}
      >
        <Trash2 className="size-4" aria-hidden="true" />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {title}?</DialogTitle>
            <DialogDescription>{consequence}</DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirm} disabled={pending}>
              {pending ? "Deleting…" : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
