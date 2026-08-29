import "server-only";
import { auth } from "@/auth";

/**
 * The only module in this application that calls Strapi.
 *
 * `import "server-only"` is the enforcement, not the convention: importing this file
 * from a Client Component is a **build error**, not a runtime leak discovered in
 * production. That single line is what makes "the browser never talks to Strapi"
 * checkable by the compiler instead of by code review.
 *
 * Having exactly one door in and out of the backend is also what makes the system
 * reviewable — there is one place where the token is attached, one place where caching
 * is decided, and one place where errors are shaped.
 */

const BASE = process.env.STRAPI_URL;

/**
 * Fail at module load rather than at the first request.
 *
 * A missing `STRAPI_URL` would otherwise surface as `fetch("undefined/api/courses")`
 * deep inside an unrelated page, which is a much worse first day on a new deployment
 * than a startup error naming the variable.
 */
if (!BASE) {
  throw new Error("STRAPI_URL is not set");
}

/** An error carrying the HTTP status, so callers can branch on 403 vs 404 vs 500. */
export class StrapiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "StrapiError";
  }
}

type StrapiOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  /** Attach the caller's Strapi token. Defaults to true. */
  auth?: boolean;
  /** Revalidation window for unauthenticated reads, in seconds. */
  revalidate?: number | false;
};

/**
 * Call Strapi as the current user.
 *
 * @throws {StrapiError} on any non-2xx response, with the status attached.
 */
export async function strapi<T>(path: string, opts: StrapiOptions = {}): Promise<T> {
  const { body, auth: needsAuth = true, revalidate, ...rest } = opts;

  const headers = new Headers(rest.headers);
  headers.set("Content-Type", "application/json");

  if (needsAuth) {
    const session = await auth();

    // Fail before the network call. Sending an anonymous request and letting Strapi
    // answer 403 would work, but it turns a clear "you are not logged in" into a
    // confusing "you are not allowed", and costs a round trip to find out.
    if (!session?.strapiToken) {
      throw new StrapiError("Not authenticated", 401);
    }

    headers.set("Authorization", `Bearer ${session.strapiToken}`);
  }

  const response = await fetch(`${BASE}${path}`, {
    ...rest,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    /**
     * Authenticated responses are per-user and must never be shared between visitors,
     * so they are never cached — a cached "my enrolments" served to the next person
     * is a data leak that no amount of backend hardening would catch. Public reads
     * are the same for everyone and may be cached.
     */
    cache: needsAuth ? "no-store" : undefined,
    next: needsAuth ? undefined : { revalidate: revalidate === false ? 0 : (revalidate ?? 60) },
  });

  if (!response.ok) {
    // Prefer Strapi's own message, which is usually specific ("Cannot demote the last
    // remaining admin"), and fall back to the status text when the body is not JSON —
    // a proxy timeout returns HTML, and parsing it must not mask the real status.
    let detail = response.statusText;
    try {
      const parsed = (await response.json()) as { error?: { message?: string } };
      detail = parsed?.error?.message ?? detail;
    } catch {
      // Non-JSON error body; the status text stands.
    }
    throw new StrapiError(detail, response.status);
  }

  // 204 No Content has no body to parse.
  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
