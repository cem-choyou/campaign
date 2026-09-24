"use client";

import { PlanningView, type PlanningMode } from "./planning-view";
import type { CalendarView } from "./post-calendar";
import type { PlanningOptions, PlanningPost } from "./types";

/** Brand-wide calendar: posts open in their own campaign page. */
export function BrandPlanning({
  brandSlug,
  ...props
}: {
  brandSlug: string;
  posts: PlanningPost[];
  options: PlanningOptions;
  timezone: string;
  canEdit: boolean;
  initialMode: PlanningMode;
  initialView: CalendarView;
  initialDate: string;
}) {
  return (
    <PlanningView
      {...props}
      campaignId={null}
      showCampaign
      campaignHref={(id) => `/${brandSlug}/campagnes/${id}`}
    />
  );
}
