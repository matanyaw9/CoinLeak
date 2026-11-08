// The names a text condition looks for, as chips: Enter or a comma turns
// what is typed into a chip, Backspace on an empty field takes the last one
// back, and pasting a list splits it. A pattern is typed whole, in one chip.

import { useRef } from "react";
import { X } from "lucide-react";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { addValues, MAX_TEXT, splitValues } from "@/lib/rule-form";

export function ValuesField({
  values,
  draft,
  pattern,
  onChange,
  autoFocus,
}: {
  values: string[];
  draft: string;
  pattern: boolean;
  onChange: (next: { values: string[]; draft: string }) => void;
  autoFocus?: boolean;
}) {
  const e = s.rulesV2.editor;
  const input = useRef<HTMLInputElement>(null);
  const commit = (text: string) => {
    const more = pattern ? (text.trim() === "" ? [] : [text]) : splitValues(text);
    onChange({ values: addValues(values, more), draft: "" });
  };
  const placeholder = pattern ? s.rules.editor.patternPlaceholder : values.length > 0 ? e.valuesMore : e.valuesPlaceholder;

  return (
    <div
      onClick={() => input.current?.focus()}
      className="flex min-h-11 w-full cursor-text flex-wrap items-center gap-1.5 rounded-xl border border-input bg-card px-2 py-1.5 transition-colors focus-within:ring-2 focus-within:ring-ring/40 hover:border-foreground/25"
    >
      {values.map((v, i) => (
        <span
          key={`${v}-${i}`}
          className={cn(
            "inline-flex h-7 max-w-full items-center gap-1 rounded-lg bg-secondary ps-2.5 pe-1 text-sm font-medium",
            pattern && "font-mono text-[13px]",
          )}
        >
          <bdi className="truncate">{v}</bdi>
          <button
            type="button"
            aria-label={e.removeValue(v)}
            onClick={(ev) => {
              ev.stopPropagation();
              onChange({ values: values.filter((_, j) => j !== i), draft });
            }}
            className="flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-foreground/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <X className="size-3" strokeWidth={2.5} />
          </button>
        </span>
      ))}
      <input
        ref={input}
        value={draft}
        maxLength={MAX_TEXT}
        onChange={(ev) => {
          const text = ev.target.value;
          if (!pattern && text.includes(",")) commit(text);
          else onChange({ values, draft: text });
        }}
        onKeyDown={(ev) => {
          if (ev.key === "Enter" && draft.trim() !== "") {
            ev.preventDefault();
            commit(draft);
          } else if (ev.key === "Backspace" && draft === "" && values.length > 0) {
            ev.preventDefault();
            const last = values.at(-1) ?? "";
            onChange({ values: values.slice(0, -1), draft: last });
          }
        }}
        onPaste={(ev) => {
          const text = ev.clipboardData.getData("text");
          if (pattern || !/[,\n]/.test(text)) return;
          ev.preventDefault();
          commit(draft + text);
        }}
        onBlur={() => {
          if (!pattern && draft.trim() !== "") commit(draft);
        }}
        placeholder={placeholder}
        className={cn(
          "h-7 min-w-32 flex-1 bg-transparent px-1 text-[15px] outline-none placeholder:text-sm placeholder:text-muted-foreground/80",
          pattern && "font-mono text-sm",
        )}
        dir="auto"
        autoFocus={autoFocus}
        spellCheck={false}
        aria-label={e.valuesPlaceholder}
      />
    </div>
  );
}
