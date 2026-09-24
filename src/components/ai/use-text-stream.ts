"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { aiCopy } from "@/lib/copy/ai";

export type StreamStatus = "idle" | "streaming" | "done" | "error";

/**
 * Reads a plain-text stream from one of the app's AI routes (POST JSON → text/plain). Errors
 * sent before the stream starts are JSON `{ error }` with an HTTP status.
 */
export function useTextStream() {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  const reset = useCallback(() => {
    stop();
    setText("");
    setStatus("idle");
    setError(null);
  }, [stop]);

  /** Resolves with the full text (or null when it failed or was stopped). */
  const start = useCallback(
    async (url: string, body: unknown): Promise<string | null> => {
      stop();
      const abort = new AbortController();
      controller.current = abort;
      setText("");
      setError(null);
      setStatus("streaming");
      let full = "";
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: abort.signal,
        });
        if (!response.ok || !response.body) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? aiCopy.errors.failed);
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          full += decoder.decode(value, { stream: true });
          setText(full);
        }
        full += decoder.decode();
        full = full.trim();
        setText(full);
        setStatus("done");
        return full;
      } catch (e) {
        if (abort.signal.aborted) {
          setStatus(full ? "done" : "idle");
          return null;
        }
        setError(
          e instanceof Error && e.message !== "Failed to fetch" ? e.message : aiCopy.errors.failed,
        );
        setStatus("error");
        return null;
      } finally {
        if (controller.current === abort) controller.current = null;
      }
    },
    [stop],
  );

  return { text, status, error, start, stop, reset, setText };
}
