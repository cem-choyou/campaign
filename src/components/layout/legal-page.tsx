import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { LegalFooter } from "@/components/layout/legal-footer";
import { legalCopy } from "@/lib/copy/legal";

export function LegalPage({
  title,
  updated,
  sections,
}: {
  title: string;
  updated?: string;
  sections: readonly { title: string; body: readonly string[] }[];
}) {
  return (
    <div className="bg-muted/30 min-h-dvh px-4 py-10">
      <main className="bg-card mx-auto max-w-2xl rounded-xl border p-6 sm:p-10">
        <div className="mb-8 flex items-center justify-between gap-4">
          <Logo />
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {legalCopy.back}
          </Link>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {updated && <p className="text-muted-foreground mt-1 text-sm">{updated}</p>}
        <div className="mt-8 grid gap-7">
          {sections.map((s) => (
            <section key={s.title}>
              <h2 className="text-base font-semibold">{s.title}</h2>
              {s.body.map((p) => (
                <p key={p} className="text-muted-foreground mt-2 leading-relaxed">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>
      </main>
      <LegalFooter className="mt-8 justify-center" />
    </div>
  );
}
