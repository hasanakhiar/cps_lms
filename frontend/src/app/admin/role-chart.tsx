import type { RoleType } from "@/types";

/**
 * Users per role, as a horizontal bar chart.
 *
 * Plain SVG rather than a charting library. Four bars do not justify a dependency, and
 * an inline SVG renders on the server with no client JavaScript at all — the rest of
 * this page is a Server Component and a chart library would be the only reason to ship
 * a bundle for it.
 *
 * Bars are drawn as `<rect>` widths proportional to the largest value, not to the
 * total, so the smallest role stays visible rather than collapsing to a sliver.
 */
const ROLE_COLOURS: Record<RoleType, string> = {
  admin: "var(--color-chart-1, #ef4444)",
  "content-manager": "var(--color-chart-2, #f59e0b)",
  instructor: "var(--color-chart-3, #3b82f6)",
  student: "var(--color-chart-4, #10b981)",
};

const ROLE_ORDER: RoleType[] = ["admin", "content-manager", "instructor", "student"];

export function RoleChart({ perRole }: { perRole: Record<RoleType, number> }) {
  const rows = ROLE_ORDER.map((role) => ({ role, count: perRole[role] ?? 0 }));
  const max = Math.max(...rows.map((row) => row.count), 1);

  const rowHeight = 36;
  const barHeight = 18;
  const labelWidth = 130;
  const width = 460;

  return (
    <svg
      viewBox={`0 0 ${width} ${rows.length * rowHeight}`}
      className="h-auto w-full max-w-lg"
      role="img"
      aria-label={rows.map((row) => `${row.role}: ${row.count}`).join(", ")}
    >
      {rows.map((row, index) => {
        const y = index * rowHeight;
        const barWidth = Math.max((row.count / max) * (width - labelWidth - 40), row.count > 0 ? 4 : 0);

        return (
          <g key={row.role}>
            <text
              x={0}
              y={y + barHeight}
              className="fill-current text-[13px] text-muted-foreground"
            >
              {row.role}
            </text>

            <rect
              x={labelWidth}
              y={y + 4}
              width={barWidth}
              height={barHeight}
              rx={4}
              fill={ROLE_COLOURS[row.role]}
            />

            <text
              x={labelWidth + barWidth + 8}
              y={y + barHeight}
              className="fill-current text-[13px] font-medium tabular-nums"
            >
              {row.count}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
