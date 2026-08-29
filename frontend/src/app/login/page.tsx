import Link from "next/link";
import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Sign in · LMS",
  description: "Sign in to your LMS account.",
};

/**
 * `searchParams` is a Promise in Next 15 and must be awaited before it is read.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Sign in</CardTitle>
          <CardDescription>Use one of the demo accounts, or your own.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm next={next} />
        </CardContent>
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-medium text-primary underline-offset-4 hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}
