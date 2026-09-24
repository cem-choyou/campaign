import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { settingsCopy } from "@/lib/copy/settings";
import { requireUser } from "@/server/auth/session";
import { NewBrandForm } from "./new-brand-form";

export const metadata: Metadata = { title: settingsCopy.newBrand.title };

export default async function NewBrandPage() {
  const user = await requireUser();
  if (!user.isSuperAdmin) notFound();
  return (
    <main className="bg-muted/40 flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Logo className="mb-8" />
      <div className="bg-card w-full max-w-md rounded-xl border p-6 sm:p-8">
        <h1 className="text-lg font-semibold">{settingsCopy.newBrand.title}</h1>
        <p className="text-muted-foreground mt-1">{settingsCopy.newBrand.description}</p>
        <NewBrandForm />
      </div>
    </main>
  );
}
