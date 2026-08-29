import { requireRole } from "@/lib/auth-guards";

/**
 * A narrower guard than the parent `/teach` layout.
 *
 * `/teach` admits instructors; `/teach/blog` does not. Instructors are redirected to
 * `/forbidden` here, the middleware's longest-prefix match sends them there before this
 * even runs, and Strapi refuses `blog-post.create` for their role regardless. Three
 * layers, and only the third one is security — but the first two are what turn "your
 * request failed" into "this is not for your role".
 */
export default async function TeachBlogLayout({ children }: { children: React.ReactNode }) {
  await requireRole("admin", "content-manager");
  return <>{children}</>;
}
