import { postFormatLabels } from "@/lib/copy/common";
import type { PostFormat, PostStatus } from "@/lib/posts";

/** Post as displayed by the planning views (serializable from server components). */
export type PlanningPost = {
  id: string;
  campaignId: string;
  campaignName?: string;
  status: PostStatus;
  format: PostFormat;
  scheduledAt: Date;
  angle: string | null;
  body: string | null;
  youtubeTitle: string | null;
  content: { id: string; code: string; title: string; mediaUrl: string | null } | null;
  socialAccount: { id: string; name: string; platform: "LINKEDIN" | "YOUTUBE" } | null;
  authorContributor: { id: string; firstName: string; lastName: string | null } | null;
};

export type PlanningOptions = {
  accounts: { id: string; name: string; platform: "LINKEDIN" | "YOUTUBE" }[];
  contributors: { id: string; firstName: string; lastName: string | null }[];
  contents: { id: string; code: string; title: string; type: string }[];
  campaigns?: { id: string; name: string }[];
};

export function platformOfPost(post: PlanningPost): "LINKEDIN" | "YOUTUBE" {
  return post.socialAccount?.platform ?? "LINKEDIN";
}

export function publisherLabel(post: PlanningPost): string {
  if (post.socialAccount) return post.socialAccount.name;
  if (post.authorContributor) {
    return `${post.authorContributor.firstName} ${post.authorContributor.lastName ?? ""}`.trim();
  }
  return "—";
}

export function postTitle(post: PlanningPost): string {
  return (
    post.content?.title ??
    post.youtubeTitle ??
    post.angle ??
    post.body?.slice(0, 60) ??
    postFormatLabels[post.format]
  );
}
