"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setUserRoleAction } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { RoleType } from "@/types";

const ROLES: RoleType[] = ["admin", "content-manager", "instructor", "student"];

/**
 * Change one user's role, behind a confirmation that names the user and the new role.
 *
 * Two things this component does *not* do, both deliberate:
 *
 * It does not let an admin edit their own row — `isSelf` renders a static badge
 * instead. The backend refuses self-changes anyway ("You cannot change your own role"),
 * so this is about not offering an action that will always fail rather than about
 * security.
 *
 * It does not predict whether the last-admin guard will fire. Whether a demotion is the
 * last one is a fact about the database at the moment of the write, not about what this
 * page rendered some seconds ago. So the attempt is made and the server's message is
 * surfaced verbatim.
 */
export function RoleSelector({
  userId,
  username,
  currentRole,
  isSelf,
}: {
  userId: number;
  username: string;
  currentRole: RoleType | null;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [proposed, setProposed] = useState<RoleType | null>(null);

  if (isSelf) {
    return (
      <span className="flex items-center gap-2">
        <Badge variant="secondary">{currentRole ?? "no role"}</Badge>
        <span className="text-xs text-muted-foreground">(you)</span>
      </span>
    );
  }

  function confirm() {
    if (!proposed) return;

    startTransition(async () => {
      const result = await setUserRoleAction(userId, proposed);

      if (!result.ok) {
        // Covers the last-admin guard and anything else the server refuses.
        toast.error(result.message);
        setProposed(null);
        return;
      }

      toast.success(`${username} is now ${proposed}`);
      setProposed(null);

      // The table is a Server Component; this re-renders it with the new role rather
      // than making the person reload the page.
      router.refresh();
    });
  }

  return (
    <>
      <Select
        value={currentRole ?? undefined}
        onValueChange={(value) => setProposed(value as RoleType)}
        disabled={pending}
      >
        <SelectTrigger className="w-[170px]" aria-label={`Role for ${username}`}>
          <SelectValue placeholder="No role" />
        </SelectTrigger>

        <SelectContent>
          {ROLES.map((role) => (
            <SelectItem key={role} value={role}>
              {role}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Dialog open={proposed !== null} onOpenChange={(open) => !open && setProposed(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change this user&apos;s role?</DialogTitle>
            <DialogDescription>
              <span className="font-medium">{username}</span> will change from{" "}
              <span className="font-medium">{currentRole ?? "no role"}</span> to{" "}
              <span className="font-medium">{proposed}</span>. They will need to sign out and
              back in before the new role takes effect — a session carries the role it was
              issued with.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setProposed(null)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={confirm} disabled={pending}>
              {pending ? "Changing…" : "Change role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
