import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { postTextRequestSchema, streamPostText } from "@/server/ai/posts";
import { assertSameOrigin, errorResponse } from "@/server/http";
import { requireCampaignPermission } from "@/server/permissions";

export const dynamic = "force-dynamic";

// Streams a post text as plain UTF-8 (editor: write, 3 variants, rewrites). Errors before the first
// byte are JSON with an HTTP status; a failure mid-stream aborts the response.
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const parsed = postTextRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new AppError("INVALID", parsed.error.issues[0]?.message ?? undefined);
    }
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
    // Pull the first chunk before answering, so early failures still get a proper status.
    const first = await iterator.next();
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        if (!first.done) controller.enqueue(encoder.encode(first.value));
        else controller.close();
      },
      async pull(controller) {
        try {
          const next = await iterator.next();
          if (next.done) controller.close();
          else controller.enqueue(encoder.encode(next.value));
        } catch (error) {
          controller.error(error);
        }
      },
      async cancel() {
        await iterator.return("");
      },
    });
    return new Response(body, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error, "ai.post.failed");
  }
}
