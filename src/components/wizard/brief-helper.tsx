"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  briefQuestionsAction,
  writeBriefAction,
} from "@/app/(app)/[brandSlug]/campagnes/ai-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { wizardCopy } from "@/lib/copy/wizard";

const copy = wizardCopy.step2.helper;

export type BriefFields = {
  audience: string;
  keyMessage: string;
  callToAction: string;
  brief: string;
};

/** « M'aider à écrire le brief » (§8.5): 3 questions, then a brief written into the fields. */
export function BriefHelper({
  brandId,
  draft,
  onApply,
}: {
  brandId: string;
  draft: BriefFields & { name: string; objective: string };
  onApply: (brief: BriefFields) => void;
}) {
  const [open, setOpen] = useState(false);
  const [questions, setQuestions] = useState<string[] | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [loading, startLoading] = useTransition();
  const [writing, startWriting] = useTransition();

  const start = () => {
    setOpen(true);
    setQuestions(null);
    startLoading(async () => {
      const result = await briefQuestionsAction({ brandId, draft });
      if (!result.ok) {
        setOpen(false);
        return void toast.error(result.error);
      }
      setQuestions(result.data);
      setAnswers(result.data.map(() => ""));
    });
  };

  const write = () =>
    startWriting(async () => {
      const result = await writeBriefAction({
        brandId,
        draft,
        answers: (questions ?? []).map((question, i) => ({ question, answer: answers[i] ?? "" })),
      });
      if (!result.ok) return void toast.error(result.error);
      onApply(result.data);
      setOpen(false);
    });

  return (
    <>
      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={start}>
        <Sparkles aria-hidden />
        {copy.open}
      </Button>
      <Dialog open={open} onOpenChange={(next) => !writing && setOpen(next)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>{copy.description}</DialogDescription>
          </DialogHeader>
          {loading || !questions ? (
            <p
              className="text-muted-foreground flex items-center gap-2 py-4 text-sm"
              aria-live="polite"
            >
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {copy.loading}
            </p>
          ) : (
            <form
              id="brief-helper"
              className="grid gap-4 py-2"
              onSubmit={(e) => {
                e.preventDefault();
                write();
              }}
            >
              {questions.map((question, i) => (
                <div key={question} className="grid gap-1.5">
                  <Label htmlFor={`brief-q-${i}`}>{question}</Label>
                  <Textarea
                    id={`brief-q-${i}`}
                    rows={2}
                    maxLength={1000}
                    placeholder={copy.answerPlaceholder}
                    value={answers[i] ?? ""}
                    onChange={(e) =>
                      setAnswers((list) => list.map((a, j) => (j === i ? e.target.value : a)))
                    }
                  />
                </div>
              ))}
            </form>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" disabled={writing} onClick={() => setOpen(false)}>
              {copy.cancel}
            </Button>
            <Button type="submit" form="brief-helper" disabled={!questions || writing}>
              {writing ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Sparkles aria-hidden />
              )}
              {writing ? copy.writing : copy.write}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
