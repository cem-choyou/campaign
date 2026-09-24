import { redirect } from "next/navigation";

export default async function BrandIndex({ params }: { params: Promise<{ brandSlug: string }> }) {
  const { brandSlug } = await params;
  redirect(`/${brandSlug}/aujourdhui`);
}
