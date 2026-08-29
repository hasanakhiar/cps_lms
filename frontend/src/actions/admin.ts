"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { strapi, StrapiError } from "@/lib/strapi";
import { requireRole } from "@/lib/auth-guards";
import type { ActionResult, RoleType } from "@/types";

/**
 * Change one user's role.
 *
 * This goes through a purpose-built endpoint rather than the generic
 * `PUT /api/users/:id`, and that single decision is what makes self-promotion
 * impossible: the generic user update is disabled for **every** role, so there is no
 * route on which a crafted `{ role: <admin id> }` could land. A student sending it gets
 * 403 rather than a new role (leak test 4).
 *
 * The backend re-validates everything below and adds two guards this layer does not
 * duplicate — no self-demotion, and no removing the last admin. They are enforced
 * server-side because that is the only place they can be.
 */
const roleSchema = z.enum(["admin", "content-manager", "instructor", "student"]);

export async function setUserRoleAction(
  userId: number,
  roleType: string
): Promise<ActionResult> {
  await requireRole("admin");

  // Validated here as well as on the server, so an unknown value never becomes a
  // request. The backend rejects it too — this just makes the message immediate.
  const parsed = roleSchema.safeParse(roleType);
  if (!parsed.success) {
    return { ok: false, message: "That is not a valid role" };
  }

  try {
    await strapi(`/api/platform/users/${userId}/role`, {
      method: "PUT",
      body: { roleType: parsed.data satisfies RoleType },
    });

    revalidatePath("/admin/users");
    revalidatePath("/admin");

    return { ok: true };
  } catch (error) {
    if (error instanceof StrapiError) {
      // Strapi's message is the useful one here — "Cannot demote the last remaining
      // admin" and "You cannot change your own role" both come from the guards, and
      // both are exactly what the person needs to read.
      return { ok: false, message: error.message };
    }
    return { ok: false, message: "Could not change the role" };
  }
}
