import Link from "next/link";
import type { Metadata } from "next";
import { FileText, Plus } from "lucide-react";
import { requireRole } from "@/lib/auth-guards";
import { getAllBlogPosts } from "@/lib/api/teach";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PostActions } from "@/app/teach/blog/post-actions";

export const metadata: Metadata = { title: "All blog posts" };

/**
 * Every post on the platform, including other people's drafts.
 *
 * The list and the row actions are the same ones content managers use at
 * `/teach/blog` — an admin has no separate permission here, only a wider view, so a
 * separate editor would be duplication rather than a feature.
 */
export default async function AdminBlogPage() {
  await requireRole("admin");

  const posts = await getAllBlogPosts();
  const drafts = posts.filter((post) => !post.isPublished).length;

  return (
    <div className="container flex flex-col gap-8 py-10">
      <PageHeader
        title="All blog posts"
        description={`${posts.length} posts · ${drafts} unpublished`}
      >
        <Button render={<Link href="/teach/blog/new" />}>
          <Plus className="size-4" aria-hidden="true" />
          New post
        </Button>
      </PageHeader>

      {posts.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No posts yet"
          description="Content managers and admins can write posts."
          action={{ href: "/teach/blog/new", label: "Write a post" }}
        />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Author</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {posts.map((post) => (
                  <TableRow key={post.documentId}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/teach/blog/${post.documentId}/edit`}
                        className="hover:underline"
                      >
                        {post.title}
                      </Link>
                    </TableCell>

                    <TableCell>
                      <Badge variant={post.isPublished ? "default" : "secondary"}>
                        {post.isPublished ? "Published" : "Draft"}
                      </Badge>
                    </TableCell>

                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {post.author?.username ?? "—"}
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          render={<Link href={`/teach/blog/${post.documentId}/edit`} />}
                        >
                          Edit
                        </Button>
                        <PostActions
                          postDocumentId={post.documentId}
                          slug={post.slug}
                          title={post.title}
                          isPublished={post.isPublished}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
