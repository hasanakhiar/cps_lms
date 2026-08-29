import type { DefaultSession } from "next-auth";
import type { RoleType } from "./index";

/**
 * Module augmentation for Auth.js v5.
 *
 * Without this, `session.strapiToken` is a type error and `session.user.role` is
 * `undefined` as far as TypeScript is concerned, which pushes every call site into a
 * cast. Spec rule 8 bans `any`, and a cast is `any` wearing a hat — the honest fix is
 * to describe the session we actually build in the callbacks.
 *
 * Three declarations are needed because the value is copied across three types as it
 * travels: `User` is what `authorize()` returns, `JWT` is what the `jwt` callback
 * persists into the encrypted cookie, and `Session` is what `auth()` hands to server
 * code. Augmenting only `Session` type-checks the readers while leaving the writers
 * untyped, which is where the mistakes actually happen.
 */
declare module "next-auth" {
  interface Session {
    /**
     * The Strapi JWT. Safe to keep in the session because the session cookie is
     * encrypted and `httpOnly` — the browser cannot read it, and only server code
     * ever sees this field.
     */
    strapiToken: string;
    user: {
      role: RoleType;
      strapiUserId: number;
    } & DefaultSession["user"];
  }

  /** The object `authorize()` returns on a successful login. */
  interface User {
    role: RoleType;
    strapiUserId: number;
    strapiToken: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: RoleType;
    strapiUserId: number;
    strapiToken: string;
  }
}
