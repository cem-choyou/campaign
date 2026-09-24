import { CheckCircle2, Circle, CircleDashed, CircleDot, Clock, XCircle } from "lucide-react";
import { campaignStatusLabels, postStatusLabels } from "@/lib/copy/common";
import { cn } from "@/lib/utils";

type PostStatus = keyof typeof postStatusLabels;
type CampaignStatus = keyof typeof campaignStatusLabels;

const POST_STYLES: Record<PostStatus, { className: string; Icon: typeof Circle }> = {
  DRAFT: { className: "bg-status-draft-bg text-status-draft", Icon: CircleDashed },
  IN_REVIEW: { className: "bg-status-review-bg text-status-review", Icon: Clock },
  APPROVED: { className: "bg-status-approved-bg text-status-approved", Icon: CircleDot },
  PROCESSING: { className: "bg-status-approved-bg text-status-approved", Icon: Clock },
  PUBLISHED: { className: "bg-status-published-bg text-status-published", Icon: CheckCircle2 },
  FAILED: { className: "bg-status-failed-bg text-status-failed", Icon: XCircle },
  CANCELLED: { className: "bg-muted text-muted-foreground line-through", Icon: Circle },
};

const CAMPAIGN_STYLES: Record<CampaignStatus, string> = {
  DRAFT: "bg-status-draft-bg text-status-draft",
  ACTIVE: "bg-status-published-bg text-status-published",
  COMPLETED: "bg-status-approved-bg text-status-approved",
  ARCHIVED: "bg-muted text-muted-foreground",
};

const pill = "inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-medium";

/** Status pill: color + icon + text (never color alone, WCAG 1.4.1). */
export function PostStatusBadge({ status, className }: { status: PostStatus; className?: string }) {
  const { className: tone, Icon } = POST_STYLES[status];
  return (
    <span className={cn(pill, tone, className)}>
      <Icon className="size-3.5" aria-hidden />
      {postStatusLabels[status]}
    </span>
  );
}

export function CampaignStatusBadge({
  status,
  archived,
  className,
}: {
  status: CampaignStatus;
  archived?: boolean;
  className?: string;
}) {
  const key: CampaignStatus = archived ? "ARCHIVED" : status;
  return (
    <span className={cn(pill, CAMPAIGN_STYLES[key], className)}>
      {key === "ACTIVE" && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {campaignStatusLabels[key]}
    </span>
  );
}
