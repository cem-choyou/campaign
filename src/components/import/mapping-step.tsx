"use client";

import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { confirmMappingAction } from "@/app/(app)/[brandSlug]/campagnes/import-actions";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { importCopy } from "@/lib/copy/import";
import { MAPPING_FIELDS, MAPPING_LABELS, type Mapping, type MappingField } from "@/lib/import/free";
import type { ImportPreview, PreviewChoices } from "@/lib/import/types";
import { cn } from "@/lib/utils";
import type { MappingView } from "@/server/import";

const copy = importCopy.mapping;

export function MappingStep({
  brandId,
  jobId,
  view,
  existingCampaign,
  onConfirmed,
}: {
  brandId: string;
  jobId: string;
  view: MappingView;
  existingCampaign: boolean;
  onConfirmed: (result: { preview: ImportPreview; choices: PreviewChoices }) => void;
}) {
  const [mapping, setMapping] = useState<Mapping>(view.mapping);
  const [name, setName] = useState(view.defaults.name);
  const [startDate, setStartDate] = useState(view.defaults.startDate ?? "");
  const [pending, start] = useTransition();

  const has = (f: MappingField) => mapping.includes(f);
  const ready = has("account") && (has("date") || (has("week") && has("day")));
  const needsStart = !has("date") && !existingCampaign;

  const setField = (column: number, field: MappingField) =>
    setMapping((m) =>
      m.map((current, i) => {
        if (i === column) return field;
        // Each field maps one column: the previous one goes back to « Ignorer ».
        return field !== "ignore" && current === field ? "ignore" : current;
      }),
    );

  const confirm = () =>
    start(async () => {
      const result = await confirmMappingAction({ brandId, jobId, mapping, name, startDate });
      if (!result.ok) return void toast.error(result.error);
      onConfirmed(result.data);
    });

  return (
    <section aria-labelledby="mapping-title" className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <div>
        <h2 id="mapping-title" className="text-base font-semibold">
          {copy.title}
        </h2>
        <p className="text-muted-foreground mt-1 flex items-start gap-1.5">
          <Sparkles className="text-brand mt-1 size-4 shrink-0" aria-hidden />
          {view.source === "ai" ? copy.intro : copy.heuristic}
        </p>
        <p className="text-muted-foreground mt-1 text-sm">
          {copy.sheet(view.sheet, view.rowCount)}
        </p>
      </div>

      {!existingCampaign && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={copy.campaignName} required>
            {(p) => (
              <Input
                {...p}
                value={name}
                maxLength={120}
                onChange={(e) => setName(e.target.value)}
              />
            )}
          </Field>
          {needsStart && (
            <Field label={copy.startDate} hint={copy.startDateHint}>
              {(p) => (
                <Input
                  {...p}
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              )}
            </Field>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[40rem] text-sm">
          <caption className="sr-only">{copy.title}</caption>
          <thead className="bg-muted/50 text-muted-foreground text-left text-xs">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                {copy.column}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {copy.samples}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {copy.field}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {view.headers.map((header, column) => {
              const samples = view.samples
                .map((row) => row[column] ?? "")
                .filter(Boolean)
                .slice(0, 3);
              return (
                <tr
                  key={column}
                  className={cn(mapping[column] === "ignore" && "text-muted-foreground")}
                >
                  <th scope="row" className="px-3 py-2 text-left font-medium">
                    {header}
                  </th>
                  <td className="max-w-80 px-3 py-2">
                    <span className="line-clamp-2 text-xs break-all">
                      {samples.join(" · ") || "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <Select
                      value={mapping[column]}
                      onValueChange={(v) => setField(column, v as MappingField)}
                    >
                      <SelectTrigger aria-label={`${header} : ${copy.field}`} className="h-8 w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MAPPING_FIELDS.map((f) => (
                          <SelectItem key={f} value={f}>
                            {MAPPING_LABELS[f]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-muted-foreground text-sm">{copy.afterNote}</p>
      <div className="flex flex-wrap items-center justify-end gap-3">
        {!ready && (
          <span className="text-muted-foreground text-sm" aria-live="polite">
            {copy.required}
          </span>
        )}
        <Button
          type="button"
          disabled={
            !ready || pending || (!existingCampaign && !name.trim()) || (needsStart && !startDate)
          }
          onClick={confirm}
        >
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <ArrowRight aria-hidden />}
          {pending ? copy.interpreting : copy.next}
        </Button>
      </div>
    </section>
  );
}
