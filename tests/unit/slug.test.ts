import { describe, expect, it } from "vitest";
import { slugify, uniqueSlug } from "@/lib/slug";

describe("slugify", () => {
  it("builds readable URL slugs", () => {
    expect(slugify("IT for Business")).toBe("it-for-business");
    expect(slugify("  Café & Crème — Été 2026 ")).toBe("cafe-et-creme-ete-2026");
    expect(slugify("!!!")).toBe("");
  });

  it("adds a suffix when taken", async () => {
    const taken = new Set(["it-for-business", "it-for-business-2"]);
    expect(await uniqueSlug("IT for Business", async (s) => taken.has(s))).toBe(
      "it-for-business-3",
    );
    expect(await uniqueSlug("???", async () => false)).toBe("marque");
  });
});
