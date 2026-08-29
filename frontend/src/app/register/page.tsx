import Link from "next/link";
import type { Metadata } from "next";
import { RegisterForm } from "./register-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Create an account · LMS",
  description: "Create an LMS account and start learning.",
};

export default function RegisterPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Create an account</CardTitle>
          <CardDescription>
            New accounts start as students; an admin can change your role.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RegisterForm />
        </CardContent>
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
