import Link from "next/link";
import { common } from "@/lib/copy/common";
import { cn } from "@/lib/utils";

export function LegalFooter({ className }: { className?: string }) {
  return (
    <footer className={cn("text-muted-foreground flex gap-4 text-xs", className)}>
      <Link
        href="/confidentialite"
        className="hover:text-foreground underline-offset-4 hover:underline"
      >
        {common.footer.privacy}
      </Link>
      <Link
        href="/mentions-legales"
        className="hover:text-foreground underline-offset-4 hover:underline"
      >
        {common.footer.legal}
      </Link>
    </footer>
  );
}
