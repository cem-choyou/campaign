"use client";

import {
  CalendarDays,
  FileText,
  Home,
  Laptop,
  Megaphone,
  Moon,
  Plus,
  Settings,
  Sun,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { type PaletteResults, searchPalette } from "@/app/(app)/actions";
import { BrandAvatar } from "@/components/brand/brand-avatar";
import { useTheme } from "@/components/theme/theme-provider";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { campaignStatusLabels } from "@/lib/copy/common";
import { navCopy } from "@/lib/copy/navigation";
import { formatDayTime } from "@/lib/dates";
import type { ShellBrand, ShellPermissions } from "./types";

const EMPTY: PaletteResults = { campaigns: [], posts: [] };

export function CommandPalette({
  open,
  onOpenChange,
  brand,
  brands,
  permissions,
  timezone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brand: ShellBrand;
  brands: ShellBrand[];
  permissions: ShellPermissions;
  timezone: string;
}) {
  const router = useRouter();
  const { setTheme } = useTheme();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PaletteResults>(EMPTY);
  const [pending, startTransition] = useTransition();

  // Debounced server search, scoped to the active brand.
  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(() => {
      startTransition(async () => {
        const res = await searchPalette({ brandId: brand.id, query });
        setResults(res.ok ? res.data : EMPTY);
      });
    }, 180);
    return () => clearTimeout(handle);
  }, [open, query, brand.id]);

  const run = (fn: () => void) => {
    onOpenChange(false);
    setQuery("");
    fn();
  };
  const go = (href: string) => run(() => router.push(href));
  const base = `/${brand.slug}`;

  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setQuery("");
      }}
      title={navCopy.palette.trigger}
      className="sm:max-w-xl"
    >
      {/* Results come from the server: cmdk must not filter them again. */}
      <Command shouldFilter={false}>
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder={navCopy.palette.placeholder}
        />
        <CommandList className="max-h-[min(60vh,420px)]">
          <CommandEmpty>{pending ? navCopy.palette.loading : navCopy.palette.empty}</CommandEmpty>

          {permissions.canEditCampaigns && !query && (
            <CommandGroup heading={navCopy.palette.groups.actions}>
              <CommandItem onSelect={() => go(`${base}/campagnes/nouvelle`)}>
                <Plus aria-hidden />
                {navCopy.palette.createCampaign}
              </CommandItem>
            </CommandGroup>
          )}

          {results.campaigns.length > 0 && (
            <CommandGroup heading={navCopy.palette.groups.campaigns} forceMount>
              {results.campaigns.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`campaign-${c.id}`}
                  onSelect={() => go(`${base}/campagnes/${c.id}`)}
                >
                  <Megaphone aria-hidden />
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {campaignStatusLabels[c.status as keyof typeof campaignStatusLabels]}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {results.posts.length > 0 && (
            <CommandGroup heading={navCopy.palette.groups.posts} forceMount>
              {results.posts.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`post-${p.id}`}
                  onSelect={() => go(`${base}/campagnes/${p.campaignId}?post=${p.id}`)}
                >
                  <FileText aria-hidden />
                  <span className="flex-1 truncate">{p.label}</span>
                  <span className="text-muted-foreground tabular text-xs">
                    {formatDayTime(new Date(p.scheduledAt), timezone)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {!query && (
            <>
              <CommandSeparator />
              <CommandGroup heading={navCopy.palette.groups.navigation}>
                <CommandItem onSelect={() => go(`${base}/aujourdhui`)}>
                  <Home aria-hidden />
                  {navCopy.today}
                </CommandItem>
                <CommandItem onSelect={() => go(`${base}/campagnes`)}>
                  <Megaphone aria-hidden />
                  {navCopy.campaigns}
                </CommandItem>
                <CommandItem onSelect={() => go(`${base}/calendrier`)}>
                  <CalendarDays aria-hidden />
                  {navCopy.calendar}
                </CommandItem>
                {permissions.canManageBrand && (
                  <CommandItem onSelect={() => go(`${base}/reglages`)}>
                    <Settings aria-hidden />
                    {navCopy.settings}
                  </CommandItem>
                )}
              </CommandGroup>

              {brands.length > 1 && (
                <CommandGroup heading={navCopy.palette.groups.brands}>
                  {brands
                    .filter((b) => b.id !== brand.id)
                    .map((b) => (
                      <CommandItem key={b.id} onSelect={() => go(`/${b.slug}/aujourdhui`)}>
                        <BrandAvatar
                          name={b.name}
                          color={b.color}
                          logoUrl={b.logoUrl}
                          className="size-5 text-[9px]"
                        />
                        {b.name}
                      </CommandItem>
                    ))}
                </CommandGroup>
              )}

              <CommandGroup heading={navCopy.palette.groups.theme}>
                <CommandItem onSelect={() => run(() => setTheme("light"))}>
                  <Sun aria-hidden />
                  {navCopy.palette.themeLight}
                </CommandItem>
                <CommandItem onSelect={() => run(() => setTheme("dark"))}>
                  <Moon aria-hidden />
                  {navCopy.palette.themeDark}
                </CommandItem>
                <CommandItem onSelect={() => run(() => setTheme("system"))}>
                  <Laptop aria-hidden />
                  {navCopy.palette.themeSystem}
                </CommandItem>
              </CommandGroup>
            </>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
