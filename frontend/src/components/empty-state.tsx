import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * The "there is nothing here" state.
 *
 * Every empty state takes an action, because an empty page with no way forward is a
 * dead end — a student with no enrolments should be one click from the catalogue, not
 * left to find it. The action is required by the type rather than optional, so it
 * cannot be forgotten.
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
  action: { href: string; label: string };
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
        {Icon ? <Icon className="size-10 text-muted-foreground" aria-hidden="true" /> : null}
        <div className="flex flex-col gap-1">
          <p className="text-lg font-medium">{title}</p>
          <p className="max-w-md text-sm text-muted-foreground text-pretty">{description}</p>
        </div>
        <Button render={<Link href={action.href} />}>{action.label}</Button>
      </CardContent>
    </Card>
  );
}
