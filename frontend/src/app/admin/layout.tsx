import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { requireRole } from "@/lib/auth-guards";
import { Button } from "@/components/ui/button";

/**
 * The admin surface.
 *
 * Visually distinct on purpose — a dark bar rather than the light one `/teach` uses.
 * Two of the four roles can reach a management screen of some kind, and on a screen
 * recording it should never be ambiguous which surface is on show. It also makes it
 * obvious to the person using it that they are acting with the widest permissions the
 * application has.
 *
 * Worth separating from Strapi's own `/admin`, which is a different system entirely:
 * that is the CMS operator login with its own user table. This is a Next.js page on
 * the frontend, and the `admin` role it checks is a users-permissions role that lives
 * alongside `student`. Two different things that happen to share a word.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole("admin");

  return (
    <div className="flex flex-col">
      <div className="border-b bg-slate-900 text-slate-100">
        <div className="container flex flex-wrap items-center gap-1 py-3">
          <span className="mr-3 inline-flex items-center gap-2 text-sm font-semibold">
            <ShieldAlert className="size-4" aria-hidden="true" />
            Admin
          </span>

          {[
            { href: "/admin", label: "Overview" },
            { href: "/admin/users", label: "Users" },
            { href: "/admin/courses", label: "Courses" },
            { href: "/admin/blog", label: "Blog" },
          ].map((link) => (
            <Button
              key={link.href}
              variant="ghost"
              size="sm"
              className="text-slate-100 hover:bg-slate-800 hover:text-slate-100"
              render={<Link href={link.href} />}
            >
              {link.label}
            </Button>
          ))}
        </div>
      </div>

      {children}
    </div>
  );
}
