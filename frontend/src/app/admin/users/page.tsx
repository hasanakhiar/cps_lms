import type { Metadata } from "next";
import { Search } from "lucide-react";
import { requireRole } from "@/lib/auth-guards";
import { getPlatformUsers } from "@/lib/api/admin";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RoleSelector } from "./role-selector";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Manage users" };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requireRole("admin");
  const { q } = await searchParams;

  const { users, pagination } = await getPlatformUsers(1, 100);

  /**
   * Search is applied here rather than sent to the backend.
   *
   * `/api/platform/users` paginates but does not filter, and the whole point of this
   * screen is a platform with a manageable number of users. Filtering a page of 100 in
   * memory is honest at this scale; if the list grew past a few hundred this would need
   * to become a server-side query, and the pagination controls would need to come with
   * it. Noting the limit rather than pretending it scales.
   */
  const query = q?.trim().toLowerCase();
  const visible = query
    ? users.filter(
        (user) =>
          user.username.toLowerCase().includes(query) || user.email.toLowerCase().includes(query)
      )
    : users;

  return (
    <div className="container flex flex-col gap-8 py-10">
      <PageHeader
        title="Users"
        description="Search accounts and change what each person can do."
      />

      <form method="GET" action="/admin/users" role="search" className="flex max-w-md gap-2">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search by name or email"
            aria-label="Search users by name or email"
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      {visible.length === 0 ? (
        <EmptyState
          icon={Search}
          title={query ? `No users match “${q}”` : "No users found"}
          description="Try a different search term."
          action={{ href: "/admin/users", label: "Clear search" }}
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Showing {visible.length} of {pagination?.total ?? users.length} users
          </p>

          <Card>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead className="hidden sm:table-cell">Email</TableHead>
                    <TableHead className="hidden md:table-cell">Joined</TableHead>
                    <TableHead>Role</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {visible.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.username}</TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">
                        {user.email}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">
                        <time dateTime={user.createdAt}>{formatDate(user.createdAt)}</time>
                      </TableCell>

                      <TableCell>
                        <RoleSelector
                          userId={user.id}
                          username={user.username}
                          currentRole={user.role?.type ?? null}
                          // The signed-in admin's own row is not editable. The backend
                          // refuses it too; this stops the action being offered at all.
                          isSelf={user.id === session.user.strapiUserId}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
