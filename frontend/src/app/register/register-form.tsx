"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { registerAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/types";

export function RegisterForm() {
  const router = useRouter();

  // `useActionState` gives the pending flag and the action's return value without a
  // manual `useState` pair, and keeps the form working before hydration.
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    registerAction,
    null
  );

  useEffect(() => {
    if (!state) return;

    if (state.ok) {
      toast.success("Account created — you are signed in");
      router.push("/courses");
      // The session cookie was set by the Server Action, so the cached Server
      // Component tree still shows the signed-out header until it is refetched.
      router.refresh();
      return;
    }

    toast.error(state.message);
  }, [state, router]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="username">Username</Label>
        <Input id="username" name="username" autoComplete="username" required minLength={3} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
        <p className="text-xs text-muted-foreground">At least 8 characters.</p>
      </div>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
