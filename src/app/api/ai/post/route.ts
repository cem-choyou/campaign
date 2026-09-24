import { postTextRequestSchema, streamPostText } from "@/server/ai/posts";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { assertSameOrigin, errorResponse, textStreamResponse } from "@/server/http";
import { requireCampaignPermission } from "@/server/permissions";

export const dynamic = "force-dynamic";

// Streams a post text (editor: write, 3 variants, rewrites).
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const parsed = postTextRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new AppError("INVALID", parsed.error.issues[0]?.message);
    const post = await db.post.findUnique({
      where: { id: parsed.data.postId },
      select: { campaignId: true },
    });
    if (!post) throw new AppError("NOT_FOUND");
    const access = await requireCampaignPermission(post.campaignId, "campaign.edit");
    const iterator = await streamPostText(
      parsed.data,
      { userId: access.user.id, brandId: access.brand.id },
      request.signal,
    );
    return await textStreamResponse(iterator);
  } catch (error) {
    return errorResponse(error, "ai.post.failed");
  }
}
