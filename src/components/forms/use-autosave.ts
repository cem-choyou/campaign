"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";
type SaveResult = { ok: true } | { ok: false; error: string };

/**
 * Debounced autosave (§8.1 « ne jamais perdre de travail »). Saves `value` `delay` ms after the
 * last change when `enabled`, retries once on failure, and guards against leaving the page while
 * a change is not yet saved.
 */
export function useAutosave<T>({
  value,
  save,
  delay = 800,
  enabled = true,
  initialValue,
}: {
  value: T;
  save: (value: T) => Promise<SaveResult>;
  delay?: number;
  enabled?: boolean;
  /** Value already persisted (nothing to save until it changes). */
  initialValue?: T;
}) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const lastSaved = useRef(JSON.stringify(initialValue ?? value));
  const saveRef = useRef(save);
  const inFlight = useRef<Promise<void> | null>(null);
  const serialized = JSON.stringify(value);
  const latest = useRef({ value, serialized });

  useEffect(() => {
    saveRef.current = save;
    latest.current = { value, serialized };
  });

  const flush = useCallback(async () => {
    const { value: current, serialized: snapshot } = latest.current;
    if (snapshot === lastSaved.current) return;
    setStatus("saving");
    const attempt = async (retry: boolean): Promise<void> => {
      const result = await saveRef
        .current(current)
        .catch((): SaveResult => ({ ok: false, error: "network" }));
      if (result.ok) {
        lastSaved.current = snapshot;
        setError(null);
        // A newer change may be waiting: the effect below schedules it.
        setStatus(latest.current.serialized === snapshot ? "saved" : "pending");
        return;
      }
      if (retry) return attempt(false);
      setError(result.error);
      setStatus("error");
    };
    inFlight.current = attempt(true);
    await inFlight.current;
    inFlight.current = null;
  }, []);

  useEffect(() => {
    if (!enabled || serialized === lastSaved.current) return;
    setStatus((s) => (s === "saving" ? s : "pending"));
    const handle = setTimeout(() => void flush(), delay);
    return () => clearTimeout(handle);
  }, [serialized, enabled, delay, flush]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (latest.current.serialized !== lastSaved.current || inFlight.current) {
        event.preventDefault();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  return { status, error, flush };
}
