"use client";

import { Pencil } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Rename in place (§8.4): click → field; Enter or blur saves, Escape cancels. The new value is
 * shown optimistically and rolled back if the save fails.
 */
export function InlineEdit({
  value,
  onSave,
  label,
  hint,
  maxLength = 120,
  className,
  inputClassName,
  disabled,
  editing: controlledEditing,
  onEditingChange,
}: {
  value: string;
  onSave: (next: string) => Promise<boolean>;
  label: string;
  hint?: string;
  maxLength?: number;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  editing?: boolean;
  onEditingChange?: (editing: boolean) => void;
}) {
  const [localEditing, setLocalEditing] = useState(false);
  const editing = controlledEditing ?? localEditing;
  const setEditing = (next: boolean) => {
    setLocalEditing(next);
    onEditingChange?.(next);
  };
  const [draft, setDraft] = useState(value);
  const [optimistic, setOptimistic] = useState<string | null>(null);
  const cancelled = useRef(false);
  const shown = optimistic ?? value;

  const commit = async () => {
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    setEditing(false);
    const next = draft.trim();
    if (!next || next === value) return setDraft(value);
    setOptimistic(next);
    const ok = await onSave(next);
    setOptimistic(null);
    if (!ok) setDraft(value);
  };

  if (editing) {
    return (
      <input
        autoFocus
        aria-label={label}
        title={hint}
        value={draft}
        maxLength={maxLength}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            cancelled.current = true;
            setDraft(value);
            setEditing(false);
          }
        }}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "border-ring bg-background ring-ring/30 -mx-1.5 w-full min-w-0 rounded-md border px-1.5 py-0.5 ring-2 outline-none",
          inputClassName,
        )}
      />
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        cancelled.current = false;
        setDraft(shown);
        setEditing(true);
      }}
      aria-label={`${label} : ${shown}. Cliquer pour renommer.`}
      className={cn(
        "group/inline hover:bg-muted/70 -mx-1.5 inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 text-left disabled:pointer-events-none",
        className,
      )}
    >
      <span className="truncate">{shown}</span>
      {!disabled && (
        <Pencil
          className="text-muted-foreground size-3.5 shrink-0 opacity-0 transition-opacity group-hover/inline:opacity-100 group-focus-visible/inline:opacity-100"
          aria-hidden
        />
      )}
    </button>
  );
}
