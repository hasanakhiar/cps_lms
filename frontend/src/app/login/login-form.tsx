"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * The login form.
 *
 * A Client Component because it needs `signIn` from `next-auth/react`, which sets the
 * session cookie through a browser round trip. Note that this still does not put a
 * Strapi call in the browser: `signIn` posts to *this* app's `/api/auth/callback`
 * route, and the Vercel server is what talks to Strapi from `authorize()`.
 */
export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);

    const formData = new FormData(event.currentTarget);

    const result = await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      // Handled below instead, so a failure can raise a toast rather than bouncing
      // to Auth.js's own error page and losing the form state.
      redirect: false,
    });

    setPending(false);

    if (!result || result.error) {
      // Deliberately generic — `authorize()` never tells us which half was wrong, so
      // that the form cannot be used to discover which email addresses exist.
      toast.error("Invalid email or password");
      return;
    }

    // `next` comes from the middleware redirect. Only same-site paths are honoured:
    // an absolute URL here would make the login form an open redirect that could
    // bounce a freshly authenticated user to an attacker's page.
    const destination = next?.startsWith("/") && !next.startsWith("//") ? next : "/";

    router.push(destination);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="student@lms.test"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
