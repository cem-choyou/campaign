"use client";

import { Archive, Wand2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  saveCampaignDraftAction,
  setCampaignArchivedAction,
} from "@/app/(app)/[brandSlug]/campagnes/actions";
import { Field } from "@/components/forms/field";
import { SaveIndicator } from "@/components/forms/save-indicator";
import { useAutosave } from "@/components/forms/use-autosave";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { campaignCopy } from "@/lib/copy/campaign";
import { campaignsCopy } from "@/lib/copy/campaigns";
import { common } from "@/lib/copy/common";
import { wizardCopy } from "@/lib/copy/wizard";
import { isDateOnly } from "@/lib/dates";

const copy = campaignCopy.settings;

type Values = {
  name: string;
  startDate: string;
  endDate: string;
  objective: string;
  audience: string;
  keyMessage: string;
  callToAction: string;
  brief: string;
};

export function CampaignSettingsForm({
  campaignId,
  brandSlug,
  archived,
  initialValues,
}: {
  campaignId: string;
  brandSlug: string;
  archived: boolean;
  initialValues: Values;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initialValues);
  const [, startTransition] = useTransition();
  const set = (key: keyof Values) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  const errors: Partial<Record<keyof Values, string>> = {};
  if (!values.name.trim()) errors.name = wizardCopy.errors.name;
  if (values.startDate && !isDateOnly(values.startDate)) errors.startDate = wizardCopy.errors.date;
  if (values.startDate && values.endDate && values.endDate < values.startDate) {
    errors.endDate = wizardCopy.errors.endBeforeStart;
  }

  const { status, error } = useAutosave({
    value: values,
    initialValue: initialValues,
    enabled: Object.keys(errors).length === 0,
    save: async (v) => {
      const result = await saveCampaignDraftAction({ campaignId, ...v });
      if (result.ok && v.name !== initialValues.name) router.refresh();
      return result;
    },
  });

  const setArchived = (next: boolean) =>
    startTransition(async () => {
      const result = await setCampaignArchivedAction({ campaignId, archived: next });
      if (!result.ok) return void toast.error(result.error);
      router.refresh();
      if (next) {
        toast(campaignsCopy.archived(values.name), {
          duration: 8000,
          action: { label: common.actions.undo, onClick: () => setArchived(false) },
        });
      }
    });

  const w = wizardCopy;
  return (
    <div className="grid max-w-2xl gap-10">
      <section className="grid gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{copy.title}</h2>
            <p className="text-muted-foreground mt-1">{copy.description}</p>
          </div>
          <SaveIndicator status={status} error={error} />
        </div>
        <Field label={w.step1.name} required error={errors.name}>
          {(p) => <Input {...p} value={values.name} onChange={set("name")} maxLength={120} />}
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={w.step1.startDate} hint={w.step1.startDateHint} error={errors.startDate}>
            {(p) => (
              <Input {...p} type="date" value={values.startDate} onChange={set("startDate")} />
            )}
          </Field>
          <Field label={w.step1.endDate} hint={w.step1.endDateHint} error={errors.endDate}>
            {(p) => (
              <Input
                {...p}
                type="date"
                min={values.startDate || undefined}
                value={values.endDate}
                onChange={set("endDate")}
              />
            )}
          </Field>
        </div>
        <Field label={w.step1.objective} hint={w.step1.objectiveHint}>
          {(p) => <Input {...p} value={values.objective} onChange={set("objective")} />}
        </Field>
        <Field label={w.step2.audience} hint={w.step2.audienceHint}>
          {(p) => <Textarea {...p} rows={2} value={values.audience} onChange={set("audience")} />}
        </Field>
        <Field label={w.step2.keyMessage} hint={w.step2.keyMessageHint}>
          {(p) => (
            <Textarea {...p} rows={2} value={values.keyMessage} onChange={set("keyMessage")} />
          )}
        </Field>
        <Field label={w.step2.callToAction} hint={w.step2.callToActionHint}>
          {(p) => <Input {...p} value={values.callToAction} onChange={set("callToAction")} />}
        </Field>
        <Field label={w.step2.brief} hint={w.step2.briefHint}>
          {(p) => <Textarea {...p} rows={6} value={values.brief} onChange={set("brief")} />}
        </Field>
        <Button asChild variant="outline" className="w-fit">
          <Link href={`/${brandSlug}/campagnes/${campaignId}/assistant`}>
            <Wand2 aria-hidden />
            {copy.wizard}
          </Link>
        </Button>
      </section>

      {!archived && (
        <section className="rounded-xl border p-5">
          <h2 className="font-semibold">{copy.archiveTitle}</h2>
          <p className="text-muted-foreground mt-1 text-sm">{copy.archiveBody}</p>
          <Button variant="outline" className="mt-4" onClick={() => setArchived(true)}>
            <Archive aria-hidden />
            {copy.archive}
          </Button>
        </section>
      )}
    </div>
  );
}
