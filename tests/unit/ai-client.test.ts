import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const env = { AI_TRANSPORT: "mock", AI_MODEL: "claude-sonnet-5", AI_DAILY_LIMIT_PER_BRAND: 3 };
const queryRaw = vi.fn();

vi.mock("@/env", () => ({ env }));
vi.mock("@/server/db", () => ({ db: { $queryRaw: queryRaw } }));

const { streamText, generateObject, generateText } = await import("@/server/ai/client");
const { consumeAi } = await import("@/server/ai/quota");
const { resetRateLimits } = await import("@/server/rate-limit");

const prompt = { system: "s", user: "u" };

describe("AI client (mock transport)", () => {
  it("streams the canned text in chunks and returns it whole", async () => {
    const text = "Un texte de test assez long pour être découpé en plusieurs morceaux.";
    const pieces: string[] = [];
    const iterator = streamText(prompt, { task: "post.write", mock: () => text });
    let result = await iterator.next();
    while (!result.done) {
      pieces.push(result.value);
      result = await iterator.next();
    }
    expect(pieces.length).toBeGreaterThan(1);
    expect(pieces.join("")).toBe(text);
    expect(result.value).toBe(text);
  });

  it("collects a full text", async () => {
    await expect(generateText(prompt, { task: "post.write", mock: () => '"Texte"' })).resolves.toBe(
      "Texte",
    );
  });

  it("validates structured outputs with the schema", async () => {
    const schema = z.object({ title: z.string() });
    await expect(
      generateObject(prompt, schema, { task: "post.youtube", mock: () => ({ title: "Ok" }) }),
    ).resolves.toEqual({ title: "Ok" });
    await expect(
      generateObject(prompt, schema, {
        task: "post.youtube",
        mock: () => ({ title: 1 }) as unknown as { title: string },
      }),
    ).rejects.toThrow();
  });
});

describe("AI quota", () => {
  const brand = { id: "b1", timezone: "Europe/Paris" };
  beforeEach(() => {
    resetRateLimits();
    queryRaw.mockReset();
  });

  it("counts on the brand's local day", async () => {
    queryRaw.mockResolvedValue([{ count: 1 }]);
    // 23:30 UTC on 4 Oct = 01:30 on 5 Oct in Paris.
    await consumeAi(brand, "u1", 1, new Date("2026-10-04T23:30:00Z"));
    const values = queryRaw.mock.calls[0]!.slice(1);
    expect(values).toContainEqual(new Date("2026-10-05T00:00:00.000Z"));
  });

  it("refuses once the daily cap is reached (no row returned)", async () => {
    queryRaw.mockResolvedValue([]);
    await expect(consumeAi(brand, "u1")).rejects.toThrow(/limite quotidienne de 3/);
  });

  it("refuses a request larger than the cap without touching the database", async () => {
    await expect(consumeAi(brand, "u1", 4)).rejects.toThrow(/limite quotidienne/);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it("limits bursts per user", async () => {
    queryRaw.mockResolvedValue([{ count: 1 }]);
    const now = new Date("2026-10-05T08:00:00Z");
    for (let i = 0; i < 30; i++) await consumeAi(brand, "u2", 1, now);
    await expect(consumeAi(brand, "u2", 1, now)).rejects.toThrow(/Patientez/);
  });
});
