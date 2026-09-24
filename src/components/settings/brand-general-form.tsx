"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { saveBrandGeneralAction } from "@/app/(app)/[brandSlug]/reglages/actions";
import { BrandAvatar } from "@/components/brand/brand-avatar";
import { Field } from "@/components/forms/field";
import { SaveIndicator } from "@/components/forms/save-indicator";
import { useAutosave } from "@/components/forms/use-autosave";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DARK_BACKGROUND,
  LIGHT_BACKGROUND,
  accessibleAccent,
  isHexColor,
  normalizeHex,
  readableOn,
} from "@/lib/color";
import { settingsCopy } from "@/lib/copy/settings";
import { TIMEZONES, brandGeneralSchema } from "@/lib/validations/brand";
import { SettingsSection } from "./section";

const formSchema = brandGeneralSchema.omit({ brandId: true });
type FormInput = z.input<typeof formSchema>;

export function BrandGeneralForm({
  brand,
}: {
  brand: {
    id: string;
    slug: string;
    name: string;
    color: string;
    logoUrl: string | null;
    timezone: string;
  };
}) {
  const router = useRouter();
  const initial: FormInput = {
    name: brand.name,
    color: brand.color,
    logoUrl: brand.logoUrl ?? "",
    timezone: brand.timezone,
  };
  const form = useForm<FormInput>({
    resolver: zodResolver(formSchema),
    defaultValues: initial,
    mode: "onChange",
  });
  const values = useWatch({ control: form.control }) as FormInput;
  const valid = formSchema.safeParse(values).success;

  const { status, error } = useAutosave({
    value: values,
    initialValue: initial,
    enabled: valid,
    save: async (v) => {
      const result = await saveBrandGeneralAction({ ...v, brandId: brand.id });
      if (result.ok) router.refresh(); // new accent color and name in the shell
      return result;
    },
  });

  const color = isHexColor(values.color ?? "") ? normalizeHex(values.color!)! : brand.color;
  const light = accessibleAccent(color, LIGHT_BACKGROUND);
  const dark = accessibleAccent(color, DARK_BACKGROUND);
  const errors = form.formState.errors;

  return (
    <SettingsSection
      title={settingsCopy.brand.title}
      description={settingsCopy.brand.description}
      actions={<SaveIndicator status={status} error={error} />}
    >
      <form className="grid gap-6 md:grid-cols-[1fr_240px]" onSubmit={(e) => e.preventDefault()}>
        <div className="grid gap-5">
          <Field label={settingsCopy.brand.name} required error={errors.name?.message}>
            {(p) => <Input {...p} {...form.register("name")} autoComplete="off" />}
          </Field>

          <Field
            label={settingsCopy.brand.color}
            hint={settingsCopy.brand.colorHint}
            error={errors.color?.message}
          >
            {(p) => (
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label={settingsCopy.brand.color}
                  value={color}
                  onChange={(e) =>
                    form.setValue("color", e.target.value.toUpperCase(), {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  className="border-input size-9 shrink-0 cursor-pointer rounded-md border bg-transparent p-1"
                />
                <Input {...p} {...form.register("color")} className="tabular max-w-36 uppercase" />
              </div>
            )}
          </Field>

          <Field
            label={settingsCopy.brand.logo}
            hint={settingsCopy.brand.logoHint}
            error={errors.logoUrl?.message}
          >
            {(p) => (
              <Input
                {...p}
                {...form.register("logoUrl")}
                type="url"
                inputMode="url"
                placeholder="https://…"
              />
            )}
          </Field>

          <Field label={settingsCopy.brand.timezone} hint={settingsCopy.brand.timezoneHint}>
            {(p) => (
              <Select
                value={values.timezone}
                onValueChange={(v) => form.setValue("timezone", v, { shouldDirty: true })}
              >
                <SelectTrigger
                  id={p.id}
                  aria-describedby={p["aria-describedby"]}
                  className="w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>

          <div className="grid gap-1.5">
            <span className="text-sm font-medium">{settingsCopy.brand.address}</span>
            <code className="bg-muted text-muted-foreground w-fit rounded-md px-2 py-1 text-xs">
              campaign.choyou-tools.fr/{brand.slug}
            </code>
          </div>
        </div>

        <div className="grid content-start gap-3" aria-label={settingsCopy.brand.preview}>
          <span className="text-sm font-medium">{settingsCopy.brand.preview}</span>
          <PreviewTile
            background={LIGHT_BACKGROUND}
            accent={light}
            name={values.name || brand.name}
            logoUrl={values.logoUrl || null}
            color={color}
            note={light !== color ? settingsCopy.brand.colorAdjusted("clair") : undefined}
          />
          <PreviewTile
            background={DARK_BACKGROUND}
            accent={dark}
            name={values.name || brand.name}
            logoUrl={values.logoUrl || null}
            color={color}
            note={dark !== color ? settingsCopy.brand.colorAdjusted("sombre") : undefined}
            dark
          />
        </div>
      </form>
    </SettingsSection>
  );
}

function PreviewTile({
  background,
  accent,
  name,
  logoUrl,
  color,
  note,
  dark,
}: {
  background: string;
  accent: string;
  name: string;
  logoUrl: string | null;
  color: string;
  note?: string;
  dark?: boolean;
}) {
  return (
    <div className="rounded-xl border p-3" style={{ backgroundColor: background }}>
      <div className="flex items-center gap-2">
        <BrandAvatar name={name} color={color} logoUrl={logoUrl} />
        <span
          className="truncate text-sm font-medium"
          style={{ color: dark ? "#EDEDEF" : "#18181B" }}
        >
          {name}
        </span>
      </div>
      <span
        className="mt-3 inline-flex h-8 items-center rounded-lg px-3 text-xs font-medium"
        style={{ backgroundColor: accent, color: readableOn(accent) }}
      >
        {settingsCopy.brand.previewButton}
      </span>
      {note && (
        <p className="mt-2 text-[11px]" style={{ color: dark ? "#A1A1AA" : "#5B5B66" }}>
          {note}
        </p>
      )}
    </div>
  );
}
