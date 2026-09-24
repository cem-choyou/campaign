import { sandboxRequestSchema, streamSandboxPost } from "@/server/ai/sandbox";
import { AppError } from "@/server/errors";
import { assertSameOrigin, errorResponse, textStreamResponse } from "@/server/http";
import { requireBrandPermission } from "@/server/permissions";

export const dynamic = "force-dynamic";

// Streams a trial post for Réglages › Prompt « Tester » (brand admins only).
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const parsed = sandboxRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new AppError("INVALID", parsed.error.issues[0]?.message);
    const access = await requireBrandPermission({ brandId: parsed.data.brandId }, "brand.manage");
    const iterator = await streamSandboxPost(
      parsed.data,
      { userId: access.user.id },
      request.signal,
    );
    return await textStreamResponse(iterator);
  } catch (error) {
    return errorResponse(error, "ai.sandbox.failed");
  }
}
