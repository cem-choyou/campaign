export type ShellBrand = {
  id: string;
  name: string;
  slug: string;
  color: string;
  logoUrl: string | null;
};

export type ShellUser = {
  name: string | null;
  email: string;
  image: string | null;
  isSuperAdmin: boolean;
};

export type ShellPermissions = {
  canManageBrand: boolean;
  canEditCampaigns: boolean;
  canCreateBrand: boolean;
};
