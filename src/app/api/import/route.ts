import { importCopy } from "@/lib/copy/import";
import { AppError } from "@/server/errors";
import { assertSameOrigin, errorResponse } from "@/server/http";
import { createImportJob, previewImport } from "@/server/import";
import { isTemplate, parseTemplate, readWorkbook } from "@/server/import/parse";
import { logger } from "@/server/logger";
import { requireBrandPermission, requireCampaignPermission } from "@/server/permissions";
import { rateLimit } from "@/server/rate-limit";

export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;

// Upload of an Excel file (§8.8 steps 1-2). A route rather than a Server Action: actions are
// limited to 1 MB of body. Returns the job id and, for the template, the preview.
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    const brandId = String(form?.get("brandId") ?? "");
    const campaignId = String(form?.get("campaignId") ?? "") || null;
    if (!brandId) throw new AppError("INVALID");

    const access = campaignId
      ? await requireCampaignPermission(campaignId, "campaign.edit")
      : await requireBrandPermission({ brandId }, "campaign.edit");
    if (access.brand.id !== brandId) throw new AppError("NOT_FOUND");
    const limit = rateLimit(`import:${access.user.id}`, 20, 10 * 60_000);
    if (!limit.ok) throw new AppError("CONFLICT", importCopy.errors.tooMany);

    if (!(file instanceof File) || file.size === 0)
      throw new AppError("INVALID", importCopy.errors.noFile);
    if (file.size > MAX_BYTES) throw new AppError("INVALID", importCopy.errors.tooBig);
    if (!/\.xlsx$/i.test(file.name)) throw new AppError("INVALID", importCopy.errors.notXlsx);

    let workbook;
    try {
      workbook = await readWorkbook(await file.arrayBuffer());
    } catch (error) {
      logger.warn("import.unreadable", { error: error instanceof Error ? error.message : "?" });
      throw new AppError("INVALID", importCopy.errors.unreadable);
    }

    if (!isTemplate(workbook)) {
      throw new AppError("INVALID", importCopy.errors.notTemplate);
    }
    const parsed = parseTemplate(workbook);
    const job = await createImportJob({
      brandId,
      campaignId,
      fileName: file.name,
      parsed,
      status: "PARSED",
      actor: access.user,
    });
    const canCreate = access.can("brand.manage");
    const { preview, choices } = await previewImport(
      { campaignId, payload: parsed },
      brandId,
      {},
      canCreate,
    );
    return Response.json({
      jobId: job.id,
      status: "PARSED",
      fileName: file.name,
      preview,
      choices,
    });
  } catch (error) {
    return errorResponse(error, "import.failed");
  }
}
