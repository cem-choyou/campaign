import { buildCampaignWorkbook, workbookBuffer } from "@/server/export/template";
import { AppError } from "@/server/errors";
import { errorResponse } from "@/server/http";
import { getTemplateInput } from "@/server/import";
import { requireBrandPermission } from "@/server/permissions";

export const dynamic = "force-dynamic";

// « Télécharger le modèle » (§12): the campaign workbook, pre-filled with the brand's accounts
// and contributors. GET /api/templates/campagne?marque=<slug>
export async function GET(request: Request) {
  try {
    const slug = new URL(request.url).searchParams.get("marque");
    if (!slug) throw new AppError("INVALID");
    const access = await requireBrandPermission({ brandSlug: slug }, "brand.view");
    const brand = await getTemplateInput(access.brand.id);
    const buffer = await workbookBuffer(
      buildCampaignWorkbook({
        brand: { name: brand.name, color: brand.color },
        accounts: brand.accounts,
        contributors: brand.contributors,
      }),
    );
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="modele-campagne-${brand.slug}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return errorResponse(error, "template.failed");
  }
}
