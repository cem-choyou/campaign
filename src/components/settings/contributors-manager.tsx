"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MoreHorizontal, Plus, Search, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import {
  saveContributorAction,
  setContributorActiveAction,
} from "@/app/(app)/[brandSlug]/reglages/actions";
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
import { common } from "@/lib/copy/common";
import { settingsCopy } from "@/lib/copy/settings";
import { cn } from "@/lib/utils";
import { SettingsSection } from "./section";

export type ContributorRow = {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string;
  jobTitle: string | null;
  linkedinUrl: string | null;
  isActive: boolean;
  _count: { authored: number };
};

const copy = settingsCopy.contributors;

const formSchema = z.object({
  firstName: z.string().trim().min(1, "Indiquez le prénom."),
  lastName: z.string().trim(),
  email: z
    .string()
    .trim()
    .pipe(z.email("Saisissez une adresse e-mail valide, par exemple prenom.nom@entreprise.fr.")),
  jobTitle: z.string().trim(),
  linkedinUrl: z
    .string()
    .trim()
    .refine((v) => v === "" || /^https?:\/\/\S+\.\S+/.test(v), {
      message: "Saisissez une adresse web complète, commençant par https://.",
    }),
});
type FormValues = z.infer<typeof formSchema>;

const fullName = (c: { firstName: string; lastName: string | null }) =>
  `${c.firstName} ${c.lastName ?? ""}`.trim();

function normalize(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function ContributorsManager({
  brandId,
  contributors,
}: {
  brandId: string;
  contributors: ContributorRow[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<ContributorRow | "new" | null>(null);
  const [query, setQuery] = useState("");
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return contributors;
    return contributors.filter((c) =>
      normalize(`${fullName(c)} ${c.email} ${c.jobTitle ?? ""}`).includes(q),
    );
  }, [contributors, query]);

  const setActive = (contributor: ContributorRow, isActive: boolean) =>
    startTransition(async () => {
      const result = await setContributorActiveAction({
        brandId,
        targetId: contributor.id,
        isActive,
      });
      if (!result.ok) return void toast.error(result.error);
      router.refresh();
      if (!isActive) {
        toast(copy.deactivated(fullName(contributor)), {
          duration: 8000,
          action: { label: common.actions.undo, onClick: () => setActive(contributor, true) },
        });
      }
    });

  const addButton = (
    <Button onClick={() => setEditing("new")}>
      <Plus aria-hidden />
      {copy.add}
    </Button>
  );

  return (
    <SettingsSection
      title={copy.title}
      description={copy.description}
      actions={contributors.length > 0 && addButton}
    >
      {contributors.length === 0 ? (
        <EmptyState icon={Users} title={copy.empty} body={copy.emptyBody} action={addButton} />
      ) : (
        <>
          {contributors.length > 5 && (
            <div className="relative mb-3 max-w-xs">
              <Search
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
                aria-hidden
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={copy.search}
                aria-label={copy.search}
                className="pl-8"
              />
            </div>
          )}
          {filtered.length === 0 ? (
            <p className="text-muted-foreground rounded-xl border p-6 text-center">
              {copy.noResult}
            </p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {filtered.map((c) => (
                <li
                  key={c.id}
                  className={cn("flex items-center gap-3 p-4", !c.isActive && "opacity-60")}
                >
                  <span
                    aria-hidden
                    className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                  >
                    {`${c.firstName[0] ?? ""}${c.lastName?.[0] ?? ""}`.toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium">{fullName(c)}</span>
                      {c.jobTitle && (
                        <span className="text-muted-foreground truncate text-xs">{c.jobTitle}</span>
                      )}
                      {!c.isActive && <Badge variant="outline">{copy.inactive}</Badge>}
                    </div>
                    <p className="text-muted-foreground mt-0.5 truncate text-xs">
                      {c.email} · {copy.posts(c._count.authored)}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={common.actionsFor(fullName(c))}
                      >
                        <MoreHorizontal aria-hidden />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setEditing(c)}>
                        {common.actions.edit}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setActive(c, !c.isActive)}>
                        {c.isActive ? copy.deactivate : copy.reactivate}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <ContributorDialog
        key={editing === "new" ? "new" : (editing?.id ?? "closed")}
        brandId={brandId}
        contributor={editing === "new" ? null : editing}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      />
    </SettingsSection>
  );
}

function ContributorDialog({
  brandId,
  contributor,
  open,
  onOpenChange,
}: {
  brandId: string;
  contributor: ContributorRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: contributor?.firstName ?? "",
      lastName: contributor?.lastName ?? "",
      email: contributor?.email ?? "",
      jobTitle: contributor?.jobTitle ?? "",
      linkedinUrl: contributor?.linkedinUrl ?? "",
    },
  });
  const errors = form.formState.errors;

  const submit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await saveContributorAction({
        brandId,
        contributorId: contributor?.id,
        ...values,
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
            <DialogTitle>{contributor ? copy.edit : copy.add}</DialogTitle>
            <DialogDescription>{copy.description}</DialogDescription>
          </DialogHeader>
          <div className="my-5 grid gap-4 sm:grid-cols-2">
            <Field label={copy.firstName} required error={errors.firstName?.message}>
              {(p) => <Input {...p} {...form.register("firstName")} autoComplete="off" autoFocus />}
            </Field>
            <Field label={copy.lastName} error={errors.lastName?.message}>
              {(p) => <Input {...p} {...form.register("lastName")} autoComplete="off" />}
            </Field>
            <Field
              label={copy.email}
              required
              hint={copy.emailHint}
              error={errors.email?.message}
              className="sm:col-span-2"
            >
              {(p) => (
                <Input
                  {...p}
                  {...form.register("email")}
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                />
              )}
            </Field>
            <Field label={copy.jobTitle} error={errors.jobTitle?.message}>
              {(p) => <Input {...p} {...form.register("jobTitle")} />}
            </Field>
            <Field label={copy.linkedinUrl} error={errors.linkedinUrl?.message}>
              {(p) => (
                <Input
                  {...p}
                  {...form.register("linkedinUrl")}
                  type="url"
                  inputMode="url"
                  placeholder="https://www.linkedin.com/in/…"
                />
              )}
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {common.actions.cancel}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              {contributor ? common.actions.save : copy.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
