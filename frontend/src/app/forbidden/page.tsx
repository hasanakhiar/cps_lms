import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Access denied · LMS",
};

/**
 * Where Layer 1 sends a signed-in user whose role does not match the URL.
 *
 * It names the role they hold, because the alternative — a bare "403" — leaves someone
 * who was legitimately promoted unable to tell that they simply need to sign in again
 * to pick up their new role. The session is a snapshot taken at login; a role change
 * does not reach into an issued cookie.
 */
export default async function ForbiddenPage() {
  const session = await auth();

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Access denied</CardTitle>
          <CardDescription>
            This area requires a role your account does not currently have.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {session?.user ? (
            <p className="text-sm text-muted-foreground">
              You are signed in as <span className="font-medium">{session.user.email}</span> with
              the role <Badge variant="secondary">{session.user.role}</Badge>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">You are not signed in.</p>
          )}

          <p className="text-sm text-muted-foreground">
            If your access was changed recently, sign out and back in to refresh it.
          </p>

          <div className="flex flex-wrap gap-3">
            <Button render={<Link href="/" />}>Back to home</Button>
            <Button variant="outline" render={<Link href="/courses" />}>Browse courses</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
