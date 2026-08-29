import Link from "next/link";
import { requireRole } from "@/lib/auth-guards";
import { Button } from "@/components/ui/button";

/**
 * Layer 2 for the whole `/teach` route group.
 *
 * Guarding in the layout rather than in each page means a new screen added under
 * `/teach` is protected by existing, not by someone remembering to add a call. The
 * middleware already redirects non-staff, but a layout that trusted that would render
 * for anyone who reached it another way — and "another way" is exactly what an attacker
 * looks for.
 *
 * `/teach/blog` is *not* covered by this guard: content managers and admins may write
 * blog posts but instructors may not, so that subtree re-guards with a narrower role
 * list of its own.
 */
export default async function TeachLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole("admin", "content-manager", "instructor");
  const canWriteBlog = session.user.role !== "instructor";

  return (
    <div className="flex flex-col">
      <div className="border-b bg-muted/40">
        <div className="container flex flex-wrap items-center gap-1 py-3">
          <span className="mr-3 text-sm font-semibold">Teaching</span>

          <Button variant="ghost" size="sm" render={<Link href="/teach" />}>
            Dashboard
          </Button>
          <Button variant="ghost" size="sm" render={<Link href="/teach/courses" />}>
            Courses
          </Button>

          {/* Hidden for instructors — and refused for them at `/teach/blog` and again
              by Strapi, which is what actually stops them. */}
          {canWriteBlog ? (
            <Button variant="ghost" size="sm" render={<Link href="/teach/blog" />}>
              Blog
            </Button>
          ) : null}
        </div>
      </div>

      {children}
    </div>
  );
}
