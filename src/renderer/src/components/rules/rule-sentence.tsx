// A rule's plain sentence on screen: muted connecting words, with the text,
// account, amounts and category the user chose standing out.

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { colorOf, indexCategories } from "@/lib/categories";
import { useAccounts, useCategories } from "@/lib/hooks";
import { ruleSentence, type SentenceContext } from "@/lib/rule-sentence";

export function useSentenceContext(): SentenceContext {
  const categories = useCategories();
  const accounts = useAccounts();
  return useMemo(() => {
    const index = indexCategories(categories.data);
    const byAccount = new Map((accounts.data ?? []).map((a) => [a.id, a]));
    return { category: (id) => index.byId.get(id), account: (id) => byAccount.get(id) };
  }, [categories.data, accounts.data]);
}

export function RuleSentence({
  rule,
  context,
  className,
}: {
  rule: Parameters<typeof ruleSentence>[0];
  context: SentenceContext;
  className?: string;
}) {
  const parts = ruleSentence(rule, context);
  return (
    <p className={cn("leading-relaxed text-pretty text-muted-foreground", className)}>
      {parts.map((p, i) => {
        if (p.kind === "text") return <span key={i}>{p.text}</span>;
        if (p.kind === "value") {
          return (
            <bdi key={i} className="rounded-md bg-secondary px-1.5 py-px font-medium text-foreground [box-decoration-break:clone]">
              {p.text}
            </bdi>
          );
        }
        if (p.kind === "category") {
          return (
            <span key={i} className="font-medium whitespace-nowrap text-foreground">
              <span
                className="me-1 inline-block size-2 rounded-full align-[0.08em]"
                style={{ backgroundColor: colorOf(p.category) }}
              />
              {p.text}
            </span>
          );
        }
        return (
          <span key={i} className={cn("font-medium text-foreground", p.kind === "money" && "whitespace-nowrap")} dir="auto">
            {p.text}
          </span>
        );
      })}
    </p>
  );
}
