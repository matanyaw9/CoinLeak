// Review actions for components: run the call, refresh what shows money,
// and toast the outcome with Undo where one exists. Also remembers which
// gone rows the user chose to keep, for as long as the window is open.

import { useSyncExternalStore } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Account, CardMode, TransactionRow } from "@shared/types";
import { s } from "@/strings";
import { ApiError } from "./api";
import { refreshLedger } from "./hooks";
import { answerCardBill, deleteGone, switchCardMode, type InternalChoice } from "./review";

const failed = (e: unknown) => toast.error(e instanceof ApiError ? e.message : s.errors.crashBody);

function answeredText(internal: InternalChoice): { title: string; description?: string } {
  const a = s.review.answered;
  if (internal === true) return { title: a.tracked, description: a.trackedBody };
  if (internal === false) return { title: a.spending };
  return { title: a.auto };
}

export function useReviewActions() {
  const client = useQueryClient();
  const refresh = () => refreshLedger(client);

  const offerUndo = (title: string, description: string | undefined, undo: () => Promise<unknown>) =>
    toast.success(title, {
      description,
      action: {
        label: s.review.undo,
        onClick: () => {
          undo()
            .then(() => toast(s.review.undone), failed)
            .finally(() => void refresh());
        },
      },
    });

  const answer = useMutation({
    mutationFn: ({ row, internal }: { row: TransactionRow; internal: InternalChoice }) => answerCardBill(row, internal),
    onSuccess: (undo, { internal }) => {
      const { title, description } = answeredText(internal);
      offerUndo(title, description, undo);
    },
    onError: failed,
    onSettled: refresh,
  });

  const remove = useMutation({
    mutationFn: (row: TransactionRow) => deleteGone([row.id]),
    onSuccess: () => toast.success(s.review.deleted, { description: s.review.deletedBody }),
    onError: failed,
    onSettled: refresh,
  });

  const cardMode = useMutation({
    mutationFn: ({ account, mode }: { account: Account; mode: CardMode; label: string }) =>
      switchCardMode(account.id, account.cardMode ?? "credit", mode),
    onSuccess: (undo, { mode, label }) =>
      offerUndo(s.accounts.cardModeSaved(label, s.accounts.cardMode[mode]), s.accounts.cardModeSavedBody, undo),
    onError: failed,
    onSettled: refresh,
  });

  const keep = (row: TransactionRow) => {
    setKept(new Set(kept).add(row.id));
    toast(s.review.kept, {
      description: s.review.keptBody,
      action: {
        label: s.review.undo,
        onClick: () => {
          const next = new Set(kept);
          next.delete(row.id);
          setKept(next);
        },
      },
    });
  };

  /** True while a call for this row is on its way, so its buttons wait. */
  const busy = (row: TransactionRow) =>
    (answer.isPending && answer.variables?.row.id === row.id) || (remove.isPending && remove.variables?.id === row.id);

  return {
    answer: (row: TransactionRow, internal: InternalChoice) => answer.mutate({ row, internal }),
    remove: (row: TransactionRow) => remove.mutate(row),
    keep,
    busy,
    setCardMode: (account: Account, mode: CardMode, label: string) => cardMode.mutate({ account, mode, label }),
    /** The mode being saved for this card, so the switch moves at once. */
    pendingCardMode: (account: Account): CardMode | undefined =>
      cardMode.isPending && cardMode.variables?.account.id === account.id ? cardMode.variables.mode : undefined,
  };
}

// ---- Gone rows the user chose to keep (this session only, no channel) ----

let kept: ReadonlySet<number> = new Set();
const listeners = new Set<() => void>();

function setKept(next: ReadonlySet<number>): void {
  kept = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useKept(): ReadonlySet<number> {
  return useSyncExternalStore(subscribe, () => kept);
}
