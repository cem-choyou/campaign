import { cn } from "@/lib/utils";

/** Campaign mark: a calendar tile with a rising stroke. Uses the current brand accent. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8", className)}>
      <rect width="32" height="32" rx="8" className="fill-brand" />
      <rect
        x="7"
        y="9"
        width="18"
        height="16"
        rx="3"
        className="fill-none stroke-brand-foreground"
        strokeWidth="2"
      />
      <path d="M7 14h18" className="stroke-brand-foreground" strokeWidth="2" />
      <path
        d="M11 21l3.5-3 3 2 3.5-4"
        className="fill-none stroke-brand-foreground"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 6.5v4M20 6.5v4"
        className="stroke-brand-foreground"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      <span className="text-base font-semibold tracking-tight">Campaign</span>
    </span>
  );
}
