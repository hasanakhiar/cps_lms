import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { listBlogPosts } from "@/lib/api/blog";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { CardGridSkeleton } from "@/components/course-grid-skeleton";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Blog",
  description: "Articles and updates from the team.",
};

/**
 * Suspense rather than `loading.tsx` — see `app/courses/page.tsx` for why. A segment
 * loading file here would make `/blog/[slug]` stream, and its `notFound()` would then
 * return 200, which is precisely the case that must not happen for a draft post.
 */
export default function BlogPage() {
  return (
    <div className="container flex flex-col gap-8 py-10">
      <PageHeader title="Blog" description="Articles and updates, newest first." />

      <Suspense fallback={<CardGridSkeleton />}>
        <BlogList />
      </Suspense>
    </div>
  );
}

async function BlogList() {
  // Published only — enforced by the controller, not filtered here. See lib/api/blog.ts.
  const posts = await listBlogPosts();

  if (posts.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No posts published yet"
        description="Drafts stay invisible here until a content manager publishes them."
        action={{ href: "/courses", label: "Browse courses instead" }}
      />
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {posts.map((post) => (
        <Card key={post.documentId} className="relative flex h-full flex-col">
          <CardHeader>
            <CardTitle className="text-lg leading-snug">
              <Link
                href={`/blog/${post.slug}`}
                className="after:absolute after:inset-0 hover:underline"
              >
                {post.title}
              </Link>
            </CardTitle>
          </CardHeader>

          <CardContent className="flex-1">
            {post.excerpt ? (
              <p className="line-clamp-3 text-sm text-muted-foreground text-pretty">
                {post.excerpt}
              </p>
            ) : null}
          </CardContent>

          <CardFooter className="text-xs text-muted-foreground">
            {post.publishedAt ? (
              <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
            ) : null}
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
