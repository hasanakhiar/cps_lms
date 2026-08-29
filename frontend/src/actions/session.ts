"use server";

import { signOut } from "@/auth";

/**
 * Sign out, then land on the public home page.
 *
 * A Server Action rather than `signOut()` from `next-auth/react` so that the header
 * can stay a Server Component: the sign-out button is a plain form submission, which
 * means it works without JavaScript and ships none for this interaction.
 */
export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}
