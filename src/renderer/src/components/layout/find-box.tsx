// A page's own search box (spec 21): Ctrl+F focuses and selects it on the
// pages that have one, Escape clears it and leaves, and matched text can be
// highlighted. Transactions keeps its own box (spec 17).

import { useEffect, useRef, type ReactNode } from "react";
import { Search, SearchX, X } from "lucide-react";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { onFind, takeFindRequest, TRANSACTIONS_PATH } from "@/components/transactions/find";
import { Input } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/common/card";
import { EmptyState } from "@/components/common/empty-state";
import { splitHits } from "./find-text";

/** Pages where Ctrl+F stays and focuses the page's own box. */
const OWN_FIND = ["/categories", "/rules"];

/** What Ctrl+F does on `pathname`: focus a box here, or go to Transactions. */
export function findTarget(pathname: string): "here" | "transactions" {
  return pathname === TRANSACTIONS_PATH || OWN_FIND.includes(pathname) ? "here" : "transactions";
}

export function FindBox({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const focus = () => {
      box.current?.focus();
      box.current?.select();
    };
    if (takeFindRequest()) focus();
    return onFind(focus);
  }, []);

  return (
    <label className={cn("relative block", className)}>
      <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={box}
        value={value}
        dir="auto"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Escape") return;
          e.preventDefault();
          onChange("");
          e.currentTarget.blur();
        }}
        placeholder={placeholder}
        className="h-9 rounded-full ps-10 pe-9 text-start"
      />
      {value !== "" && (
        <button
          type="button"
          aria-label={s.find.clear}
          onClick={() => {
            onChange("");
            box.current?.focus();
          }}
          className="absolute end-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <X className="size-3.5" />
        </button>
      )}
    </label>
  );
}

/** "No matches" for a page search, with a clear button and optional other ways out. */
export function NoMatches({ query, onClear, children }: { query: string; onClear: () => void; children?: ReactNode }) {
  return (
    <Card className="py-2">
      <EmptyState
        icon={SearchX}
        compact
        title={s.find.noMatchTitle}
        body={<bdi>{s.find.noMatchBody(query)}</bdi>}
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button variant="outline" className="rounded-full" onClick={onClear}>
              <X />
              {s.find.clear}
            </Button>
            {children}
          </div>
        }
      />
    </Card>
  );
}

/** `text` with every place it holds `query` marked. */
export function Highlight({ text, query }: { text: string; query: string }) {
  return (
    <>
      {splitHits(text, query).map((p, i) =>
        p.hit ? (
          <mark key={i} className="rounded-[3px] bg-primary/20 px-px text-inherit">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}
