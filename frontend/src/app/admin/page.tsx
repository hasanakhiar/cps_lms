import Link from "next/link";
import type { Metadata } from "next";
import {
  BookOpen,
  ClipboardList,
  FileText,
  GraduationCap,
  Layers,
  Users,
} from "lucide-react";
import { requireRole } from "@/lib/auth-guards";
import { getPlatformStats, getPlatformUsers } from "@/lib/api/admin";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RoleChart } from "./role-chart";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Admin overview" };

export default async function AdminDashboardPage() {
  await requireRole("admin");

  // Independent reads, so they go out together rather than one after the other. The
  // backend already runs its own counts in a single `Promise.all`.
  const [stats, { users }] = await Promise.all([getPlatformStats(), getPlatformUsers(1, 5)]);

  const cards = [
    { label: "Users", value: stats.users.total, icon: Users },
    { label: "Courses", value: stats.courses, icon: BookOpen },
    { label: "Lessons", value: stats.lessons, icon: Layers },
    { label: "Enrolments", value: stats.enrollments, icon: GraduationCap },
    { label: "Quizzes", value: stats.quizzes, icon: ClipboardList },
    { label: "Quiz attempts", value: stats.quizAttempts, icon: ClipboardList },
  ];

  return (
    <div className="container flex flex-col gap-8 py-10">
      <PageHeader
        title="Platform overview"
        description="Live totals across the platform."
      >
        <Button variant="outline" render={<Link href="/admin/users" />}>
          Manage users
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tabular-nums">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Users by role</CardTitle>
          </CardHeader>
          <CardContent>
            <RoleChart perRole={stats.users.perRole} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="size-4" aria-hidden="true" />
              Blog posts
            </CardTitle>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            {/*
              Counted with the Query Engine, which bypasses Draft & Publish — exactly
              what is wanted for counting both states, and exactly what must not be used
              when reading posts for a visitor.
            */}
            <div className="flex gap-8">
              <div>
                <p className="text-3xl font-bold tabular-nums">{stats.blogPosts.published}</p>
                <p className="text-sm text-muted-foreground">Published</p>
              </div>
              <div>
                <p className="text-3xl font-bold tabular-nums">{stats.blogPosts.draft}</p>
                <p className="text-sm text-muted-foreground">Draft</p>
              </div>
            </div>

            <Button variant="outline" className="self-start" render={<Link href="/admin/blog" />}>
              Manage posts
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent signups</CardTitle>
        </CardHeader>

        <CardContent>
          <ul className="flex flex-col divide-y">
            {users.map((user) => (
              <li key={user.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{user.username}</span>
                  <span className="truncate text-sm text-muted-foreground">{user.email}</span>
                </span>

                <span className="flex items-center gap-3">
                  <Badge variant="secondary">{user.role?.type ?? "no role"}</Badge>
                  <time
                    dateTime={user.createdAt}
                    className="text-xs text-muted-foreground tabular-nums"
                  >
                    {formatDate(user.createdAt)}
                  </time>
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
