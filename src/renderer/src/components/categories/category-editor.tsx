// The category editor dialog: name, emoji, color, the group it sits in (or
// the kind, for a new group), essential or extra, and Delete. Core decides; a refusal shows its
// friendly text in place, never a raw error.

import { useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import type { Category, CategoryKind } from "@shared/types";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/misc";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/common/card";
import { CategoryBubble } from "@/components/common/chips";
import { KINDS, kindLabel, problemText, useCategoryActions } from "./category-actions";

/** Soft colors in the same family as the seeded categories. */
export const SWATCHES = [
  "#E7A875", "#E89B80", "#E59A99", "#D67BAA", "#D692BF", "#AB9DDB",
  "#7D90CA", "#65AFD2", "#65C1D1", "#75BCA3", "#81B482", "#A4C386",
  "#C0D582", "#DBC27F", "#D3A96F", "#A57B5B", "#B8A98F", "#A2ABBB",
];

const EMOJIS = [
  "🛒", "🍽️", "☕", "🍔", "🚗", "⛽", "🚌", "✈️", "🏠", "🧾", "🔁", "🛡️",
  "🛍️", "🎬", "💇", "⚽", "🩺", "🎓", "👶", "🐾", "🎁", "💸", "💼", "📚",
];

export type EditorRequest =
  | { mode: "edit"; category: Category }
  | { mode: "new"; kind: CategoryKind; parentId: number | null; meta: boolean };

export function CategoryEditor({
  request,
  categories,
  open,
  onOpenChange,
  onDelete,
}: {
  request: EditorRequest;
  categories: Category[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: (category: Category) => void;
}) {
  const editing = request.mode === "edit" ? request.category : null;
  const actions = useCategoryActions();
  const [name, setName] = useState(editing?.name ?? "");
  const [emoji, setEmoji] = useState(editing?.emoji ?? (request.mode === "new" ? "🏷️" : ""));
  const [color, setColor] = useState(editing?.color ?? SWATCHES[0] ?? null);
  const [kind, setKind] = useState<CategoryKind>(editing?.kind ?? (request.mode === "new" ? request.kind : "expense"));
  const [parentId, setParentId] = useState<number | null>(editing ? editing.parentId : request.mode === "new" ? request.parentId : null);
  const [essential, setEssential] = useState(editing?.essential ?? true);
  const [problem, setProblem] = useState<string | null>(null);

  const isGroup = editing ? editing.parentId === null : request.mode === "new" && request.meta;
  const hasChildren = editing ? categories.some((c) => c.parentId === editing.id) : false;
  // A group with categories in it stays a group; a new group picks its kind instead of a parent.
  const showParent = !(request.mode === "new" && request.meta) && !hasChildren;
  // Essential or extra is only for spending categories inside a group (spec 18).
  const showEssential = kind === "expense" && showParent && parentId !== null;
  const groups = categories.filter((c) => c.parentId === null && c.kind === kind && c.id !== editing?.id);
  const busy = actions.create.isPending || actions.update.isPending;
  const title = editing
    ? isGroup && hasChildren
      ? s.catEdit.editMetaTitle
      : s.catEdit.editTitle
    : request.mode === "new" && request.meta
      ? s.catEdit.newMetaTitle
      : s.catEdit.newTitle;

  const preview: Category = { id: 0, parentId, name: name || "?", kind, emoji: emoji || null, color, archived: false };

  const save = () => {
    setProblem(null);
    const trimmedEmoji = emoji.trim() || null;
    const done = (r: { ok: true; category: Category } | { ok: false; problem: string }) => {
      if (!r.ok) return setProblem(problemText(r.problem));
      toast.success(editing ? s.catEdit.saved(r.category.name) : s.catEdit.created(r.category.name));
      onOpenChange(false);
    };
    if (editing) {
      const patch = {
        name,
        emoji: trimmedEmoji,
        color,
        ...(showParent && parentId !== editing.parentId ? { parentId } : {}),
        ...(showEssential ? { essential } : {}),
      };
      actions.update.mutate({ id: editing.id, patch }, { onSuccess: done });
    } else {
      const input = { name, kind, parentId: showParent ? parentId : null, emoji: trimmedEmoji, color };
      actions.create.mutate(showEssential ? { ...input, essential } : input, { onSuccess: done });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" closeLabel={s.catEdit.cancel}>
        <form
          className="overflow-y-auto px-7 pt-7 pb-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) save();
          }}
        >
          <div className="flex items-center gap-4">
            <CategoryBubble category={preview} size={48} />
            <div className="min-w-0">
              <DialogTitle>{title}</DialogTitle>
              {request.mode === "new" && request.meta && (
                <DialogDescription className="mt-1 leading-relaxed text-pretty">{s.catEdit.newMetaIntro}</DialogDescription>
              )}
            </div>
          </div>

          <Field label={s.catEdit.name}>
            <Input
              autoFocus
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
              placeholder={s.catEdit.namePlaceholder}
            />
          </Field>

          <Field label={s.catEdit.emoji} hint={s.catEdit.emojiHint}>
            <div className="flex items-start gap-3">
              <Input
                value={emoji}
                maxLength={16}
                onChange={(e) => setEmoji(e.target.value)}
                aria-label={s.catEdit.emoji}
                className="w-16 text-center text-lg"
              />
              <div className="flex flex-wrap gap-1">
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setEmoji(e)}
                    aria-pressed={emoji === e}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-lg text-base outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50",
                      emoji === e && "bg-accent ring-1 ring-primary/40",
                    )}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </Field>

          <Field label={s.catEdit.color}>
            <div role="radiogroup" aria-label={s.catEdit.color} className="flex flex-wrap gap-2">
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={color?.toUpperCase() === c}
                  aria-label={c}
                  onClick={() => setColor(c)}
                  className="flex size-7 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  style={{ backgroundColor: c }}
                >
                  {color?.toUpperCase() === c && <Check className="size-3.5 text-white" strokeWidth={3} />}
                </button>
              ))}
            </div>
          </Field>

          {request.mode === "new" && request.meta && (
            <Field label={s.catEdit.kind}>
              <Choices
                value={kind}
                options={KINDS.map((k) => ({ value: k, label: kindLabel(k) }))}
                onChange={(k) => setKind(k)}
              />
            </Field>
          )}

          {showParent && (
            <Field label={s.catEdit.group}>
              <Choices
                value={parentId}
                options={[
                  { value: null, label: s.catEdit.noGroup },
                  ...groups.map((g) => ({ value: g.id, label: `${g.emoji ?? ""} ${g.name}`.trim() })),
                ]}
                onChange={setParentId}
              />
            </Field>
          )}

          {showEssential && (
            <Field label={s.essential.label} hint={s.essential.hint}>
              <Choices
                value={essential ? "essential" : "extra"}
                options={[
                  { value: "essential", label: s.essential.essential },
                  { value: "extra", label: s.essential.extra },
                ]}
                onChange={(v) => setEssential(v === "essential")}
              />
            </Field>
          )}

          {problem && (
            <p role="alert" className="mt-5 rounded-xl bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
              {problem}
            </p>
          )}

          <div className="mt-7 flex items-center gap-2">
            {editing && (
              <Button type="button" variant="ghost" className="-ms-2 text-destructive" onClick={() => onDelete(editing)}>
                {s.catEdit.delete}
              </Button>
            )}
            <div className="flex-1" />
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {s.catEdit.cancel}
            </Button>
            <Button type="submit" disabled={busy || !name.trim()}>
              {editing ? s.catEdit.save : s.catEdit.create}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="mt-5">
      <div className="mb-2 flex items-baseline gap-2">
        <Label>{label}</Label>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

/** A row of pill buttons, one chosen. Works with the keyboard like any button. */
export function Choices<T extends string | number | null>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
              on ? "border-primary/50 bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-accent",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
