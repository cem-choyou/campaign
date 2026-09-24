"use client";

import {
  CalendarDays,
  CircleHelp,
  Home,
  Megaphone,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { BrandAvatar } from "@/components/brand/brand-avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { navCopy } from "@/lib/copy/navigation";
import { SIDEBAR_COOKIE, writePreferenceCookie } from "@/lib/preferences/cookies";
import { cn } from "@/lib/utils";
import { BrandSwitcher } from "./brand-switcher";
import { CommandPalette } from "./command-palette";
import { Kbd, ShortcutsDialog } from "./shortcuts-dialog";
import type { ShellBrand, ShellPermissions, ShellUser } from "./types";
import { UserMenu } from "./user-menu";

type NavItem = { href: string; label: string; Icon: typeof Home; match: string };

function useIsMac(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => /Mac|iPhone|iPad/.test(navigator.userAgent),
    () => false,
  );
}

export function AppShell({
  user,
  brand,
  brands,
  permissions,
  timezone,
  initialCollapsed,
  children,
}: {
  user: ShellUser;
  brand: ShellBrand;
  brands: ShellBrand[];
  permissions: ShellPermissions;
  timezone: string;
  initialCollapsed: boolean;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const pathname = usePathname();
  const isMac = useIsMac();

  const base = `/${brand.slug}`;
  const items: NavItem[] = [
    { href: `${base}/aujourdhui`, label: navCopy.today, Icon: Home, match: `${base}/aujourdhui` },
    {
      href: `${base}/campagnes`,
      label: navCopy.campaigns,
      Icon: Megaphone,
      match: `${base}/campagnes`,
    },
    {
      href: `${base}/calendrier`,
      label: navCopy.calendar,
      Icon: CalendarDays,
      match: `${base}/calendrier`,
    },
    ...(permissions.canManageBrand
      ? [
          {
            href: `${base}/reglages`,
            label: navCopy.settings,
            Icon: Settings,
            match: `${base}/reglages`,
          },
        ]
      : []),
  ];

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      writePreferenceCookie(SIDEBAR_COOKIE, prev ? "expanded" : "collapsed");
      return !prev;
    });
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Close the mobile menu after navigating.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMobileOpen(false);
  }

  const shortcut = isMac ? ["⌘", "K"] : ["Ctrl", "K"];

  const sidebar = (compact: boolean) => (
    <div className="flex h-full flex-col gap-1 p-2">
      <BrandSwitcher
        brands={brands}
        current={brand}
        collapsed={compact}
        canCreateBrand={permissions.canCreateBrand}
      />

      <SidebarButton
        compact={compact}
        label={navCopy.palette.sidebarLabel}
        Icon={Search}
        onClick={() => setPaletteOpen(true)}
        className="text-muted-foreground mt-2"
        trailing={
          <span className="flex gap-0.5" aria-hidden>
            {shortcut.map((k) => (
              <Kbd key={k}>{k}</Kbd>
            ))}
          </span>
        }
      />

      <nav aria-label="Navigation principale" className="mt-2 flex flex-col gap-0.5">
        {items.map((item) => {
          const active = pathname === item.match || pathname.startsWith(`${item.match}/`);
          const link = (
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "focus-visible:ring-ring flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors outline-none focus-visible:ring-2",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                compact && "justify-center px-0",
              )}
            >
              <item.Icon className={cn("size-4 shrink-0", active && "text-brand")} aria-hidden />
              {compact ? <span className="sr-only">{item.label}</span> : item.label}
            </Link>
          );
          return compact ? (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          ) : (
            <div key={item.href}>{link}</div>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-0.5">
        <SidebarButton
          compact={compact}
          label={navCopy.help}
          Icon={CircleHelp}
          onClick={() => setHelpOpen(true)}
          className="text-sidebar-foreground/80"
        />
        <div className="hidden md:block">
          <SidebarButton
            compact={compact}
            label={compact ? navCopy.expand : navCopy.collapse}
            Icon={compact ? PanelLeftOpen : PanelLeftClose}
            onClick={toggleCollapsed}
            className="text-sidebar-foreground/80"
          />
        </div>
        <div className="border-sidebar-border mt-1 border-t pt-2">
          <UserMenu user={user} collapsed={compact} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "bg-sidebar border-sidebar-border sticky top-0 hidden h-dvh shrink-0 border-r transition-[width] duration-200 ease-out md:block",
          collapsed ? "w-14" : "w-60",
        )}
      >
        {sidebar(collapsed)}
      </aside>

      {/* Mobile top bar + drawer */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-30 flex h-12 items-center gap-2 border-b px-2 backdrop-blur md:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
            aria-label={navCopy.openMenu}
          >
            <Menu />
          </Button>
          <BrandAvatar
            name={brand.name}
            color={brand.color}
            logoUrl={brand.logoUrl}
            className="size-6 text-[10px]"
          />
          <span className="flex-1 truncate font-medium">{brand.name}</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setPaletteOpen(true)}
            aria-label={navCopy.palette.trigger}
          >
            <Search />
          </Button>
        </header>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="bg-sidebar w-72 p-0" showCloseButton={false}>
            <SheetTitle className="sr-only">{navCopy.openMenu}</SheetTitle>
            <SheetDescription className="sr-only">Navigation principale</SheetDescription>
            {sidebar(false)}
          </SheetContent>
        </Sheet>

        <main id="contenu" className="min-w-0 flex-1">
          {children}
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        brand={brand}
        brands={brands}
        permissions={permissions}
        timezone={timezone}
      />
      <ShortcutsDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
}

function SidebarButton({
  compact,
  label,
  Icon,
  onClick,
  className,
  trailing,
}: {
  compact: boolean;
  label: string;
  Icon: typeof Home;
  onClick: () => void;
  className?: string;
  trailing?: React.ReactNode;
}) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "hover:bg-sidebar-accent/60 hover:text-sidebar-foreground focus-visible:ring-ring flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm transition-colors outline-none focus-visible:ring-2",
        compact && "justify-center px-0",
        className,
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {compact ? (
        <span className="sr-only">{label}</span>
      ) : (
        <>
          <span className="flex-1 truncate">{label}</span>
          {trailing}
        </>
      )}
    </button>
  );
  if (!compact) return button;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}
