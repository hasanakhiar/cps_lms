import type { NextAuthConfig } from "next-auth";
import type { RoleType } from "@/types";

/**
 * The edge-safe half of the Auth.js configuration.
 *
 * This file is split from `auth.ts` deliberately, and the split is structural rather
 * than stylistic. `middleware.ts` runs on the edge runtime, which has no Node built-ins
 * — and the Credentials provider pulls in Node-only code. Importing the full config
 * into middleware therefore fails at build or at the edge, so middleware imports *this*
 * file, which holds only the callbacks and the session policy, and `auth.ts` spreads it
 * and adds the provider for the Node runtime.
 *
 * The practical consequence: nothing in this file may import a provider, a database
 * client, or anything that reaches for `crypto`, `fs` or `net`.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    /**
     * Seven days, deliberately shorter than the Strapi JWT it carries (30 days by
     * default). The session must never outlive the token inside it: if it did, a
     * user would appear signed in while every Strapi call behind the page failed
     * with a 401, which is a far more confusing failure than being asked to log in.
     */
    maxAge: 7 * 24 * 60 * 60,
  },
  providers: [],
  callbacks: {
    /**
     * Runs on sign-in and on every subsequent session read.
     *
     * `user` is only populated on the sign-in pass — on later reads Auth.js passes the
     * previously persisted token and nothing else. That is why the values are copied
     * onto the token once and then simply returned: the token *is* the storage.
     */
    jwt({ token, user }) {
      if (user) {
        token.strapiToken = user.strapiToken;
        token.role = user.role;
        token.strapiUserId = user.strapiUserId;
      }
      return token;
    },

    /**
     * Whatever this returns is what server code sees from `auth()`.
     *
     * The role is carried in the session rather than re-fetched because every
     * protected page needs it; a round trip to `/api/me` per render would make the
     * role a latency cost on every navigation. It is safe to trust here only because
     * it was written by `authorize()` from the backend's own answer — never from
     * anything the client sent — and the cookie is signed and encrypted, so the
     * browser can neither read nor forge it.
     *
     * This is still Layer 1/2 information. Strapi re-checks the role on every request
     * regardless, because a session is something the server issued, not something the
     * server should take orders from.
     */
    session({ session, token }) {
      session.user.role = token.role as RoleType;
      session.user.strapiUserId = token.strapiUserId as number;
      session.strapiToken = token.strapiToken as string;
      return session;
    },
  },
} satisfies NextAuthConfig;
