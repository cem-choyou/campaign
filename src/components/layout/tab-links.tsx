"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Route-based tabs (each tab is a URL, so it can be shared and reloaded). */
export function TabLinks({
  items,
  className,
  label,
}: {
  items: { href: string; label: string; count?: number; exact?: boolean }[];
  className?: string;
  label: string;
}) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className={cn("border-b", className)}>
      <ul className="-mb-px flex gap-1 overflow-x-auto">
        {items.map((item) => {
          const active =
            pathname === item.href || (!item.exact && pathname.startsWith(`${item.href}/`));
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "focus-visible:ring-ring inline-flex h-10 items-center gap-1.5 border-b-2 px-3 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-2",
                  active
                    ? "border-brand text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground border-transparent",
                )}
              >
                {item.label}
                {item.count !== undefined && (
                  <span className="bg-muted text-muted-foreground tabular rounded-full px-1.5 text-xs">
                    {item.count}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
