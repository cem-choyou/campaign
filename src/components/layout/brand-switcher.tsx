"use client";

import { ChevronsUpDown, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BrandAvatar } from "@/components/brand/brand-avatar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { navCopy } from "@/lib/copy/navigation";
import { cn } from "@/lib/utils";
import type { ShellBrand } from "./types";

export function BrandSwitcher({
  brands,
  current,
  collapsed,
  canCreateBrand,
}: {
  brands: ShellBrand[];
  current: ShellBrand;
  collapsed: boolean;
  canCreateBrand: boolean;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const showSearch = brands.length > 5;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={`${navCopy.brandSwitcher.label} (actuelle : ${current.name})`}
        className={cn(
          "hover:bg-sidebar-accent focus-visible:ring-ring flex w-full items-center gap-2 rounded-lg p-1.5 text-left transition-colors outline-none focus-visible:ring-2",
          collapsed && "justify-center",
        )}
      >
        <BrandAvatar name={current.name} color={current.color} logoUrl={current.logoUrl} />
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 truncate font-medium">{current.name}</span>
            <ChevronsUpDown className="text-muted-foreground size-4 shrink-0" aria-hidden />
          </>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <Command>
          {showSearch && <CommandInput placeholder={navCopy.brandSwitcher.search} />}
          <CommandList>
            <CommandEmpty>{navCopy.brandSwitcher.empty}</CommandEmpty>
            <CommandGroup heading={navCopy.brandSwitcher.label}>
              {brands.map((brand) => (
                <CommandItem
                  key={brand.id}
                  value={brand.name}
                  onSelect={() => {
                    setOpen(false);
                    if (brand.id !== current.id) router.push(`/${brand.slug}/aujourdhui`);
                  }}
                  data-checked={brand.id === current.id}
                  aria-current={brand.id === current.id ? "true" : undefined}
                  className="gap-2"
                >
                  <BrandAvatar
                    name={brand.name}
                    color={brand.color}
                    logoUrl={brand.logoUrl}
                    className="size-6"
                  />
                  <span className="flex-1 truncate">{brand.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            {canCreateBrand && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    value="__create"
                    onSelect={() => {
                      setOpen(false);
                      router.push("/marques/nouvelle");
                    }}
                    className="gap-2"
                  >
                    <Plus className="size-4" aria-hidden />
                    {navCopy.brandSwitcher.create}
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
