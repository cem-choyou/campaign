"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CalendarPlus,
  Check,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  Film,
  Loader2,
  Plus,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createCampaignAction,
  saveCampaignDraftAction,
  saveContentAction,
} from "@/app/(app)/[brandSlug]/campagnes/actions";
import { campaignSummaryAction } from "@/app/(app)/[brandSlug]/campagnes/ai-actions";
import { BulkWriterButton } from "@/components/ai/bulk-writer";
import { Field } from "@/components/forms/field";
import { SaveIndicator } from "@/components/forms/save-indicator";
import { useAutosave } from "@/components/forms/use-autosave";
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
import { WIZARD_DONE } from "@/lib/campaigns";
import { common } from "@/lib/copy/common";
import { wizardCopy } from "@/lib/copy/wizard";
import { isDateOnly, mondayOf } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { AiPlanner } from "./ai-planner";
import { BriefHelper } from "./brief-helper";

type PlanningChoice = "import" | "ai" | "blank";

const copy = wizardCopy;

export type WizardValues = {
  name: string;
  startDate: string;
  endDate: string;
  objective: string;
  audience: string;
  keyMessage: string;
  callToAction: string;
  brief: string;
  mainContentId: string;
  wizardStep: number;
};

type WizardContent = { id: string; code: string; title: string; mediaUrl: string | null };

function validate(v: WizardValues): Partial<Record<keyof WizardValues, string>> {
  const errors: Partial<Record<keyof WizardValues, string>> = {};
  if (!v.name.trim()) errors.name = copy.errors.name;
  if (v.startDate && !isDateOnly(v.startDate)) errors.startDate = copy.errors.date;
  if (v.endDate && !isDateOnly(v.endDate)) errors.endDate = copy.errors.date;
  if (v.startDate && v.endDate && v.endDate < v.startDate) {
    errors.endDate = copy.errors.endBeforeStart;
  }
  return errors;
}

export function CampaignWizard({
  brand,
  campaignId: initialCampaignId,
  initialValues,
  contents: initialContents,
  summary,
}: {
  brand: { id: string; name: string; slug: string };
  campaignId: string | null;
  initialValues: WizardValues;
  contents: WizardContent[];
  summary: { posts: number; linkedin: number; youtube: number; postsWithoutText: number };
}) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [values, setValues] = useState(initialValues);
  const [contents, setContents] = useState(initialContents);
  const [figures, setFigures] = useState(summary);
  const [planning, setPlanning] = useState<PlanningChoice>(summary.posts > 0 ? "blank" : "ai");
  const [direction, setDirection] = useState(1);
  const [leaving, startLeaving] = useTransition();
  const campaignId = useRef(initialCampaignId);
  /** Same id as a state, for rendering (refs cannot be read during render). */
  const [savedId, setSavedId] = useState(initialCampaignId);
  const creating = useRef<Promise<string> | null>(null);
  const base = `/${brand.slug}/campagnes`;
  const step = Math.min(Math.max(values.wizardStep, 1), 4);
  const errors = validate(values);
  const valid = Object.keys(errors).length === 0;

  /** The draft is created at the first input (§8.5), then its URL replaces /nouvelle. */
  const ensureCampaign = async (v: WizardValues): Promise<string> => {
    if (campaignId.current) return campaignId.current;
    creating.current ??= (async () => {
      const result = await createCampaignAction({
        brandId: brand.id,
        name: v.name.trim(),
        objective: v.objective,
        startDate: v.startDate,
      });
      if (!result.ok) {
        creating.current = null;
        throw new Error(result.error);
      }
      campaignId.current = result.data.id;
      setSavedId(result.data.id);
      window.history.replaceState(null, "", `${base}/${result.data.id}/assistant`);
      return result.data.id;
    })();
    return creating.current;
  };

  const save = async (v: WizardValues) => {
    try {
      const id = await ensureCampaign(v);
      return await saveCampaignDraftAction({
        campaignId: id,
        ...v,
        mainContentId: v.mainContentId || null,
      });
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : "" };
    }
  };

  const { status, error, flush } = useAutosave({
    value: values,
    initialValue: initialValues,
    enabled: valid,
    save,
  });

  const set = <K extends keyof WizardValues>(key: K, value: WizardValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const goTo = (target: number) => {
    if (target === step || (!valid && target > step)) return;
    setDirection(target > step ? 1 : -1);
    set("wizardStep", target);
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  };

  const saveAndQuit = () =>
    startLeaving(async () => {
      if (valid) {
        const result = await save(values);
        if (!result.ok) return void toast.error(result.error || common.errors.generic);
        toast.success(copy.draftSaved);
      }
      router.push(base);
    });

  /** The saved draft's id, with the latest fields written (the AI reads them from the database). */
  const savedCampaignId = async () => {
    const id = await ensureCampaign(values);
    await flush();
    return id;
  };

  const refreshFigures = async () => {
    if (!campaignId.current) return;
    const result = await campaignSummaryAction({ campaignId: campaignId.current });
    if (result.ok) setFigures(result.data);
  };

  const goImport = () =>
    startLeaving(async () => {
      try {
        const id = await ensureCampaign(values);
        // Resuming the wizard after the import shows the summary.
        const result = await save({ ...values, wizardStep: 4 });
        if (!result.ok) return void toast.error(result.error || common.errors.generic);
        router.push(`${base}/importer?campagne=${id}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : common.errors.generic);
      }
    });

  const openCampaign = () =>
    startLeaving(async () => {
      const result = await save({ ...values, wizardStep: WIZARD_DONE });
      if (!result.ok) return void toast.error(result.error || common.errors.generic);
      await flush();
      router.push(`${base}/${campaignId.current}`);
    });

  // Ctrl/Cmd + Entrée = primary action (§8.12).
  const primary = useRef<() => void>(() => {});
  useEffect(() => {
    primary.current = step < 4 ? () => goTo(step + 1) : openCampaign;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        primary.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const variants = {
    enter: (dir: number) => ({ opacity: 0, x: reduceMotion ? 0 : dir * 24 }),
    center: { opacity: 1, x: 0 },
    exit: (dir: number) => ({ opacity: 0, x: reduceMotion ? 0 : dir * -24 }),
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 sm:px-8">
      {/* Progress, clickable */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs">{copy.autosaveHint}</p>
        <SaveIndicator status={status} error={error} />
      </div>
      <nav aria-label={copy.stepsLabel} className="mb-8">
        <ol className="grid grid-cols-4 gap-2">
          {copy.steps.map((s, i) => {
            const n = i + 1;
            const state = n < step ? "done" : n === step ? "current" : "todo";
            return (
              <li key={s.title}>
                <button
                  type="button"
                  onClick={() => goTo(n)}
                  disabled={!valid && n > step}
                  aria-current={state === "current" ? "step" : undefined}
                  className="group focus-visible:ring-ring w-full rounded-md text-left outline-none focus-visible:ring-2 disabled:cursor-not-allowed"
                >
                  <span
                    className={cn(
                      "block h-1.5 rounded-full transition-colors",
                      state === "todo" ? "bg-muted group-hover:bg-muted-foreground/30" : "bg-brand",
                    )}
                  />
                  <span
                    className={cn(
                      "mt-2 flex items-center gap-1 text-xs",
                      state === "current" ? "text-foreground font-medium" : "text-muted-foreground",
                    )}
                  >
                    {state === "done" && <Check className="size-3.5" aria-hidden />}
                    <span className="hidden sm:inline">{s.title}</span>
                    <span className="sm:hidden">{s.short}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {copy.stepOf(step)}
      </p>
      <h2 className="mt-1 text-xl font-semibold tracking-tight">{copy.steps[step - 1]!.title}</h2>

      <AnimatePresence mode="wait" custom={direction} initial={false}>
        <motion.div
          key={step}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="mt-6"
        >
          {step === 1 && (
            <div className="grid gap-5">
              <p className="text-muted-foreground">{copy.step1.intro}</p>
              <div className="grid gap-1.5">
                <span className="text-sm font-medium">{copy.step1.brand}</span>
                <span className="bg-muted w-fit rounded-md px-2.5 py-1 text-sm">{brand.name}</span>
              </div>
              <Field
                label={copy.step1.name}
                required
                hint={copy.step1.nameHint}
                error={errors.name}
              >
                {(p) => (
                  <Input
                    {...p}
                    value={values.name}
                    onChange={(e) => set("name", e.target.value)}
                    onFocus={(e) => !initialCampaignId && status === "idle" && e.target.select()}
                    maxLength={120}
                    autoFocus
                    className="h-10 text-base"
                  />
                )}
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label={copy.step1.startDate}
                  hint={
                    values.startDate &&
                    isDateOnly(values.startDate) &&
                    mondayOf(values.startDate) !== values.startDate
                      ? copy.step1.notMonday
                      : copy.step1.startDateHint
                  }
                  error={errors.startDate}
                >
                  {(p) => (
                    <Input
                      {...p}
                      type="date"
                      value={values.startDate}
                      onChange={(e) => set("startDate", e.target.value)}
                    />
                  )}
                </Field>
                <Field
                  label={copy.step1.endDate}
                  hint={copy.step1.endDateHint}
                  error={errors.endDate}
                >
                  {(p) => (
                    <Input
                      {...p}
                      type="date"
                      min={values.startDate || undefined}
                      value={values.endDate}
                      onChange={(e) => set("endDate", e.target.value)}
                    />
                  )}
                </Field>
              </div>
              <Field label={copy.step1.objective} hint={copy.step1.objectiveHint}>
                {(p) => (
                  <Input
                    {...p}
                    value={values.objective}
                    onChange={(e) => set("objective", e.target.value)}
                    placeholder={copy.step1.objectivePlaceholder}
                    maxLength={500}
                  />
                )}
              </Field>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-5">
              <p className="text-muted-foreground">{copy.step2.intro}</p>
              <BriefHelper
                brandId={brand.id}
                draft={{
                  name: values.name,
                  objective: values.objective,
                  audience: values.audience,
                  keyMessage: values.keyMessage,
                  callToAction: values.callToAction,
                  brief: values.brief,
                }}
                onApply={(brief) => {
                  const previous = {
                    audience: values.audience,
                    keyMessage: values.keyMessage,
                    callToAction: values.callToAction,
                    brief: values.brief,
                  };
                  setValues((v) => ({ ...v, ...brief }));
                  toast.success(copy.step2.helper.applied, {
                    duration: 8000,
                    action: {
                      label: common.actions.undo,
                      onClick: () => setValues((v) => ({ ...v, ...previous })),
                    },
                  });
                }}
              />
              <Field label={copy.step2.audience} hint={copy.step2.audienceHint}>
                {(p) => (
                  <Textarea
                    {...p}
                    rows={2}
                    value={values.audience}
                    onChange={(e) => set("audience", e.target.value)}
                    placeholder={copy.step2.audiencePlaceholder}
                  />
                )}
              </Field>
              <Field label={copy.step2.keyMessage} hint={copy.step2.keyMessageHint}>
                {(p) => (
                  <Textarea
                    {...p}
                    rows={2}
                    value={values.keyMessage}
                    onChange={(e) => set("keyMessage", e.target.value)}
                    placeholder={copy.step2.keyMessagePlaceholder}
                  />
                )}
              </Field>
              <Field label={copy.step2.callToAction} hint={copy.step2.callToActionHint}>
                {(p) => (
                  <Input
                    {...p}
                    value={values.callToAction}
                    onChange={(e) => set("callToAction", e.target.value)}
                    placeholder={copy.step2.callToActionPlaceholder}
                    maxLength={300}
                  />
                )}
              </Field>
              <MainContentPicker
                contents={contents}
                value={values.mainContentId}
                onChange={(id) => set("mainContentId", id)}
                onAdd={async (title, mediaUrl) => {
                  if (!valid) return false;
                  try {
                    const id = await ensureCampaign(values);
                    const code = contents.some((c) => c.code === "VID-LONG")
                      ? `VID-${contents.length + 1}`
                      : "VID-LONG";
                    const result = await saveContentAction({
                      campaignId: id,
                      code,
                      type: "LONG_VIDEO",
                      title,
                      mediaUrl,
                    });
                    if (!result.ok) {
                      toast.error(result.error);
                      return false;
                    }
                    setContents((list) => [
                      ...list,
                      { id: result.data.id, code, title, mediaUrl: mediaUrl || null },
                    ]);
                    set("mainContentId", result.data.id);
                    toast.success(copy.step2.mainContentAdded);
                    return true;
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : common.errors.generic);
                    return false;
                  }
                }}
              />
              <Field label={copy.step2.brief} hint={copy.step2.briefHint}>
                {(p) => (
                  <Textarea
                    {...p}
                    rows={5}
                    value={values.brief}
                    onChange={(e) => set("brief", e.target.value)}
                  />
                )}
              </Field>
              <details className="group bg-muted/50 rounded-lg border px-4 py-3">
                <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium">
                  <ChevronDown
                    className="size-4 transition-transform group-open:rotate-180"
                    aria-hidden
                  />
                  {copy.step2.exampleToggle}
                </summary>
                <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                  {copy.step2.example}
                </p>
              </details>
            </div>
          )}

          {step === 3 && (
            <div className="grid gap-4">
              <p className="text-muted-foreground" id="planning-choices">
                {copy.step3.intro}
              </p>
              <div role="radiogroup" aria-labelledby="planning-choices" className="grid gap-3">
                {(
                  [
                    ["import", FileSpreadsheet, copy.step3.importTitle, copy.step3.importBody],
                    ["ai", Sparkles, copy.step3.aiTitle, copy.step3.aiBody],
                    ["blank", CalendarPlus, copy.step3.blankTitle, copy.step3.blankBody],
                  ] as const
                ).map(([choice, Icon, title, body]) => {
                  const selected = planning === choice;
                  return (
                    <div
                      key={choice}
                      className={cn(
                        "bg-card grid gap-4 rounded-xl border-2 p-5 transition-colors",
                        selected
                          ? "border-brand ring-brand/20 ring-4"
                          : "hover:border-foreground/20",
                      )}
                    >
                      <button
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setPlanning(choice)}
                        className="focus-visible:ring-ring flex items-start gap-4 rounded-md text-left outline-none focus-visible:ring-2"
                      >
                        <span className="bg-brand/10 text-brand flex size-10 shrink-0 items-center justify-center rounded-lg">
                          <Icon className="size-5" aria-hidden />
                        </span>
                        <span className="flex-1">
                          <span className="block font-medium">{title}</span>
                          <span className="text-muted-foreground mt-1 block text-sm">{body}</span>
                        </span>
                        {selected && (
                          <span className="bg-brand text-brand-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium">
                            <Check className="size-3.5" aria-hidden />
                            {copy.step3.selected}
                          </span>
                        )}
                      </button>
                      {selected && choice === "import" && (
                        <div className="flex flex-wrap gap-2 sm:pl-14">
                          <Button
                            type="button"
                            size="sm"
                            onClick={goImport}
                            disabled={!valid || leaving}
                          >
                            <FileSpreadsheet aria-hidden />
                            {copy.step3.importAction}
                          </Button>
                          <Button asChild variant="outline" size="sm">
                            <a
                              href={`/api/templates/campagne?marque=${encodeURIComponent(brand.slug)}`}
                              download
                            >
                              <Download aria-hidden />
                              {copy.step3.templateAction}
                            </a>
                          </Button>
                        </div>
                      )}
                      {selected && choice === "ai" && (
                        <div className="sm:pl-14">
                          <AiPlanner
                            getCampaignId={savedCampaignId}
                            onCreated={() => void refreshFigures()}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="grid gap-4">
              <p className="text-muted-foreground">{copy.step4.intro}</p>
              <dl className="grid gap-3 sm:grid-cols-2">
                <SummaryTile
                  label={copy.step4.posts}
                  value={String(figures.posts)}
                  detail={
                    figures.posts === 0
                      ? copy.step4.noPostsYet
                      : copy.step4.byChannel(figures.linkedin, figures.youtube)
                  }
                />
                <SummaryTile
                  label={copy.step4.contents}
                  value={String(contents.length)}
                  detail={copy.step4.contentsWithoutMedia(
                    contents.filter((c) => !c.mediaUrl).length,
                  )}
                  warn={contents.some((c) => !c.mediaUrl)}
                />
                <SummaryTile
                  label={copy.step4.postsWithoutText}
                  value={String(figures.postsWithoutText)}
                  detail={copy.step4.postsWithoutTextHint}
                />
                <SummaryTile
                  label={copy.step4.brief}
                  value={
                    values.audience || values.keyMessage || values.brief
                      ? copy.step4.briefFilled
                      : copy.step4.briefEmpty
                  }
                  warn={!(values.audience || values.keyMessage || values.brief)}
                />
              </dl>
              {savedId && figures.postsWithoutText > 0 && (
                <BulkWriterButton
                  campaignId={savedId}
                  variant="default"
                  size="default"
                  onFinished={() => void refreshFigures()}
                />
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Sticky action bar */}
      <div className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky bottom-0 z-20 -mx-4 mt-10 border-t backdrop-blur sm:-mx-8">
        <div className="flex items-center gap-2 px-4 py-3 sm:px-8">
          {step > 1 ? (
            <Button variant="ghost" onClick={() => goTo(step - 1)}>
              <ArrowLeft aria-hidden />
              {copy.back}
            </Button>
          ) : (
            <span />
          )}
          <Button variant="ghost" className="ml-auto" onClick={saveAndQuit} disabled={leaving}>
            {step === 4 ? copy.step4.saveDraft : copy.saveAndQuit}
          </Button>
          {step < 4 ? (
            <Button onClick={() => goTo(step + 1)} disabled={!valid}>
              {copy.next}
              <ArrowRight aria-hidden />
            </Button>
          ) : (
            <Button onClick={openCampaign} disabled={!valid || leaving}>
              {leaving && <Loader2 className="animate-spin" aria-hidden />}
              {copy.step4.open}
              <ArrowRight aria-hidden />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  detail,
  warn,
}: {
  label: string;
  value: string;
  detail?: string;
  warn?: boolean;
}) {
  return (
    <div className="bg-card rounded-xl border p-4">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-1 text-lg font-semibold">{value}</dd>
      {detail && (
        <dd className={cn("mt-0.5 text-xs", warn ? "text-status-review" : "text-muted-foreground")}>
          {detail}
        </dd>
      )}
    </div>
  );
}

const NONE = "__none";

function MainContentPicker({
  contents,
  value,
  onChange,
  onAdd,
}: {
  contents: WizardContent[];
  value: string;
  onChange: (id: string) => void;
  onAdd: (title: string, mediaUrl: string) => Promise<boolean>;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid gap-1.5">
      <Field label={copy.step2.mainContent} hint={copy.step2.mainContentHint}>
        {(p) =>
          contents.length > 0 ? (
            <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
              <SelectTrigger id={p.id} aria-describedby={p["aria-describedby"]} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{copy.step2.mainContentNone}</SelectItem>
                {contents.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.code} · {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p id={p.id} className="text-muted-foreground text-sm">
              {copy.step2.mainContentNone}
            </p>
          )
        }
      </Field>
      {adding ? (
        <div className="bg-muted/40 grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field label={copy.step2.mainContentTitle}>
            {(p) => (
              <Input {...p} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
            )}
          </Field>
          <Field label={copy.step2.mainContentLink}>
            {(p) => (
              <Input
                {...p}
                type="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://…"
              />
            )}
          </Field>
          <Button
            type="button"
            disabled={!title.trim() || pending}
            onClick={() =>
              startTransition(async () => {
                if (await onAdd(title.trim(), link.trim())) {
                  setAdding(false);
                  setTitle("");
                  setLink("");
                }
              })
            }
          >
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
            {copy.step2.mainContentAdd}
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() => setAdding(true)}
        >
          {contents.length === 0 ? <Film aria-hidden /> : <FileText aria-hidden />}
          {contents.length === 0 ? copy.step2.addMainContent : copy.step2.addAnotherContent}
        </Button>
      )}
    </div>
  );
}
