import { redirect } from "next/navigation";

export default async function SettingsIndex({
  params,
}: {
  params: Promise<{ brandSlug: string }>;
}) {
  const { brandSlug } = await params;
  redirect(`/${brandSlug}/reglages/marque`);
}
