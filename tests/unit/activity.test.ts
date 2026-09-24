import { describe, expect, it } from "vitest";
import { activitySentence } from "@/lib/activity";

describe("activitySentence", () => {
  it("writes readable French sentences", () => {
    expect(activitySentence("campaign.renamed", { to: "LDDLT" }, "Cem")).toBe(
      "Cem a renommé la campagne en « LDDLT »",
    );
    expect(activitySentence("content.created", { code: "CAP1" }, "Cem")).toBe(
      "Cem a ajouté le contenu CAP1",
    );
    expect(activitySentence("post.deleted", { count: 3 }, "Cem")).toBe("Cem a supprimé 3 posts");
    expect(activitySentence("campaign.duplicated", { from: "A", shiftDays: 7 }, "Cem")).toBe(
      "Cem a dupliqué « A » en décalant les dates de 7 jours",
    );
  });

  it("falls back on unknown types", () => {
    expect(activitySentence("x.y", {}, "Anne")).toBe("Anne a modifié la campagne");
  });
});
