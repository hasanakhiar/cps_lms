import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";
import type { CurrentUser } from "@/types";

/**
 * The Node half of the Auth.js configuration: the Credentials provider that turns an
 * email and password into a Strapi session.
 *
 * This file is never imported by `middleware.ts` — see `auth.config.ts` for why.
 */

const STRAPI_URL = process.env.STRAPI_URL;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },

      /**
       * Exchange credentials for a Strapi JWT, then resolve the user's role.
       *
       * Returning `null` anywhere in here produces one generic "invalid credentials"
       * error on the login page. That is intentional at every branch: Strapi's own
       * error body distinguishes "no such user" from "wrong password", and forwarding
       * that distinction would turn the login form into an oracle for enumerating
       * which email addresses have accounts.
       */
      async authorize(credentials) {
        if (!STRAPI_URL) {
          // A misconfigured deployment should fail loudly on the server rather than
          // silently rejecting every correct password as if it were wrong.
          throw new Error("STRAPI_URL is not set");
        }

        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        const loginResponse = await fetch(`${STRAPI_URL}/api/auth/local`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Strapi calls the login field `identifier`, not `email`. It accepts either
          // an email address or a username there.
          body: JSON.stringify({ identifier: email, password }),
          cache: "no-store",
        });

        if (!loginResponse.ok) {
          return null;
        }

        const { jwt, user } = (await loginResponse.json()) as {
          jwt: string;
          user: { id: number; username: string; email: string };
        };

        /**
         * Second call, and the reason `/api/me` exists at all.
         *
         * Strapi's login response does not include the user's role, and the plugin's
         * own `/api/users/me` does not populate it either. The role has to be resolved
         * here, at sign-in, because it is what the session carries — the alternative
         * is an extra round trip on every page that needs to know who is looking.
         */
        const meResponse = await fetch(`${STRAPI_URL}/api/me`, {
          headers: { Authorization: `Bearer ${jwt}` },
          cache: "no-store",
        });

        if (!meResponse.ok) {
          return null;
        }

        const me = (await meResponse.json()) as CurrentUser;

        // A user with no role cannot be authorised against anything, so treat it as a
        // failed login rather than signing them in with an undefined role that every
        // downstream check would then have to defend against.
        if (!me.role?.type) {
          return null;
        }

        return {
          id: String(user.id),
          email: user.email,
          name: user.username,
          role: me.role.type,
          strapiUserId: user.id,
          strapiToken: jwt,
        };
      },
    }),
  ],
});
