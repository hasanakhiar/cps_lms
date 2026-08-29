import ReactMarkdown from "react-markdown";

/**
 * Render Strapi richtext, which is Markdown.
 *
 * `react-markdown` rather than `dangerouslySetInnerHTML`. Lesson bodies and blog posts
 * are written by instructors and content managers — trusted people, but "trusted" is a
 * statement about intent, not about what happens when one of those accounts is
 * compromised. This parses Markdown to React elements and never interprets raw HTML,
 * so a `<script>` in a lesson body renders as visible text instead of executing. The
 * safety is structural: there is no escape hatch to forget to apply.
 *
 * Styling is per-element rather than through a typography plugin, to keep the
 * dependency list short.
 */
export function Markdown({ content }: { content: string | null }) {
  if (!content?.trim()) {
    return <p className="text-sm text-muted-foreground">No content yet.</p>;
  }

  return (
    <div className="flex flex-col gap-4 text-[0.95rem] leading-7">
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h2 className="mt-4 text-2xl font-semibold tracking-tight">{children}</h2>
          ),
          h2: ({ children }) => (
            <h3 className="mt-4 text-xl font-semibold tracking-tight">{children}</h3>
          ),
          h3: ({ children }) => <h4 className="mt-2 text-lg font-semibold">{children}</h4>,
          p: ({ children }) => <p className="text-pretty">{children}</p>,
          ul: ({ children }) => <ul className="ml-6 list-disc space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="ml-6 list-decimal space-y-1">{children}</ol>,
          a: ({ href, children }) => (
            <a
              href={href}
              className="font-medium text-primary underline underline-offset-4"
              // Links in user-authored content point off-site. `noopener` stops the
              // opened page reaching back through `window.opener`.
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">{children}</code>
          ),
          pre: ({ children }) => (
            <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm">{children}</pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 pl-4 text-muted-foreground italic">
              {children}
            </blockquote>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
