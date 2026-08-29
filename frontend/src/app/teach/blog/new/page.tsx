import type { Metadata } from "next";
import { requireRole } from "@/lib/auth-guards";
import { PageHeader } from "@/components/page-header";
import { PostForm } from "../post-form";
import { savePostAction } from "@/actions/blog";

export const metadata: Metadata = { title: "New post" };

export default async function NewPostPage() {
  await requireRole("admin", "content-manager");

  return (
    <div className="container flex flex-col gap-8 py-10">
      <PageHeader
        title="New post"
        description="Save as a draft to keep it private, or publish to make it public immediately."
      />
      {/*
        `.bind` rather than an arrow function. A Server Component may pass a Server
        Action (or a bound one) to a Client Component, but not a closure — an inline
        `(publish, formData) => …` fails at render.
      */}
      <PostForm onSubmit={savePostAction.bind(null, null)} />
    </div>
  );
}
