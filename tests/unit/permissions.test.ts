import { beforeEach, describe, expect, it, vi } from "vitest";
import { type AccessContext, type BrandRole, type Permission, can } from "@/lib/permissions";

// ---------- Pure matrix: CLAUDE.md §7, row by row ----------
const roles: (BrandRole | "SUPER")[] = ["SUPER", "ADMIN", "VALIDATOR", "EDITOR", "CLIENT"];
const matrix: Record<Permission, boolean[]> = {
  //                  SUPER  ADMIN  VALID  EDITOR CLIENT
  "brand.viewAll": [true, false, false, false, false],
  "brand.view": [true, true, true, true, true],
  "campaign.edit": [true, true, true, true, false],
  "post.submit": [true, true, true, true, false],
  "post.approve": [true, true, true, false, false],
  "post.comment": [true, true, true, true, true],
  "campaign.launch": [true, true, true, false, false],
  "brand.manage": [true, true, false, false, false],
  "access.manage": [true, true, false, false, false],
  "brand.create": [true, false, false, false, false],
};

function ctx(role: BrandRole | "SUPER", clientCanApprove = false): AccessContext {
  return role === "SUPER"
    ? { isSuperAdmin: true, role: null }
    : { isSuperAdmin: false, role, clientCanApprove };
}

describe("can() matches the §7 access table", () => {
  for (const [permission, expected] of Object.entries(matrix) as [Permission, boolean[]][]) {
    roles.forEach((role, i) => {
      it(`${role} ${expected[i] ? "can" : "cannot"} ${permission}`, () => {
        expect(can(ctx(role), permission)).toBe(expected[i]);
      });
    });
  }

  it("lets a client approve only with clientCanApprove", () => {
    expect(can(ctx("CLIENT", true), "post.approve")).toBe(true);
    expect(can(ctx("CLIENT", true), "campaign.edit")).toBe(false);
  });

  it("denies everything to a non-member", () => {
    expect(can({ isSuperAdmin: false, role: null }, "brand.view")).toBe(false);
  });
});

// ---------- Server resolution (database mocked) ----------
const brands = {
  b1: {
    id: "b1",
    name: "IT for Business",
    slug: "it-for-business",
    color: "#1F3A5F",
    logoUrl: null,
    timezone: "Europe/Paris",
    archivedAt: null,
  },
  b2: {
    id: "b2",
    name: "Client X",
    slug: "client-x",
    color: "#000000",
    logoUrl: null,
    timezone: "Europe/Paris",
    archivedAt: null,
  },
  old: {
    id: "old",
    name: "Old",
    slug: "old",
    color: "#000000",
    logoUrl: null,
    timezone: "Europe/Paris",
    archivedAt: new Date(),
  },
};
type TestUser = {
  id: string;
  email: string;
  isSuperAdmin: boolean;
  memberships: { brandId: string; role: BrandRole; clientCanApprove: boolean }[];
};
let currentUser: TestUser | null = null;

vi.mock("react", async (orig) => ({
  ...(await orig<typeof import("react")>()),
  cache: <T>(fn: T) => fn,
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND_PAGE");
  },
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`);
  },
}));
vi.mock("@/server/auth/session", () => ({ getCurrentUser: async () => currentUser }));
vi.mock("@/server/db", () => ({
  db: {
    brand: {
      findUnique: async ({ where }: { where: { id?: string; slug?: string } }) =>
        Object.values(brands).find((b) => b.id === where.id || b.slug === where.slug) ?? null,
    },
  },
}));

const { getBrandAccess, requireBrandPermission, requireBrandRole, requireBrandPage } =
  await import("@/server/permissions");

describe("brand access resolution", () => {
  beforeEach(() => {
    currentUser = {
      id: "u1",
      email: "editor@example.fr",
      isSuperAdmin: false,
      memberships: [{ brandId: "b1", role: "EDITOR", clientCanApprove: false }],
    };
  });

  it("resolves the member's role by slug or id", async () => {
    const access = await getBrandAccess({ brandSlug: "it-for-business" });
    expect(access?.role).toBe("EDITOR");
    expect(access?.can("campaign.edit")).toBe(true);
    expect((await getBrandAccess({ brandId: "b1" }))?.brand.slug).toBe("it-for-business");
  });

  it("hides other brands and archived brands", async () => {
    expect(await getBrandAccess({ brandId: "b2" })).toBeNull();
    currentUser!.isSuperAdmin = true;
    expect(await getBrandAccess({ brandId: "old" })).toBeNull();
  });

  it("gives a super admin access to every active brand", async () => {
    currentUser = { ...currentUser!, isSuperAdmin: true, memberships: [] };
    const access = await getBrandAccess({ brandId: "b2" });
    expect(access?.can("access.manage")).toBe(true);
  });

  it("requireBrandPermission reports not found vs forbidden", async () => {
    await expect(requireBrandPermission({ brandId: "b2" }, "brand.view")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(requireBrandPermission({ brandId: "b1" }, "post.approve")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(requireBrandPermission({ brandId: "b1" }, "post.submit")).resolves.toBeTruthy();
  });

  it("requireBrandRole enforces the minimum role", async () => {
    await expect(requireBrandRole({ brandId: "b1" }, "EDITOR")).resolves.toBeTruthy();
    await expect(requireBrandRole({ brandId: "b1" }, "ADMIN")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("requireBrandPage 404s on forbidden pages and redirects anonymous users", async () => {
    await expect(requireBrandPage("it-for-business", "brand.manage")).rejects.toThrow(
      "NOT_FOUND_PAGE",
    );
    currentUser = null;
    await expect(requireBrandPage("it-for-business")).rejects.toThrow("REDIRECT /connexion");
  });
});
