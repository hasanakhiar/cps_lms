import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import type { RoleType } from "@/types";

const { auth } = NextAuth(authConfig);

/**
 * Which roles may enter which URL prefixes.
 *
 * **This is Layer 1 of three, and it is user experience rather than security.** Its
 * whole job is to stop a signed-out visitor landing on a dashboard that will only
 * render errors, and to send someone with the wrong role somewhere that explains why.
 *
 * Anyone can bypass it completely with a single `curl`, because it only runs when the
 * browser chooses to ask Next.js for a page. That is not a flaw to be fixed here —
 * it is why Strapi enforces every one of these rules again, server-side, on data it
 * owns. Deleting this file would make the app unpleasant; it would not make it
 * insecure.
 */
const ROUTE_ROLES: Record<string, readonly RoleType[]> = {
  "/admin": ["admin"],
  "/teach": ["admin", "content-manager", "instructor"],
  "/teach/blog": ["admin", "content-manager"],
  "/my-courses": ["student"],
  "/learn": ["student"],
  "/my-results": ["student"],
};

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Longest prefix wins, so `/teach/blog` is matched before `/teach` and content
  // managers do not inherit the looser rule from the shorter prefix.
  const match = Object.keys(ROUTE_ROLES)
    .sort((a, b) => b.length - a.length)
    .find((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  // Anything not listed is public. An allow-list of *protected* prefixes rather than
  // of public ones means adding a marketing page cannot accidentally put it behind a
  // login, and forgetting to list a new protected route fails visibly in testing
  // rather than silently exposing data — Strapi still refuses the underlying call.
  if (!match) {
    return NextResponse.next();
  }

  if (!req.auth) {
    const url = new URL("/login", req.nextUrl);
    // Preserved so the login form can send the visitor back where they were going.
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const role = req.auth.user?.role;
  if (!role || !ROUTE_ROLES[match].includes(role)) {
    return NextResponse.redirect(new URL("/forbidden", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  // Everything except Next's own internals and the Auth.js route handlers. `api` is
  // excluded because `/api/auth/*` must stay reachable while signed out, or logging in
  // would require already being logged in.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
