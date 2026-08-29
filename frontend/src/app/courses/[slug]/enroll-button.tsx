"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { enrollAction } from "@/actions/enrollment";
import { Button } from "@/components/ui/button";

/**
 * The Enrol button.
 *
 * Disabled while the transition is pending, so a double-click cannot fire two
 * enrolments. The backend is idempotent anyway — this is about the button not looking
 * broken while the request is in flight, rather than about correctness.
 */
export function EnrollButton({
  courseDocumentId,
  courseSlug,
}: {
  courseDocumentId: string;
  courseSlug: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const result = await enrollAction(courseDocumentId, courseSlug);

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success("You are enrolled — start with the first lesson");
      router.push(`/learn/${courseSlug}`);
    });
  }

  return (
    <Button size="lg" onClick={onClick} disabled={pending}>
      {pending ? "Enrolling…" : "Enrol in this course"}
    </Button>
  );
}
