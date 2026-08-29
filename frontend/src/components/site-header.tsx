import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { auth } from "@/auth";
import { signOutAction } from "@/actions/session";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { RoleType } from "@/types";

/**
 * The application header.
 *
 * A Server Component, so the correct nav for the signed-in role is in the very first
 * HTML the browser receives. A client-side session hook would render the signed-out
 * header first and swap it after hydration, which reads as a flicker and briefly shows
 * every visitor the wrong navigation.
 *
 * Hiding a link here is presentation, not protection. `/admin` is not safe because its
 * link is absent — it is safe because middleware redirects it, the page guard redirects
 * it, and Strapi refuses the underlying request. Someone typing the URL directly is an
 * expected case, not a bypass.
 */

type NavLink = { href: string; label: string };

/** Links every visitor sees, signed in or not. */
const PUBLIC_LINKS: NavLink[] = [
  { href: "/courses", label: "Courses" },
  { href: "/blog", label: "Blog" },
];

/** Additional links per role. */
const ROLE_LINKS: Record<RoleType, NavLink[]> = {
  student: [
    { href: "/my-courses", label: "Student's Dashboard" },
    { href: "/my-results", label: "My Results" },
  ],
  instructor: [{ href: "/teach", label: "Instructor's Dashboard" }],
  // Blog is reachable from inside the teaching area's own nav, so it is not repeated
  // here. One route, one entry point.
  "content-manager": [{ href: "/teach", label: "Manager's Dashboard" }],
  // Admins reach the teaching screens through /admin/courses, which links to the same
  // management pages instructors use — so a separate top-level Teaching tab would be a
  // second door to the same rooms.
  admin: [{ href: "/admin", label: "Admin's Dashboard" }],
};

export async function SiteHeader() {
  const session = await auth();
  const role = session?.user?.role;
  const links = [...PUBLIC_LINKS, ...(role ? ROLE_LINKS[role] : [])];

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <GraduationCap className="size-5 text-primary" aria-hidden="true" />
            <span>CPS Learning</span>
          </Link>

          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {links.map((link) => (
              <Button key={link.href} variant="ghost" size="sm" render={<Link href={link.href} />}>{link.label}</Button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />

          {session?.user ? (
            <>
              <div className="hidden items-center gap-2 sm:flex">
                <span className="text-sm text-muted-foreground">{session.user.name}</span>
                <Badge variant="secondary">{role}</Badge>
              </div>

              {/* A form, so signing out is a POST rather than a link a prefetcher
                  could follow and log the user out by accident. */}
              <form action={signOutAction}>
                <Button type="submit" variant="outline" size="sm">
                  Sign out
                </Button>
              </form>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" render={<Link href="/login" />}>Sign in</Button>
              <Button size="sm" render={<Link href="/register" />}>Get started</Button>
            </>
          )}
        </div>
      </div>

      {/* The mobile nav sits on its own row rather than behind a toggle: at six links
          maximum it fits, and a drawer would be more code for less clarity. */}
      <nav
        aria-label="Main"
        className="container flex items-center gap-1 overflow-x-auto pb-2 md:hidden"
      >
        {links.map((link) => (
          <Button key={link.href} variant="ghost" size="sm" render={<Link href={link.href} />}>{link.label}</Button>
        ))}
      </nav>
    </header>
  );
}
