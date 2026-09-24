"use client";

import { Check, Laptop, LogOut, Moon, Sun } from "lucide-react";
import { signOutAction } from "@/app/(app)/actions";
import { useTheme } from "@/components/theme/theme-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { common } from "@/lib/copy/common";
import { navCopy } from "@/lib/copy/navigation";
import type { Theme } from "@/lib/preferences/cookies";
import { cn } from "@/lib/utils";
import type { ShellUser } from "./types";

function userInitials(user: ShellUser): string {
  const source = user.name?.trim() || user.email;
  const parts = source.split(/[\s.@_-]+/).filter(Boolean);
  return (
    parts
      .slice(0, 2)
      .map((p) => p[0])
      .join("") || "?"
  ).toUpperCase();
}

const THEME_ITEMS: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: common.theme.light, Icon: Sun },
  { value: "dark", label: common.theme.dark, Icon: Moon },
  { value: "system", label: common.theme.system, Icon: Laptop },
];

export function UserMenu({ user, collapsed }: { user: ShellUser; collapsed: boolean }) {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={navCopy.profile}
        className={cn(
          "hover:bg-sidebar-accent focus-visible:ring-ring flex w-full items-center gap-2 rounded-lg p-1.5 text-left outline-none focus-visible:ring-2",
          collapsed && "justify-center",
        )}
      >
        <Avatar className="size-7">
          {user.image && <AvatarImage src={user.image} alt="" />}
          <AvatarFallback className="text-[11px]">{userInitials(user)}</AvatarFallback>
        </Avatar>
        {!collapsed && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{user.name ?? user.email}</span>
            {user.isSuperAdmin && (
              <span className="text-muted-foreground block truncate text-xs">
                {navCopy.superAdmin}
              </span>
            )}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate font-medium">{user.name ?? user.email}</span>
          <span className="text-muted-foreground block truncate text-xs">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
          {common.theme.label}
        </DropdownMenuLabel>
        {THEME_ITEMS.map(({ value, label, Icon }) => (
          <DropdownMenuItem key={value} onSelect={() => setTheme(value)}>
            <Icon aria-hidden />
            {label}
            {theme === value && <Check className="ml-auto" aria-label="Sélectionné" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOutAction()}>
          <LogOut aria-hidden />
          {navCopy.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
