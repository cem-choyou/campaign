"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangle,
  ExternalLink,
  FileText,
  Film,
  Image as ImageIcon,
  Loader2,
  MoreHorizontal,
  Plus,
  Smartphone,
  Star,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import {
  saveContentAction,
  setContentDeletedAction,
} from "@/app/(app)/[brandSlug]/campagnes/actions";
import { PlatformIcon } from "@/components/brand/platform-icon";
import { EmptyState } from "@/components/empty-states/empty-state";
import { Field } from "@/components/forms/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { campaignCopy } from "@/lib/copy/campaign";
import { common, contentTypeLabels } from "@/lib/copy/common";
import { CONTENT_TYPES, formatDuration, parseDuration } from "@/lib/validations/content";
import { extractYoutubeId, youtubeThumbnail, youtubeWatchUrl } from "@/lib/youtube";
import { cn } from "@/lib/utils";

const copy = campaignCopy.contents;

type ContentType = (typeof CONTENT_TYPES)[number];

export type ContentRow = {
  id: string;
  code: string;
  type: ContentType;
  title: string;
  mediaUrl: string | null;
  durationSec: number | null;
  summary: string | null;
  youtubeVideoId: string | null;
  parentId: string | null;
  _count: { posts: number };
};

const TYPE_ICONS: Record<ContentType, typeof Film> = {
  LONG_VIDEO: Film,
  CAPSULE: Film,
  SHORT: Smartphone,
  IMAGE: ImageIcon,
  DOCUMENT: FileText,
};

const CODE_PREFIX: Record<ContentType, string> = {
  LONG_VIDEO: "VID",
  CAPSULE: "CAP",
  SHORT: "SHORT",
  IMAGE: "IMG",
  DOCUMENT: "DOC",
};

/** Next free code for a type: CAP1, CAP2… */
export function nextCode(type: ContentType, existing: string[]): string {
  const prefix = CODE_PREFIX[type];
  if (type === "LONG_VIDEO" && !existing.includes("VID-LONG")) return "VID-LONG";
  let i = 1;
  while (existing.includes(`${prefix}${i}`)) i++;
  return `${prefix}${i}`;
}

const formSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Donnez un code court, par exemple CAP1.")
    .max(20, "20 caractères maximum.")
    .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, "Lettres, chiffres et tirets uniquement."),
  type: z.enum(CONTENT_TYPES),
  title: z.string().trim().min(1, "Donnez un titre au contenu."),
  mediaUrl: z
    .string()
    .trim()
    .refine((v) => v === "" || /^https?:\/\/\S+\.\S+/.test(v), {
      message: "Saisissez une adresse web complète, commençant par https://.",
    }),
  duration: z
    .string()
    .trim()
    .refine((v) => !Number.isNaN(parseDuration(v)), "Durée au format 1:30 ou 90 s."),
  summary: z.string(),
  youtubeUrl: z
    .string()
    .trim()
    .refine((v) => v === "" || extractYoutubeId(v) !== null, {
      message: "Ce lien YouTube n'est pas reconnu. Collez l'adresse de la vidéo.",
    }),
  parentId: z.string(),
});
type FormValues = z.infer<typeof formSchema>;
const NONE = "__none";

export function ContentsManager({
  campaignId,
  mainContentId,
  contents,
  canEdit,
}: {
  campaignId: string;
  mainContentId: string | null;
  contents: ContentRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<ContentRow | "new" | null>(null);
  const [, startTransition] = useTransition();
  const longVideos = contents.filter((c) => c.type === "LONG_VIDEO");

  const setDeleted = (content: ContentRow, deleted: boolean) =>
    startTransition(async () => {
      const result = await setContentDeletedAction({ contentId: content.id, restore: !deleted });
      if (!result.ok) return void toast.error(result.error);
      router.refresh();
      if (deleted) {
        toast(copy.deleted(content.code), {
          duration: 8000,
          action: { label: common.actions.undo, onClick: () => setDeleted(content, false) },
        });
      }
    });

  const addButton = canEdit && (
    <Button onClick={() => setEditing("new")}>
      <Plus aria-hidden />
      {copy.add}
    </Button>
  );

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{copy.title}</h2>
          <p className="text-muted-foreground mt-1 max-w-prose">{copy.description}</p>
        </div>
        {contents.length > 0 && addButton}
      </div>

      {contents.length === 0 ? (
        <EmptyState icon={Film} title={copy.empty} body={copy.emptyBody} action={addButton} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {contents.map((c) => {
            const Icon = TYPE_ICONS[c.type];
            const parent = c.parentId ? contents.find((p) => p.id === c.parentId) : null;
            const missingMedia = !c.mediaUrl && c._count.posts > 0;
            return (
              <li key={c.id} className="bg-card flex flex-col overflow-hidden rounded-xl border">
                {c.youtubeVideoId ? (
                  // eslint-disable-next-line @next/next/no-img-element -- YouTube thumbnail
                  <img
                    src={youtubeThumbnail(c.youtubeVideoId)}
                    alt=""
                    className="bg-muted aspect-video w-full object-cover"
                  />
                ) : (
                  <div className="bg-muted text-muted-foreground flex aspect-[16/6] items-center justify-center">
                    <Icon className="size-7 opacity-60" aria-hidden />
                  </div>
                )}
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="secondary" className="tabular font-mono text-[11px]">
                          {c.code}
                        </Badge>
                        <span className="text-muted-foreground text-xs">
                          {contentTypeLabels[c.type]}
                          {c.durationSec ? ` · ${formatDuration(c.durationSec)}` : ""}
                        </span>
                        {c.id === mainContentId && (
                          <span className="text-brand inline-flex items-center gap-0.5 text-xs font-medium">
                            <Star className="size-3 fill-current" aria-hidden />
                            {copy.main}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 font-medium">{c.title}</p>
                      {parent && <p className="text-muted-foreground text-xs">→ {parent.code}</p>}
                    </div>
                    {canEdit && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={common.actionsFor(c.code)}
                          >
                            <MoreHorizontal aria-hidden />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setEditing(c)}>
                            {common.actions.edit}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => setDeleted(c, true)}
                          >
                            {copy.delete}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                  {c.summary && (
                    <p className="text-muted-foreground line-clamp-2 text-sm">{c.summary}</p>
                  )}
                  <div className="mt-auto flex flex-wrap items-center gap-3 pt-1 text-xs">
                    <span className="text-muted-foreground">{copy.usedIn(c._count.posts)}</span>
                    {missingMedia && (
                      <span className="text-status-review inline-flex items-center gap-1 font-medium">
                        <AlertTriangle className="size-3.5" aria-hidden />
                        {copy.missingMedia}
                      </span>
                    )}
                    <span className="ml-auto flex gap-2">
                      {c.mediaUrl && (
                        <a
                          href={c.mediaUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-foreground inline-flex items-center gap-1 hover:underline"
                        >
                          <ExternalLink className="size-3.5" aria-hidden />
                          {copy.openMedia}
                        </a>
                      )}
                      {c.youtubeVideoId && (
                        <a
                          href={youtubeWatchUrl(c.youtubeVideoId)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-foreground inline-flex items-center gap-1 hover:underline"
                        >
                          <PlatformIcon platform="YOUTUBE" className="size-3.5" />
                          {copy.openYoutube}
                        </a>
                      )}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ContentSheet
        key={editing === "new" ? "new" : (editing?.id ?? "closed")}
        campaignId={campaignId}
        content={editing === "new" ? null : editing}
        existingCodes={contents.map((c) => c.code)}
        longVideos={longVideos}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      />
    </section>
  );
}

function ContentSheet({
  campaignId,
  content,
  existingCodes,
  longVideos,
  open,
  onOpenChange,
}: {
  campaignId: string;
  content: ContentRow | null;
  existingCodes: string[];
  longVideos: ContentRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const defaultType: ContentType =
    content?.type ?? (longVideos.length === 0 ? "LONG_VIDEO" : "CAPSULE");
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: content?.code ?? nextCode(defaultType, existingCodes),
      type: defaultType,
      title: content?.title ?? "",
      mediaUrl: content?.mediaUrl ?? "",
      duration: formatDuration(content?.durationSec),
      summary: content?.summary ?? "",
      youtubeUrl: content?.youtubeVideoId ? youtubeWatchUrl(content.youtubeVideoId) : "",
      parentId: content?.parentId ?? longVideos[0]?.id ?? NONE,
    },
  });
  const type = useWatch({ control: form.control, name: "type" });
  const parentId = useWatch({ control: form.control, name: "parentId" });
  const errors = form.formState.errors;
  const isVideo = type === "LONG_VIDEO" || type === "SHORT" || type === "CAPSULE";

  const submit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await saveContentAction({
        campaignId,
        contentId: content?.id,
        ...values,
        parentId: values.parentId === NONE ? null : values.parentId,
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        <form onSubmit={submit} noValidate className="flex h-full flex-col">
          <SheetHeader className="border-b">
            <SheetTitle>{content ? copy.edit : copy.add}</SheetTitle>
            <SheetDescription>{copy.description}</SheetDescription>
          </SheetHeader>
          <div className="grid flex-1 content-start gap-4 overflow-y-auto p-4">
            <div className="grid grid-cols-[1fr_8rem] gap-3">
              <Field label={copy.type}>
                {(p) => (
                  <Select
                    value={type}
                    onValueChange={(v) => {
                      const t = v as ContentType;
                      form.setValue("type", t);
                      if (!content) form.setValue("code", nextCode(t, existingCodes));
                    }}
                  >
                    <SelectTrigger id={p.id} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTENT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {contentTypeLabels[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>
              <Field label={copy.code} required error={errors.code?.message}>
                {(p) => <Input {...p} {...form.register("code")} className="font-mono uppercase" />}
              </Field>
            </div>
            <p className="text-muted-foreground -mt-2 text-xs">{copy.codeHint}</p>
            <Field label={copy.titleField} required error={errors.title?.message}>
              {(p) => <Input {...p} {...form.register("title")} autoFocus />}
            </Field>
            <Field label={copy.mediaUrl} hint={copy.mediaUrlHint} error={errors.mediaUrl?.message}>
              {(p) => (
                <Input {...p} {...form.register("mediaUrl")} type="url" placeholder="https://…" />
              )}
            </Field>
            {isVideo && (
              <Field
                label={copy.duration}
                hint={copy.durationHint}
                error={errors.duration?.message}
              >
                {(p) => (
                  <Input
                    {...p}
                    {...form.register("duration")}
                    className="w-28"
                    placeholder="1:30"
                  />
                )}
              </Field>
            )}
            {type === "SHORT" && longVideos.length > 0 && (
              <Field label={copy.parent} hint={copy.parentHint}>
                {(p) => (
                  <Select value={parentId} onValueChange={(v) => form.setValue("parentId", v)}>
                    <SelectTrigger id={p.id} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>{copy.parentNone}</SelectItem>
                      {longVideos.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.code} · {v.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>
            )}
            <Field label={copy.summary} hint={copy.summaryHint}>
              {(p) => <Textarea {...p} {...form.register("summary")} rows={4} />}
            </Field>
            {(type === "LONG_VIDEO" || type === "SHORT") && (
              <Field
                label={copy.youtubeUrl}
                hint={copy.youtubeUrlHint}
                error={errors.youtubeUrl?.message}
              >
                {(p) => (
                  <Input
                    {...p}
                    {...form.register("youtubeUrl")}
                    placeholder="https://www.youtube.com/watch?v=…"
                  />
                )}
              </Field>
            )}
          </div>
          <SheetFooter className="flex-row justify-end border-t">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {common.actions.cancel}
            </Button>
            <Button type="submit" disabled={pending} className={cn(pending && "opacity-80")}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              {content ? common.actions.save : copy.create}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
