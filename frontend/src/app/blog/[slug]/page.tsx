import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { getBlogPostBySlug } from "@/lib/api/blog";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { Markdown } from "@/components/markdown";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);

  if (!post) return { title: "Post not found" };

  return {
    title: post.title,
    description: post.excerpt ?? undefined,
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);

  /**
   * A draft slug lands here as `null`, and this renders a 404 — deliberately not a 403.
   *
   * 403 would confirm that something exists at this address, telling a reader that
   * unpublished content is there and what it is called. To anyone without permission,
   * an unpublished post should be indistinguishable from a post that was never written.
   */
  if (!post) notFound();

  return (
    <article className="container flex max-w-3xl flex-col gap-8 py-10">
      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        render={<Link href="/blog" />}
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        All posts
      </Button>

      <header className="flex flex-col gap-3">
        <h1 className="text-4xl font-bold tracking-tight text-balance">{post.title}</h1>

        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {post.publishedAt ? (
            <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
          ) : null}
          {post.author?.username ? <span>· {post.author.username}</span> : null}
        </div>
      </header>

      {post.coverImageUrl ? (
        <img
          src={post.coverImageUrl}
          alt=""
          className="w-full rounded-lg bg-muted object-cover"
        />
      ) : null}

      <Markdown content={post.body} />
    </article>
  );
}
