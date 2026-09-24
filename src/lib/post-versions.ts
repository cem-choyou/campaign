// Text history of a post (§8.7): which version rows a save should write. Pure, unit-tested.

export type VersionSource = "AI" | "HUMAN" | "IMPORTED";

export type LatestVersion = {
  id: string;
  source: VersionSource;
  createdById: string | null;
  createdAt: Date;
  body: string;
};

export type VersionStep =
  | { kind: "create"; body: string; source: VersionSource; at?: Date }
  | { kind: "update"; id: string; body: string };

/** Human edits by the same person within this window are one version (an editing session). */
export const SESSION_MS = 10 * 60 * 1000;

export function planVersions({
  latest,
  previous,
  next,
  actorId,
  now = new Date(),
}: {
  latest: LatestVersion | null;
  /** Text before this save, and where it came from. */
  previous: { body: string | null; source: "EMPTY" | VersionSource };
  next: { body: string | null; source: VersionSource };
  actorId: string;
  now?: Date;
}): VersionStep[] {
  const body = next.body?.trim() ? next.body : null;
  if (!body || body === previous.body) return [];
  const steps: VersionStep[] = [];

  // First change of a text that has no history yet (imported, or written before lot 2): keep it.
  if (!latest && previous.body?.trim()) {
    steps.push({
      kind: "create",
      body: previous.body,
      source: previous.source === "EMPTY" ? "HUMAN" : previous.source,
      at: new Date(now.getTime() - 1),
    });
  }

  const sameSession =
    next.source === "HUMAN" &&
    latest?.source === "HUMAN" &&
    latest.createdById === actorId &&
    now.getTime() - latest.createdAt.getTime() < SESSION_MS;

  if (sameSession && latest) steps.push({ kind: "update", id: latest.id, body });
  else steps.push({ kind: "create", body, source: next.source });
  return steps;
}
