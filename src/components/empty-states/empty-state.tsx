import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Calm, monochrome empty state (§8.10): what is missing + the next action. */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  body?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-xl border border-dashed px-6 py-12 text-center",
        className,
      )}
    >
      <div className="bg-muted text-muted-foreground mb-4 flex size-12 items-center justify-center rounded-full">
        <Icon className="size-6" aria-hidden />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      {body && <p className="text-muted-foreground mt-1 max-w-sm">{body}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
