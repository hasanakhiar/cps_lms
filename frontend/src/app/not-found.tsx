import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * The 404 page.
 *
 * Also what a reader sees for an unpublished blog post, which is why the wording stays
 * neutral: it must not hint that the address is real but withheld.
 */
export default function NotFound() {
  return (
    <div className="container flex min-h-[60vh] flex-col items-center justify-center gap-6 py-16 text-center">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">404</p>
        <h1 className="text-3xl font-bold tracking-tight">Page not found</h1>
        <p className="max-w-md text-muted-foreground text-pretty">
          The page you are looking for does not exist, or is not available to you.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <Button render={<Link href="/" />}>Back to home</Button>
        <Button variant="outline" render={<Link href="/courses" />}>
          Browse courses
        </Button>
      </div>
    </div>
  );
}
