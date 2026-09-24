"use client";

import { ArrowRight, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  commitImportAction,
  previewImportAction,
} from "@/app/(app)/[brandSlug]/campagnes/import-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { importCopy } from "@/lib/copy/import";
import type { ImportPreview, Overrides, PreviewChoices, RowOverride } from "@/lib/import/types";
import { cn } from "@/lib/utils";
import type { MappingView } from "@/server/import";
import { PreviewCalendar, PreviewSummary, PreviewTable } from "./import-preview";
import { MappingStep } from "./mapping-step";

const copy = importCopy;

type Loaded = { jobId: string; fileName: string; preview: ImportPreview; choices: PreviewChoices };
type Mapped = { jobId: string; fileName: string; view: MappingView };
type UploadResult =
  | { error: string }
  | ({ status: "PARSED" } & Loaded)
  | { status: "NEEDS_MAPPING"; jobId: string; fileName: string; mapping: MappingView };
type Done = { campaignId: string; created: number; skipped: number; replaced: number };

export function ImportFlow({
  brand,
  campaign,
  onDone,
}: {
  brand: { id: string; slug: string; timezone: string };
  campaign: { id: string; name: string } | null;
  /** Rendered after a successful import (e.g. « Rédiger les textes vides avec l'IA »). */
  onDone?: (done: Done) => React.ReactNode;
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [mapping, setMapping] = useState<Mapped | null>(null);
  const [overrides, setOverrides] = useState<Overrides>({});
  const [mode, setMode] = useState<"add" | "replace">("add");
  const [done, setDone] = useState<Done | null>(null);
  const [uploading, setUploading] = useState(false);
  const [committing, startCommit] = useTransition();
  const [refreshing, setRefreshing] = useState(false);
  /** Bumped on every correction (also when the last one is removed). */
  const [version, setVersion] = useState(0);
  const request = useRef(0);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("brandId", brand.id);
      if (campaign) form.set("campaignId", campaign.id);
      const response = await fetch("/api/import", { method: "POST", body: form });
      const payload = (await response.json().catch(() => null)) as UploadResult | null;
      if (!response.ok || !payload || "error" in payload) {
        toast.error((payload && "error" in payload && payload.error) || copy.errors.network);
        return;
      }
      setOverrides({});
      if (payload.status === "NEEDS_MAPPING") {
        setMapping({ jobId: payload.jobId, fileName: payload.fileName, view: payload.mapping });
        setLoaded(null);
      } else {
        setMapping(null);
        setLoaded(payload);
      }
    } catch {
      toast.error(copy.errors.network);
    } finally {
      setUploading(false);
    }
  };

  // Corrections are re-validated on the server (debounced), which recomputes the whole preview.
  useEffect(() => {
    if (!loaded || version === 0) return;
    const id = ++request.current;
    const handle = setTimeout(async () => {
      const result = await previewImportAction({
        brandId: brand.id,
        jobId: loaded.jobId,
        overrides,
      });
      if (id !== request.current) return;
      setRefreshing(false);
      if (!result.ok) return void toast.error(result.error);
      setLoaded((l) => (l ? { ...l, ...result.data } : l));
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run on corrections only
  }, [version]);

  const setOverride = (row: number, patch: RowOverride | null) => {
    setOverrides((o) => {
      const next = { ...o };
      if (patch && Object.values(patch).some((v) => v !== undefined)) next[row] = patch;
      else delete next[row];
      return next;
    });
    setRefreshing(true);
    setVersion((v) => v + 1);
  };

  const commit = () =>
    startCommit(async () => {
      if (!loaded) return;
      const result = await commitImportAction({
        brandId: brand.id,
        jobId: loaded.jobId,
        overrides,
        mode,
      });
      if (!result.ok) return void toast.error(result.error);
      setDone(result.data);
    });

  if (done) {
    const base = `/${brand.slug}/campagnes/${done.campaignId}`;
    return (
      <section
        aria-labelledby="import-done"
        className="mx-auto flex max-w-xl flex-col items-center rounded-2xl border px-6 py-10 text-center"
      >
        <div className="bg-status-published-bg text-status-published mb-4 flex size-12 items-center justify-center rounded-full">
          <CheckCircle2 className="size-6" aria-hidden />
        </div>
        <h2 id="import-done" className="text-lg font-semibold">
          {copy.done.title}
        </h2>
        <p className="text-muted-foreground mt-1">
          {copy.done.body(done.created, done.skipped)}
          {done.replaced > 0 && ` ${copy.done.replaced(done.replaced)}`}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {onDone?.(done)}
          <Button asChild variant={onDone ? "outline" : "default"}>
            <Link href={base}>
              {copy.done.open}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      </section>
    );
  }

  if (!loaded && mapping) {
    return (
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
        <FileBar fileName={mapping.fileName} onRestart={() => setMapping(null)} busy={false} />
        <MappingStep
          brandId={brand.id}
          jobId={mapping.jobId}
          view={mapping.view}
          existingCampaign={!!campaign}
          onConfirmed={(result) => {
            setLoaded({ jobId: mapping.jobId, fileName: mapping.fileName, ...result });
          }}
        />
      </div>
    );
  }

  if (!loaded) {
    return <DropZone brandSlug={brand.slug} uploading={uploading} onFile={(f) => void upload(f)} />;
  }

  const { preview, choices } = loaded;
  const blocked = preview.counts.errors > 0 || preview.counts.posts === 0;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <FileBar
        fileName={loaded.fileName}
        busy={refreshing}
        onRestart={() => {
          setLoaded(null);
          setMapping(null);
          setOverrides({});
        }}
      />

      <PreviewSummary preview={preview} />

      {campaign && (
        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium">{copy.mode.label}</legend>
          <RadioGroup
            value={mode}
            onValueChange={(v) => setMode(v as "add" | "replace")}
            className="flex flex-wrap gap-4"
          >
            {(["add", "replace"] as const).map((m) => (
              <div key={m} className="flex items-center gap-2">
                <RadioGroupItem id={`mode-${m}`} value={m} />
                <Label htmlFor={`mode-${m}`} className="font-normal">
                  {copy.mode[m]}
                </Label>
              </div>
            ))}
          </RadioGroup>
          <p className="text-muted-foreground text-xs">{copy.mode.replaceHint}</p>
        </fieldset>
      )}

      <section aria-labelledby="import-calendar" className="grid gap-2">
        <h2 id="import-calendar" className="text-sm font-semibold">
          {copy.preview.calendar}
        </h2>
        <PreviewCalendar posts={preview.posts} />
      </section>

      <section aria-labelledby="import-table" className="grid gap-2">
        <h2 id="import-table" className="text-sm font-semibold">
          {copy.preview.table}
        </h2>
        <PreviewTable
          preview={preview}
          choices={choices}
          timezone={brand.timezone}
          overrides={overrides}
          onOverride={setOverride}
        />
      </section>

      <div className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky bottom-0 z-20 -mx-4 border-t backdrop-blur sm:-mx-8">
        <div className="flex flex-wrap items-center justify-end gap-3 px-4 py-3 sm:px-8">
          {blocked && (
            <span className="text-muted-foreground text-sm" aria-live="polite">
              {copy.submitBlocked}
            </span>
          )}
          <Button type="button" disabled={blocked || committing || refreshing} onClick={commit}>
            {committing && <Loader2 className="animate-spin" aria-hidden />}
            {committing ? copy.importing : copy.submit(preview.counts.posts)}
          </Button>
        </div>
      </div>
    </div>
  );
}

function FileBar({
  fileName,
  busy,
  onRestart,
}: {
  fileName: string;
  busy: boolean;
  onRestart: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <FileSpreadsheet className="text-muted-foreground size-4" aria-hidden />
      <span className="min-w-0 truncate text-sm font-medium">{fileName}</span>
      <Button type="button" variant="ghost" size="sm" onClick={onRestart}>
        {copy.restart}
      </Button>
      {busy && <Loader2 className="text-muted-foreground size-4 animate-spin" aria-hidden />}
    </div>
  );
}

function DropZone({
  brandSlug,
  uploading,
  onFile,
}: {
  brandSlug: string;
  uploading: boolean;
  onFile: (file: File) => void;
}) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const file = e.dataTransfer.files[0];
          if (file && !uploading) onFile(file);
        }}
        className={cn(
          "flex min-h-64 flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors",
          over ? "border-brand bg-brand/5" : "border-border",
        )}
      >
        <div className="bg-muted text-muted-foreground mb-4 flex size-12 items-center justify-center rounded-full">
          {uploading ? (
            <Loader2 className="size-6 animate-spin" aria-hidden />
          ) : (
            <Upload className="size-6" aria-hidden />
          )}
        </div>
        <p className="font-semibold" aria-live="polite">
          {uploading ? copy.drop.reading : copy.drop.title}
        </p>
        {!uploading && <p className="text-muted-foreground mt-1 text-sm">{copy.drop.body}</p>}
        <input
          ref={input}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          aria-label={copy.drop.choose}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) onFile(file);
          }}
        />
        <Button
          type="button"
          className="mt-5"
          disabled={uploading}
          onClick={() => input.current?.click()}
        >
          <FileSpreadsheet aria-hidden />
          {copy.drop.choose}
        </Button>
      </div>
      <aside className="bg-muted/40 grid content-start gap-3 rounded-2xl border p-5">
        <h2 className="font-semibold">{copy.drop.templateTitle}</h2>
        <p className="text-muted-foreground text-sm">{copy.drop.templateBody}</p>
        <Button asChild variant="outline" className="w-fit">
          <a href={`/api/templates/campagne?marque=${encodeURIComponent(brandSlug)}`} download>
            <Download aria-hidden />
            {copy.drop.download}
          </a>
        </Button>
      </aside>
    </div>
  );
}
