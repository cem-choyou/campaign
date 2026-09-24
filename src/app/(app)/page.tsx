import { Building2 } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { navCopy } from "@/lib/copy/navigation";
import { requireUser } from "@/server/auth/session";
import { listAccessibleBrands } from "@/server/permissions";

// Entry point: resume on the last opened brand (§8.2), else the first accessible one.
export default async function Home() {
  const user = await requireUser();
  const brands = await listAccessibleBrands(user);
  const target = brands.find((b) => b.id === user.lastBrandId) ?? brands[0];
  if (target) redirect(`/${target.slug}/aujourdhui`);

  return (
    <main className="bg-muted/40 flex min-h-dvh flex-col items-center justify-center px-4">
      <Logo className="mb-8" />
      <div className="bg-card w-full max-w-md rounded-xl border p-8 text-center">
        <div className="bg-muted text-muted-foreground mx-auto mb-4 flex size-12 items-center justify-center rounded-full">
          <Building2 className="size-6" aria-hidden />
        </div>
        <h1 className="text-lg font-semibold">{navCopy.noBrand.title}</h1>
        <p className="text-muted-foreground mt-2">
          {user.isSuperAdmin ? navCopy.noBrand.bodyAdmin : navCopy.noBrand.body}
        </p>
        {user.isSuperAdmin && (
          <Button asChild className="mt-6">
            <Link href="/marques/nouvelle">{navCopy.noBrand.create}</Link>
          </Button>
        )}
      </div>
    </main>
  );
}
