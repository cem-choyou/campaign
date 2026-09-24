"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { navCopy } from "@/lib/copy/navigation";

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="bg-muted text-muted-foreground inline-flex h-5 min-w-5 items-center justify-center rounded border px-1 font-sans text-[11px] font-medium">
      {children}
    </kbd>
  );
}

export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{navCopy.shortcuts.title}</DialogTitle>
          <DialogDescription>{navCopy.shortcuts.description}</DialogDescription>
        </DialogHeader>
        <ul className="divide-y">
          {navCopy.shortcuts.items.map((item) => (
            <li key={item.label} className="flex items-center justify-between gap-4 py-2.5">
              <span>{item.label}</span>
              <span className="flex gap-1">
                {item.keys.map((k) => (
                  <Kbd key={k}>{k}</Kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground text-xs">{navCopy.shortcuts.contact}</p>
      </DialogContent>
    </Dialog>
  );
}
