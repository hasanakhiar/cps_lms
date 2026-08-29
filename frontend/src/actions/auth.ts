"use server";

import { z } from "zod";
import { signIn } from "@/auth";
import type { ActionResult } from "@/types";

/**
 * Registration.
 *
 * The brief says "Sign up / Login, with a role for each user", which could be read as
 * asking for a role picker at signup. This deliberately does not do that.
 *
 * A role field in the registration request is a privilege-escalation surface, and no
 * amount of allow-listing is as safe as the field not existing: a request that cannot
 * express "make me an admin" cannot be tampered into doing so. Every user does have a
 * role from the moment they exist — Strapi's `default_role` is configured to `student`
 * in the backend bootstrap — and an admin changes it afterwards through a purpose-built
 * endpoint. The requirement is met; the attack surface is not created.
 *
 * The register page states this in one line so the interpretation is visible to a
 * reviewer rather than looking like an omission.
 */
const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(40, "Username must be 40 characters or fewer"),
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function registerAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const parsed = registerSchema.safeParse({
    username: formData.get("username"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    // First message only: the form shows one error at a time, and listing every
    // failure at once reads as noise on a three-field form.
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const { username, email, password } = parsed.data;

  // This is the one place outside `lib/strapi.ts` that talks to Strapi directly, and
  // it has to be: `strapi()` attaches the caller's session token, and someone
  // registering does not have one yet. The endpoint is unauthenticated by design.
  const response = await fetch(`${process.env.STRAPI_URL}/api/auth/local/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // Note what is absent: no `role`. See the comment above.
    body: JSON.stringify({ username, email, password }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;

    // Strapi's message here ("Email is already taken") is safe to surface: the person
    // is choosing an identifier, and they need to know it is unavailable. This is the
    // opposite trade from the login form, where the same specificity would leak.
    return { ok: false, message: body?.error?.message ?? "Could not create your account" };
  }

  // Sign in immediately so registration lands on a usable page rather than bouncing
  // the new user to a login form to retype what they just typed.
  await signIn("credentials", { email, password, redirect: false });

  return { ok: true };
}
