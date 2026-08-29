import "server-only";
import { strapi } from "@/lib/strapi";
import type { PlatformStats, PlatformUser, StrapiPagination, StrapiResponse } from "@/types";

/**
 * Read helpers for the admin surface.
 *
 * Every one of these hits a route gated by `has-role: ['admin']`. There is no
 * role check in this file, deliberately: a check here would be a second place the rule
 * lives, and the one that cannot enforce it. The page guard decides what renders; Strapi
 * decides what is answered.
 */

export async function getPlatformStats(): Promise<PlatformStats> {
  const response = await strapi<StrapiResponse<PlatformStats>>("/api/platform/stats");
  return response.data;
}

export async function getPlatformUsers(
  page = 1,
  pageSize = 50
): Promise<{ users: PlatformUser[]; pagination?: StrapiPagination }> {
  const response = await strapi<StrapiResponse<PlatformUser[]>>(
    `/api/platform/users?page=${page}&pageSize=${pageSize}`
  );

  return { users: response.data ?? [], pagination: response.meta?.pagination };
}
