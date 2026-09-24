"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, Loader2, MailPlus, MoreHorizontal, Send, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import {
  inviteAction,
  removeMembershipAction,
  revokeInvitationAction,
  updateMembershipAction,
} from "@/app/(app)/[brandSlug]/reglages/actions";
import { Field } from "@/components/forms/field";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { common, roleLabels } from "@/lib/copy/common";
import { settingsCopy } from "@/lib/copy/settings";
import { formatDay } from "@/lib/dates";
import type { BrandRole } from "@/lib/permissions";
import { SettingsSection } from "./section";

export type MemberRow = {
  id: string;
  role: BrandRole;
  clientCanApprove: boolean;
  user: { id: string; name: string | null; email: string; image: string | null };
};
export type InvitationRow = { id: string; email: string; role: BrandRole; expiresAt: Date };

const copy = settingsCopy.access;
const ROLES: BrandRole[] = ["ADMIN", "VALIDATOR", "EDITOR", "CLIENT"];

export function AccessManager({
  brandId,
  currentUserId,
  members,
  invitations,
  timezone,
}: {
  brandId: string;
  currentUserId: string;
  members: MemberRow[];
  invitations: InvitationRow[];
  timezone: string;
}) {
  const router = useRouter();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [removing, setRemoving] = useState<MemberRow | null>(null);
  const [pending, startTransition] = useTransition();

  const changeRole = (member: MemberRow, role: BrandRole, clientCanApprove = false) =>
    startTransition(async () => {
      const result = await updateMembershipAction({
        brandId,
        membershipId: member.id,
        role,
        clientCanApprove,
      });
      if (!result.ok) return void toast.error(result.error);
      toast.success(copy.roleChanged);
      router.refresh();
    });

  const resend = (invitation: InvitationRow) =>
    startTransition(async () => {
      const result = await inviteAction({
        brandId,
        email: invitation.email,
        role: invitation.role,
      });
      if (!result.ok) return void toast.error(result.error);
      toast.success(copy.sent(invitation.email));
      router.refresh();
    });

  const revoke = (invitation: InvitationRow) =>
    startTransition(async () => {
      const result = await revokeInvitationAction({ brandId, targetId: invitation.id });
      if (!result.ok) return void toast.error(result.error);
      toast(copy.revoked, {
        duration: 8000,
        action: { label: common.actions.undo, onClick: () => resend(invitation) },
      });
      router.refresh();
    });

  return (
    <div className="grid gap-10">
      <SettingsSection
        title={copy.members}
        description={copy.description}
        actions={
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus aria-hidden />
            {copy.invite}
          </Button>
        }
      >
        <ul className="divide-y rounded-xl border">
          {members.map((m) => {
            const isMe = m.user.id === currentUserId;
            const name = m.user.name ?? m.user.email;
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-3 p-4">
                <Avatar className="size-9">
                  {m.user.image && <AvatarImage src={m.user.image} alt="" />}
                  <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {name}
                    {isMe && (
                      <span className="text-muted-foreground font-normal"> ({copy.you})</span>
                    )}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">{m.user.email}</p>
                </div>
                <div className="flex w-full items-center gap-2 pl-12 sm:w-auto sm:pl-0">
                  <Select
                    value={m.role}
                    disabled={isMe || pending}
                    onValueChange={(v) => changeRole(m, v as BrandRole)}
                  >
                    <SelectTrigger
                      className="flex-1 sm:w-40 sm:flex-none"
                      aria-label={`${copy.role} — ${name}`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {roleLabels[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!isMe && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={common.actionsFor(name)}>
                          <MoreHorizontal aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {m.role === "CLIENT" && (
                          <DropdownMenuItem
                            onSelect={() => changeRole(m, "CLIENT", !m.clientCanApprove)}
                          >
                            {m.clientCanApprove
                              ? copy.clientCanApproveRemove
                              : copy.clientCanApprove}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem variant="destructive" onSelect={() => setRemoving(m)}>
                          {copy.remove}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                {m.role === "CLIENT" && m.clientCanApprove && (
                  <Badge variant="secondary" className="basis-full sm:basis-auto">
                    {copy.clientCanApprove}
                  </Badge>
                )}
              </li>
            );
          })}
        </ul>
        <p className="text-muted-foreground mt-3 text-xs">{copy.superAdminNote}</p>
      </SettingsSection>

      <SettingsSection title={copy.pending}>
        {invitations.length === 0 ? (
          <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-center">
            {copy.pendingEmpty}
          </p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {invitations.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center gap-3 p-4">
                <span className="bg-muted text-muted-foreground flex size-9 items-center justify-center rounded-full">
                  <MailPlus className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{inv.email}</p>
                  <p className="text-muted-foreground text-xs">
                    {roleLabels[inv.role]} · {copy.expires(formatDay(inv.expiresAt, timezone))}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => resend(inv)} disabled={pending}>
                  <Send aria-hidden />
                  {copy.resend}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => revoke(inv)} disabled={pending}>
                  {copy.revoke}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </SettingsSection>

      <InviteDialog brandId={brandId} open={inviteOpen} onOpenChange={setInviteOpen} />

      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {removing && copy.removeTitle(removing.user.name ?? removing.user.email)}
            </AlertDialogTitle>
            <AlertDialogDescription>{copy.removeBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{common.actions.cancel}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() =>
                removing &&
                startTransition(async () => {
                  const result = await removeMembershipAction({ brandId, targetId: removing.id });
                  setRemoving(null);
                  if (!result.ok) return void toast.error(result.error);
                  toast.success(copy.removed);
                  router.refresh();
                })
              }
            >
              {copy.remove}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const inviteSchema = z.object({
  email: z
    .string()
    .trim()
    .pipe(z.email("Saisissez une adresse e-mail valide, par exemple prenom.nom@entreprise.fr.")),
  role: z.enum(["ADMIN", "VALIDATOR", "EDITOR", "CLIENT"]),
  clientCanApprove: z.boolean(),
});
type InviteValues = z.infer<typeof inviteSchema>;

function InviteDialog({
  brandId,
  open,
  onOpenChange,
}: {
  brandId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [devUrl, setDevUrl] = useState<string | null>(null);
  const form = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "", role: "EDITOR", clientCanApprove: false },
  });
  const role = useWatch({ control: form.control, name: "role" });
  const clientCanApprove = useWatch({ control: form.control, name: "clientCanApprove" });

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      form.reset();
      setDevUrl(null);
    }
  };

  const submit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await inviteAction({ brandId, ...values });
      if (!result.ok) {
        if (result.fieldErrors?.email)
          form.setError("email", { message: result.fieldErrors.email });
        return void toast.error(result.error);
      }
      router.refresh();
      if (result.data.emailSent) {
        toast.success(copy.sent(values.email));
        close(false);
      } else {
        setDevUrl(result.data.devUrl ?? null);
      }
    }),
  );

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>{copy.inviteTitle}</DialogTitle>
            <DialogDescription>{copy.inviteDescription}</DialogDescription>
          </DialogHeader>
          <div className="my-5 grid gap-4">
            <Field label={copy.email} required error={form.formState.errors.email?.message}>
              {(p) => (
                <Input
                  {...p}
                  {...form.register("email")}
                  type="email"
                  inputMode="email"
                  autoFocus
                />
              )}
            </Field>
            <Field label={copy.role} hint={copy.roleHints[role]}>
              {(p) => (
                <Select value={role} onValueChange={(v) => form.setValue("role", v as BrandRole)}>
                  <SelectTrigger
                    id={p.id}
                    aria-describedby={p["aria-describedby"]}
                    className="w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {roleLabels[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
            {role === "CLIENT" && (
              <label className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={clientCanApprove}
                  onCheckedChange={(v) => form.setValue("clientCanApprove", v === true)}
                  className="mt-0.5"
                />
                <span>
                  {copy.clientCanApprove}
                  <span className="text-muted-foreground block text-xs">
                    {copy.clientCanApproveHint}
                  </span>
                </span>
              </label>
            )}
            {devUrl && (
              <div className="bg-muted rounded-lg p-3 text-xs" role="status">
                <p>{copy.notSent}</p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate">{devUrl}</code>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void navigator.clipboard.writeText(devUrl)}
                  >
                    <Copy aria-hidden />
                    {copy.copyLink}
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => close(false)}>
              {devUrl ? common.actions.close : common.actions.cancel}
            </Button>
            {!devUrl && (
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" aria-hidden />}
                {copy.send}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
