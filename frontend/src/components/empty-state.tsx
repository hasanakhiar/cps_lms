import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * The "there is nothing here" state.
 *
 * An empty page with no way forward is a dead end — a student with no enrolments
 * should be one click from the catalogue, not left to find it — so an action is
 * supplied wherever one exists.
 *
 * It is optional rather than required because one case genuinely has none: an
 * instructor with no courses cannot create one, and inventing a button that leads to
 * a screen they are refused would be worse than the missing button. Optional here
 * means "there is nothing this reader may do", not "nobody got round to it".
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: { href: string; label: string };
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
        {Icon ? <Icon className="size-10 text-muted-foreground" aria-hidden="true" /> : null}
        <div className="flex flex-col gap-1">
          <p className="text-lg font-medium">{title}</p>
          <p className="max-w-md text-sm text-muted-foreground text-pretty">{description}</p>
        </div>
        {action ? (
          <Button render={<Link href={action.href} />}>{action.label}</Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
