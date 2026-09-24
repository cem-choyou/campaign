"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isHexColor, normalizeHex } from "@/lib/color";
import { common } from "@/lib/copy/common";
import { settingsCopy } from "@/lib/copy/settings";
import { createBrandAction } from "./actions";

const copy = settingsCopy.newBrand;
const schema = z.object({
  name: z.string().trim().min(1, "Donnez un nom à la marque."),
  color: z.string().refine(isHexColor, "Saisissez une couleur au format #1F3A5F."),
});
type Values = z.infer<typeof schema>;

export function NewBrandForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", color: "#1F3A5F" },
  });
  const color = useWatch({ control: form.control, name: "color" });

  const submit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await createBrandAction(values);
      if (!result.ok) return void toast.error(result.error);
      toast.success(copy.created(values.name));
      router.push(`/${result.data.slug}/reglages/marque`);
    }),
  );

  return (
    <form onSubmit={submit} noValidate className="mt-6 grid gap-5">
      <Field label={copy.name} required error={form.formState.errors.name?.message}>
        {(p) => (
          <Input {...p} {...form.register("name")} placeholder={copy.namePlaceholder} autoFocus />
        )}
      </Field>
      <Field label={copy.color} error={form.formState.errors.color?.message}>
        {(p) => (
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label={copy.color}
              value={isHexColor(color) ? normalizeHex(color)! : "#1F3A5F"}
              onChange={(e) => form.setValue("color", e.target.value.toUpperCase())}
              className="border-input size-9 shrink-0 cursor-pointer rounded-md border bg-transparent p-1"
            />
            <Input {...p} {...form.register("color")} className="tabular max-w-36 uppercase" />
          </div>
        )}
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          {common.actions.cancel}
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {copy.submit}
        </Button>
      </div>
    </form>
  );
}
