import { cn } from "@/lib/utils";

export function SettingsSection({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("max-w-3xl", className)}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {description && <p className="text-muted-foreground mt-1 max-w-prose">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
