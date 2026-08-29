import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth-guards";
import { getBlogPostForEdit } from "@/lib/api/teach";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { PostForm } from "../../post-form";
import { savePostAction } from "@/actions/blog";

export const metadata: Metadata = { title: "Edit post" };

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;
  await requireRole("admin", "content-manager");

  const post = await getBlogPostForEdit(postId);
  if (!post) notFound();

  return (
    <div className="container flex flex-col gap-8 py-10">
      <PageHeader title="Edit post" description={post.title}>
        <Badge variant={post.isPublished ? "default" : "secondary"}>
          {post.isPublished ? "Published" : "Draft"}
        </Badge>
      </PageHeader>

      {/* Bound Server Action — see the comment in ../new/page.tsx. */}
      <PostForm post={post} onSubmit={savePostAction.bind(null, postId)} />
    </div>
  );
}
