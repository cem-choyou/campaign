"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ExternalLink, Loader2, MoreHorizontal, Plus, Radio } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import {
  saveSocialAccountAction,
  setSocialAccountActiveAction,
} from "@/app/(app)/[brandSlug]/reglages/actions";
import { PlatformIcon } from "@/components/brand/platform-icon";
import { EmptyState } from "@/components/empty-states/empty-state";
import { Field } from "@/components/forms/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { common, platformLabels } from "@/lib/copy/common";
import { settingsCopy } from "@/lib/copy/settings";
import { cn } from "@/lib/utils";
import { SettingsSection } from "./section";

export type AccountRow = {
  id: string;
  platform: "LINKEDIN" | "YOUTUBE";
  name: string;
  url: string | null;
  isActive: boolean;
  kitContributorId: string | null;
  kitContributor: { firstName: string; lastName: string | null } | null;
  _count: { posts: number };
};

type ContributorOption = { id: string; firstName: string; lastName: string | null };

const copy = settingsCopy.accounts;
const NONE = "__none";

const formSchema = z.object({
  platform: z.enum(["LINKEDIN", "YOUTUBE"]),
  name: z.string().trim().min(1, "Donnez un nom au compte, par exemple « IT for Business »."),
  url: z
    .string()
    .trim()
    .refine((v) => v === "" || /^https?:\/\/\S+\.\S+/.test(v), {
      message: "Saisissez une adresse web complète, commençant par https://.",
    }),
  kitContributorId: z.string(),
});
type FormValues = z.infer<typeof formSchema>;

export function AccountsManager({
  brandId,
  accounts,
  contributors,
}: {
  brandId: string;
  accounts: AccountRow[];
  contributors: ContributorOption[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<AccountRow | "new" | null>(null);
  const [, startTransition] = useTransition();

  const setActive = (account: AccountRow, isActive: boolean) =>
    startTransition(async () => {
      const result = await setSocialAccountActiveAction({
        brandId,
        targetId: account.id,
        isActive,
      });
      if (!result.ok) return void toast.error(result.error);
      router.refresh();
      if (!isActive) {
        toast(copy.deactivated(account.name), {
          duration: 8000,
          action: { label: common.actions.undo, onClick: () => setActive(account, true) },
        });
      }
    });

  return (
    <SettingsSection
      title={copy.title}
      description={copy.description}
      actions={
        accounts.length > 0 && (
          <Button onClick={() => setEditing("new")}>
            <Plus aria-hidden />
            {copy.add}
          </Button>
        )
      }
    >
      {accounts.length === 0 ? (
        <EmptyState
          icon={Radio}
          title={copy.empty}
          body={copy.emptyBody}
          action={
            <Button onClick={() => setEditing("new")}>
              <Plus aria-hidden />
              {copy.add}
            </Button>
          }
        />
      ) : (
        <ul className="divide-y rounded-xl border">
          {accounts.map((account) => (
            <li
              key={account.id}
              className={cn("flex items-center gap-3 p-4", !account.isActive && "opacity-60")}
            >
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-lg text-white",
                  account.platform === "LINKEDIN" ? "bg-[#0A66C2]" : "bg-[#E62117]",
                )}
              >
                <PlatformIcon platform={account.platform} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-medium">{account.name}</span>
                  <Badge variant="secondary">{platformLabels[account.platform]}</Badge>
                  {!account.isActive && <Badge variant="outline">{copy.inactive}</Badge>}
                </div>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {account.platform === "LINKEDIN"
                    ? account.kitContributor
                      ? copy.kitTo(
                          `${account.kitContributor.firstName} ${account.kitContributor.lastName ?? ""}`.trim(),
                        )
                      : copy.modeLinkedIn
                    : copy.modeYouTube}
                  {" · "}
                  {copy.posts(account._count.posts)}
                </p>
              </div>
              {account.url && (
                <Button asChild variant="ghost" size="icon" className="hidden sm:inline-flex">
                  <a
                    href={account.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={copy.open(account.name)}
                  >
                    <ExternalLink aria-hidden />
                  </a>
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={common.actionsFor(account.name)}>
                    <MoreHorizontal aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setEditing(account)}>
                    {common.actions.edit}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setActive(account, !account.isActive)}>
                    {account.isActive ? copy.deactivate : copy.reactivate}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      )}

      <AccountDialog
        key={editing === "new" ? "new" : (editing?.id ?? "closed")}
        brandId={brandId}
        account={editing === "new" ? null : editing}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        contributors={contributors}
      />
    </SettingsSection>
  );
}

function AccountDialog({
  brandId,
  account,
  open,
  onOpenChange,
  contributors,
}: {
  brandId: string;
  account: AccountRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contributors: ContributorOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      platform: account?.platform ?? "LINKEDIN",
      name: account?.name ?? "",
      url: account?.url ?? "",
      kitContributorId: account?.kitContributorId ?? NONE,
    },
  });
  const platform = useWatch({ control: form.control, name: "platform" });
  const kitContributorId = useWatch({ control: form.control, name: "kitContributorId" });
  const errors = form.formState.errors;

  const submit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await saveSocialAccountAction({
        brandId,
        accountId: account?.id,
        platform: values.platform,
        name: values.name,
        url: values.url,
        kitContributorId: values.kitContributorId === NONE ? null : values.kitContributorId,
      });
      if (!result.ok) {
        for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
          form.setError(field as keyof FormValues, { message });
        }
        return void toast.error(result.error);
      }
      toast.success(copy.saved);
      onOpenChange(false);
      router.refresh();
    }),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>{account ? copy.edit : copy.add}</DialogTitle>
            <DialogDescription>
              {platform === "LINKEDIN" ? copy.modeLinkedIn : copy.modeYouTube}
            </DialogDescription>
          </DialogHeader>

          <div className="my-5 grid gap-5">
            <fieldset className="grid gap-1.5">
              <legend className="mb-1.5 text-sm font-medium">{copy.platform}</legend>
              <RadioGroup
                value={platform}
                onValueChange={(v) => form.setValue("platform", v as FormValues["platform"])}
                className="grid grid-cols-2 gap-2"
              >
                {(["LINKEDIN", "YOUTUBE"] as const).map((p) => (
                  <label
                    key={p}
                    className={cn(
                      "hover:bg-muted/60 flex cursor-pointer items-center gap-2 rounded-lg border p-3",
                      platform === p && "border-brand ring-brand/30 ring-2",
                    )}
                  >
                    <RadioGroupItem value={p} />
                    <PlatformIcon platform={p} />
                    {platformLabels[p]}
                  </label>
                ))}
              </RadioGroup>
            </fieldset>

            <Field label={copy.name} required error={errors.name?.message}>
              {(p) => (
                <Input {...p} {...form.register("name")} placeholder={copy.namePlaceholder} />
              )}
            </Field>

            <Field label={copy.url} error={errors.url?.message}>
              {(p) => (
                <Input
                  {...p}
                  {...form.register("url")}
                  type="url"
                  inputMode="url"
                  placeholder="https://…"
                />
              )}
            </Field>

            {platform === "LINKEDIN" && (
              <Field label={copy.kitContributor} hint={copy.kitContributorHint}>
                {(p) => (
                  <Select
                    value={kitContributorId}
                    onValueChange={(v) => form.setValue("kitContributorId", v)}
                  >
                    <SelectTrigger
                      id={p.id}
                      aria-describedby={p["aria-describedby"]}
                      className="w-full"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>{copy.kitNone}</SelectItem>
                      {contributors.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {`${c.firstName} ${c.lastName ?? ""}`.trim()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {common.actions.cancel}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              {account ? common.actions.save : copy.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
