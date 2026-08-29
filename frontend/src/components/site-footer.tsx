import Link from "next/link";
import { GraduationCap } from "lucide-react";

const LINKS = [
  { href: "/courses", label: "Courses" },
  { href: "/blog", label: "Blog" },
  { href: "/privacy", label: "Privacy" },
];

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="container flex flex-col items-center justify-between gap-4 py-8 sm:flex-row">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
          <GraduationCap className="size-4 text-primary" aria-hidden="true" />
          CPS Learning
        </Link>

        <nav aria-label="Footer" className="flex flex-wrap items-center gap-6">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground hover:text-foreground hover:underline"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} CPS Learning
        </p>
      </div>
    </footer>
  );
}
