/**
 * Turn a YouTube or Vimeo URL into something that can be embedded.
 *
 * Instructors paste whatever URL is in their address bar, which is a `watch` page, not
 * an embed URL — putting that straight into an iframe renders YouTube's "refused to
 * connect" box. So the common forms are converted here.
 *
 * Anything unrecognised returns `null` and the caller renders a plain link instead.
 * That is deliberate: an arbitrary URL in an iframe is an arbitrary site running in a
 * frame on our origin's page, so only the two hosts we can vouch for are ever embedded.
 */
export type EmbeddedVideo = { kind: "youtube" | "vimeo"; embedUrl: string };

export function toEmbeddedVideo(rawUrl: string | null): EmbeddedVideo | null {
  if (!rawUrl?.trim()) return null;

  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    // Not a URL at all — a typo, or someone pasted a title.
    return null;
  }

  // Only https. An http iframe on an https page is blocked as mixed content anyway.
  if (url.protocol !== "https:") return null;

  const host = url.hostname.replace(/^www\./, "");

  // youtube.com/watch?v=ID
  if (host === "youtube.com" || host === "m.youtube.com") {
    const id = url.searchParams.get("v");
    if (id) return { kind: "youtube", embedUrl: `https://www.youtube.com/embed/${id}` };

    // Already an embed URL — pass it through rather than mangling it.
    if (url.pathname.startsWith("/embed/")) {
      return { kind: "youtube", embedUrl: url.toString() };
    }
    return null;
  }

  // youtu.be/ID — the share link
  if (host === "youtu.be") {
    const id = url.pathname.slice(1);
    return id ? { kind: "youtube", embedUrl: `https://www.youtube.com/embed/${id}` } : null;
  }

  // vimeo.com/ID
  if (host === "vimeo.com") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    // Vimeo ids are numeric; anything else is a channel or a category page.
    return id && /^\d+$/.test(id)
      ? { kind: "vimeo", embedUrl: `https://player.vimeo.com/video/${id}` }
      : null;
  }

  if (host === "player.vimeo.com") {
    return { kind: "vimeo", embedUrl: url.toString() };
  }

  return null;
}
