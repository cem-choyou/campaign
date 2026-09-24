import { readableOn } from "@/lib/color";
import { cn } from "@/lib/utils";

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters =
    words.length > 1 ? words.slice(0, 2).map((w) => w[0]) : [...(words[0] ?? "?")].slice(0, 2);
  return letters.join("").toUpperCase();
}

/** Brand logo, or a tile with the brand color and initials. */
export function BrandAvatar({
  name,
  color,
  logoUrl,
  className,
}: {
  name: string;
  color: string;
  logoUrl?: string | null;
  className?: string;
}) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- external logo URL, no optimization needed
      <img
        src={logoUrl}
        alt=""
        className={cn("size-7 shrink-0 rounded-md bg-white object-contain", className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold",
        className,
      )}
      style={{ backgroundColor: color, color: readableOn(color) }}
    >
      {initials(name)}
    </span>
  );
}
