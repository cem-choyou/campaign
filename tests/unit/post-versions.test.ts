import { describe, expect, it } from "vitest";
import { type LatestVersion, SESSION_MS, planVersions } from "@/lib/post-versions";

const now = new Date("2026-10-05T10:00:00Z");
const human = (over: Partial<LatestVersion> = {}): LatestVersion => ({
  id: "v1",
  source: "HUMAN",
  createdById: "u1",
  createdAt: new Date(now.getTime() - 60_000),
  body: "Ancien",
  ...over,
});

describe("planVersions", () => {
  it("does nothing when the text is empty or unchanged", () => {
    const previous = { body: "Même", source: "HUMAN" as const };
    expect(
      planVersions({
        latest: null,
        previous,
        next: { body: "Même", source: "HUMAN" },
        actorId: "u1",
        now,
      }),
    ).toEqual([]);
    expect(
      planVersions({
        latest: null,
        previous,
        next: { body: "  ", source: "HUMAN" },
        actorId: "u1",
        now,
      }),
    ).toEqual([]);
  });

  it("keeps the original imported text before its first change", () => {
    const steps = planVersions({
      latest: null,
      previous: { body: "Texte importé", source: "IMPORTED" },
      next: { body: "Texte retouché", source: "HUMAN" },
      actorId: "u1",
      now,
    });
    expect(steps).toEqual([
      {
        kind: "create",
        body: "Texte importé",
        source: "IMPORTED",
        at: new Date(now.getTime() - 1),
      },
      { kind: "create", body: "Texte retouché", source: "HUMAN" },
    ]);
  });

  it("merges human edits of one person into one session", () => {
    const steps = planVersions({
      latest: human(),
      previous: { body: "Ancien", source: "HUMAN" },
      next: { body: "Ancien, complété", source: "HUMAN" },
      actorId: "u1",
      now,
    });
    expect(steps).toEqual([{ kind: "update", id: "v1", body: "Ancien, complété" }]);
  });

  it("starts a new version after the session window, for another person, or for an AI text", () => {
    const base = { previous: { body: "Ancien", source: "HUMAN" as const }, now };
    const late = human({ createdAt: new Date(now.getTime() - SESSION_MS - 1) });
    expect(
      planVersions({
        ...base,
        latest: late,
        next: { body: "B", source: "HUMAN" },
        actorId: "u1",
      })[0],
    ).toMatchObject({ kind: "create" });
    expect(
      planVersions({
        ...base,
        latest: human(),
        next: { body: "B", source: "HUMAN" },
        actorId: "u2",
      })[0],
    ).toMatchObject({ kind: "create" });
    expect(
      planVersions({ ...base, latest: human(), next: { body: "B", source: "AI" }, actorId: "u1" }),
    ).toEqual([{ kind: "create", body: "B", source: "AI" }]);
  });
});
