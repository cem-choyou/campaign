"use client";

import { Plus, Sparkles, Square, X } from "lucide-react";
import { useState } from "react";
import { saveBrandPromptAction } from "@/app/(app)/[brandSlug]/reglages/actions";
import { useTextStream } from "@/components/ai/use-text-stream";
import { Field } from "@/components/forms/field";
import { SaveIndicator } from "@/components/forms/save-indicator";
import { useAutosave } from "@/components/forms/use-autosave";
import { LinkedInPreview } from "@/components/post-editor/previews";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { postFormatLabels } from "@/lib/copy/common";
import { settingsCopy } from "@/lib/copy/settings";
import { FORMATS_BY_PLATFORM, type PostFormat } from "@/lib/posts";
import { brandPromptFieldsSchema, normalizeHashtag } from "@/lib/validations/brand";
import { SettingsSection } from "./section";

const copy = settingsCopy.prompt;
const MAX_EXAMPLES = 5;

export type PromptValues = {
  editorialLine: string;
  tone: string;
  dos: string;
  donts: string;
  examplePosts: { body: string; note: string }[];
  hashtags: string[];
  defaultCta: string;
  mentionHandle: string;
  extraInstructions: string;
};

function fieldErrors(values: PromptValues): Record<string, string> {
  const parsed = brandPromptFieldsSchema.safeParse(values);
  if (parsed.success) return {};
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path.join(".");
    errors[key] ??= issue.message;
  }
  return errors;
}

export function BrandPromptForm({
  brand,
  initial,
}: {
  brand: { id: string; name: string; color: string; logoUrl: string | null };
  initial: PromptValues;
}) {
  const [values, setValues] = useState(initial);
  const errors = fieldErrors(values);
  const valid = Object.keys(errors).length === 0;
  const set = <K extends keyof PromptValues>(key: K, value: PromptValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const { status, error } = useAutosave({
    value: values,
    initialValue: initial,
    enabled: valid,
    save: (v) => saveBrandPromptAction({ ...v, brandId: brand.id }),
  });

  const text = (
    key: "editorialLine" | "tone" | "dos" | "donts" | "extraInstructions",
    label: string,
    hint: string,
    placeholder: string,
    rows = 3,
  ) => (
    <Field label={label} hint={hint} error={errors[key]}>
      {(p) => (
        <Textarea
          {...p}
          rows={rows}
          value={values[key]}
          placeholder={placeholder}
          onChange={(e) => set(key, e.target.value)}
        />
      )}
    </Field>
  );

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <SettingsSection
        title={copy.title}
        description={copy.description}
        actions={<SaveIndicator status={status} error={error} />}
      >
        <form className="grid gap-6" onSubmit={(e) => e.preventDefault()}>
          {text(
            "editorialLine",
            copy.editorialLine,
            copy.editorialLineHint,
            copy.editorialLinePlaceholder,
          )}
          {text("tone", copy.tone, copy.toneHint, copy.tonePlaceholder, 2)}
          <div className="grid gap-6 md:grid-cols-2">
            {text("dos", copy.dos, copy.dosHint, copy.dosPlaceholder)}
            {text("donts", copy.donts, copy.dontsHint, copy.dontsPlaceholder)}
          </div>

          <HashtagsField
            value={values.hashtags}
            onChange={(v) => set("hashtags", v)}
            error={errors.hashtags}
          />

          <div className="grid gap-6 md:grid-cols-2">
            <Field label={copy.defaultCta} hint={copy.defaultCtaHint} error={errors.defaultCta}>
              {(p) => (
                <Input
                  {...p}
                  value={values.defaultCta}
                  placeholder={copy.defaultCtaPlaceholder}
                  onChange={(e) => set("defaultCta", e.target.value)}
                />
              )}
            </Field>
            <Field
              label={copy.mentionHandle}
              hint={copy.mentionHandleHint}
              error={errors.mentionHandle}
            >
              {(p) => (
                <div className="relative">
                  <span
                    className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm"
                    aria-hidden
                  >
                    @
                  </span>
                  <Input
                    {...p}
                    className="pl-6"
                    value={values.mentionHandle}
                    placeholder={copy.mentionHandlePlaceholder}
                    onChange={(e) => set("mentionHandle", e.target.value.replace(/^@/, ""))}
                  />
                </div>
              )}
            </Field>
          </div>

          <ExamplesField
            value={values.examplePosts}
            onChange={(v) => set("examplePosts", v)}
            errors={errors}
          />

          {text("extraInstructions", copy.extra, copy.extraHint, copy.extraPlaceholder, 2)}
        </form>
      </SettingsSection>

      <Sandbox brand={brand} values={values} disabled={!valid} />
    </div>
  );
}

function HashtagsField({
  value,
  onChange,
  error,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  error?: string;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const tags = draft
      .split(/[,;\n]/)
      .map(normalizeHashtag)
      .filter(Boolean);
    if (tags.length) onChange([...new Set([...value, ...tags])]);
    setDraft("");
  };
  return (
    <Field label={copy.hashtags} hint={copy.hashtagsHint} error={error}>
      {(p) => (
        <div className="border-input focus-within:border-ring focus-within:ring-ring/50 dark:bg-input/30 flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border px-2 py-1.5 focus-within:ring-3">
          {value.map((tag) => (
            <span
              key={tag}
              className="bg-muted inline-flex items-center gap-1 rounded-md py-0.5 pr-1 pl-2 text-sm"
            >
              #{tag}
              <button
                type="button"
                aria-label={copy.removeHashtag(tag)}
                onClick={() => onChange(value.filter((t) => t !== tag))}
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded p-0.5 outline-none focus-visible:ring-2"
              >
                <X className="size-3" aria-hidden />
              </button>
            </span>
          ))}
          <input
            {...p}
            value={draft}
            placeholder={value.length ? "" : copy.hashtagsPlaceholder}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={add}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                add();
              } else if (e.key === "Backspace" && !draft && value.length) {
                onChange(value.slice(0, -1));
              }
            }}
            className="min-w-32 flex-1 bg-transparent py-0.5 text-base outline-none md:text-sm"
          />
        </div>
      )}
    </Field>
  );
}

function ExamplesField({
  value,
  onChange,
  errors,
}: {
  value: { body: string; note: string }[];
  onChange: (value: { body: string; note: string }[]) => void;
  errors: Record<string, string>;
}) {
  const update = (index: number, patch: Partial<{ body: string; note: string }>) =>
    onChange(value.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  return (
    <fieldset className="grid gap-3">
      <legend className="text-sm font-medium">{copy.examples}</legend>
      <p className="text-muted-foreground -mt-1 text-xs">{copy.examplesHint}</p>
      {value.map((example, index) => (
        <div key={index} className="bg-muted/40 grid gap-2 rounded-xl border p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">{copy.exampleBody(index + 1)}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={copy.removeExample(index + 1)}
              onClick={() => onChange(value.filter((_, i) => i !== index))}
            >
              <X aria-hidden />
            </Button>
          </div>
          <Textarea
            aria-label={copy.exampleBody(index + 1)}
            aria-invalid={errors[`examplePosts.${index}.body`] ? true : undefined}
            rows={4}
            value={example.body}
            onChange={(e) => update(index, { body: e.target.value })}
          />
          <Input
            aria-label={copy.exampleNote}
            placeholder={copy.exampleNotePlaceholder}
            value={example.note}
            onChange={(e) => update(index, { note: e.target.value })}
          />
          {(errors[`examplePosts.${index}.body`] || errors[`examplePosts.${index}.note`]) && (
            <p role="alert" className="text-destructive text-xs">
              {errors[`examplePosts.${index}.body`] ?? errors[`examplePosts.${index}.note`]}
            </p>
          )}
        </div>
      ))}
      {value.length < MAX_EXAMPLES ? (
        <Button
          type="button"
          variant="outline"
          className="w-fit"
          onClick={() => onChange([...value, { body: "", note: "" }])}
        >
          <Plus aria-hidden />
          {copy.addExample}
        </Button>
      ) : (
        <p className="text-muted-foreground text-xs">{copy.examplesMax}</p>
      )}
    </fieldset>
  );
}

function Sandbox({
  brand,
  values,
  disabled,
}: {
  brand: { id: string; name: string; color: string; logoUrl: string | null };
  values: PromptValues;
  disabled: boolean;
}) {
  const sandbox = copy.sandbox;
  const [format, setFormat] = useState<PostFormat>("VIDEO_POST");
  const [angle, setAngle] = useState("");
  const stream = useTextStream();
  const running = stream.status === "streaming";

  const run = () =>
    void stream.start("/api/ai/sandbox", {
      brandId: brand.id,
      prompt: values,
      format,
      angle,
    });

  return (
    <aside className="grid content-start gap-4 xl:sticky xl:top-4 xl:self-start">
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Sparkles className="text-brand size-4" aria-hidden />
          {sandbox.title}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">{sandbox.description}</p>
      </div>
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!running) run();
        }}
      >
        <Field label={sandbox.angle}>
          {(p) => (
            <Input
              {...p}
              value={angle}
              placeholder={sandbox.anglePlaceholder}
              onChange={(e) => setAngle(e.target.value)}
            />
          )}
        </Field>
        <Field label={sandbox.format}>
          {(p) => (
            <Select value={format} onValueChange={(v) => setFormat(v as PostFormat)}>
              <SelectTrigger id={p.id} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMATS_BY_PLATFORM.LINKEDIN.map((f) => (
                  <SelectItem key={f} value={f}>
                    {postFormatLabels[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        <div className="flex flex-wrap items-center gap-2">
          {running ? (
            <Button type="button" variant="outline" onClick={stream.stop}>
              <Square aria-hidden />
              {sandbox.stop}
            </Button>
          ) : (
            <Button type="submit" disabled={disabled || angle.trim().length < 3}>
              <Sparkles aria-hidden />
              {stream.text ? sandbox.rerun : sandbox.run}
            </Button>
          )}
          <span className="text-muted-foreground text-xs" aria-live="polite">
            {running ? sandbox.running : ""}
          </span>
        </div>
        <p className="text-muted-foreground text-xs">{sandbox.note}</p>
      </form>
      {stream.error && (
        <p role="alert" className="text-destructive text-sm">
          {stream.error}
        </p>
      )}
      <div aria-busy={running} aria-live="off">
        <LinkedInPreview
          author={{ name: brand.name, subtitle: brand.name, isPage: true }}
          body={stream.text}
          media={format === "VIDEO_POST" ? { title: angle, youtubeVideoId: null } : null}
          brandColor={brand.color}
          logoUrl={brand.logoUrl}
        />
      </div>
    </aside>
  );
}
