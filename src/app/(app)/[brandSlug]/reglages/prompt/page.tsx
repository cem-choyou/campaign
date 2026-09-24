import { BrandPromptForm } from "@/components/settings/brand-prompt-form";
import { getBrandPrompt } from "@/server/brands";
import { requireBrandPage } from "@/server/permissions";

export default async function BrandPromptPage({
  params,
}: {
  params: Promise<{ brandSlug: string }>;
}) {
  const { brandSlug } = await params;
  const { brand } = await requireBrandPage(brandSlug, "brand.manage");
  const prompt = await getBrandPrompt(brand.id);
  return (
    <BrandPromptForm
      key={brand.id}
      brand={{ id: brand.id, name: brand.name, color: brand.color, logoUrl: brand.logoUrl }}
      initial={{
        editorialLine: prompt.editorialLine,
        tone: prompt.tone,
        dos: prompt.dos,
        donts: prompt.donts,
        examplePosts: prompt.examplePosts,
        hashtags: prompt.hashtags,
        defaultCta: prompt.defaultCta ?? "",
        mentionHandle: prompt.mentionHandle ?? "",
        extraInstructions: prompt.extraInstructions ?? "",
      }}
    />
  );
}
