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
import { PostActions } from "./post-actions";

export const metadata: Metadata = { title: "Manage blog" };

export default async function ManageBlogPage() {
  await requireRole("admin", "content-manager");

  // Drafts included — see `getAllBlogPosts` for why this takes two requests.
  const posts = await getAllBlogPosts();

  return (
    <div className="container flex flex-col gap-8 py-10">
      <PageHeader
        title="Blog"
        description="Write posts, save them as drafts, and publish when they are ready."
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
          description="Write a post, save it as a draft, and publish when it is ready."
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
                  <TableHead className="hidden md:table-cell">Slug</TableHead>
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

                    <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">
                      {post.slug}
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
