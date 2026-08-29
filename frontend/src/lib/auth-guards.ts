import "server-only";
import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import type { RoleType } from "@/types";

/**
 * Layer 2 of the three-layer permission model: what renders.
 *
 * Middleware (Layer 1) decides whether a URL is reachable; these guards decide what a
 * page is allowed to draw once it is rendering; Strapi (Layer 3) decides what data may
 * actually be read or written. Only the third is a security boundary — but without the
 * first two, a student who typed `/admin` would get a page full of failed requests
 * rather than a straight answer.
 *
 * Both guards `redirect()` rather than returning a flag, so a page body can treat the
 * returned session as a guarantee: if the next line runs, the user is authorised.
 */

/** The signed-in user, or a redirect to the login page. */
export async function requireUser(): Promise<Session> {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return session;
}

/**
 * The signed-in user, if they hold one of `roles` — otherwise a redirect.
 *
 * Signed-out visitors go to `/login` and wrongly-roled ones to `/forbidden`, because
 * those are different problems with different fixes: one is "identify yourself", the
 * other is "you are identified, and the answer is still no".
 */
export async function requireRole(...roles: RoleType[]): Promise<Session> {
  const session = await requireUser();

  if (!roles.includes(session.user.role)) {
    redirect("/forbidden");
  }

  return session;
}
