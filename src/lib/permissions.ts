// Access matrix (CLAUDE.md §7). Pure and shared by server checks and UI hints: hiding a button is
// never a security measure, every Server Action re-checks on the server.

export type BrandRole = "ADMIN" | "VALIDATOR" | "EDITOR" | "CLIENT";

export type Permission =
  | "brand.view"
  | "campaign.edit" // create / edit campaigns, contents and posts
  | "post.submit"
  | "post.approve"
  | "post.comment"
  | "campaign.launch" // launch / pause
  | "brand.manage" // contributors, accounts, brand prompt and settings
  | "access.manage" // invite, change roles
  | "brand.create"
  | "brand.viewAll";

export type AccessContext = {
  isSuperAdmin: boolean;
  role: BrandRole | null;
  clientCanApprove?: boolean;
};

export const ROLE_RANK: Record<BrandRole, number> = {
  CLIENT: 0,
  EDITOR: 1,
  VALIDATOR: 2,
  ADMIN: 3,
};

const MIN_ROLE: Record<Exclude<Permission, "brand.create" | "brand.viewAll">, BrandRole> = {
  "brand.view": "CLIENT",
  "post.comment": "CLIENT",
  "campaign.edit": "EDITOR",
  "post.submit": "EDITOR",
  "post.approve": "VALIDATOR",
  "campaign.launch": "VALIDATOR",
  "brand.manage": "ADMIN",
  "access.manage": "ADMIN",
};

export function hasRole(role: BrandRole | null, minRole: BrandRole): boolean {
  return role !== null && ROLE_RANK[role] >= ROLE_RANK[minRole];
}

export function can(ctx: AccessContext, permission: Permission): boolean {
  if (ctx.isSuperAdmin) return true;
  if (permission === "brand.create" || permission === "brand.viewAll") return false;
  if (permission === "post.approve" && ctx.role === "CLIENT") return ctx.clientCanApprove === true;
  return hasRole(ctx.role, MIN_ROLE[permission]);
}
