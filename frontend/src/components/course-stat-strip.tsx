/**
 * The labelled metadata strip on a course card.
 *
 * Three labelled columns rather than one run-on muted sentence. The label sits above
 * the value in a fixed position on every card, so the eye scans *down* a column across
 * cards instead of re-reading each line to find the number it wants.
 *
 * Each entry supplies its own already-pluralised label, which is why this takes
 * `{ label, value }` rather than deriving the label from the key — the previous version
 * of this line rendered "1 quizzes".
 */
export function CourseStatStrip({
  items,
}: {
  items: ReadonlyArray<{ label: string; value: string | number }>;
}) {
  return (
    <dl className="grid grid-cols-3 divide-x rounded-lg border">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-0.5 px-3 py-2">
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className="text-sm font-medium tabular-nums">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** `1 lesson` / `4 lessons` — the pluralisation this strip previously got wrong. */
export function plural(count: number, singular: string, pluralForm?: string): string {
  return `${count} ${count === 1 ? singular : (pluralForm ?? `${singular}s`)}`;
}
