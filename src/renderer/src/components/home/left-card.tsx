// "Left this month" (spec 22, F51): income minus spending and savings moves
// this calendar month and about how much a day that leaves until the month ends. Core
// works out every number (summary:thisMonth); this card only words them.
// Overspent reads in the same warning style as the hero's line.

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { TriangleAlert } from "lucide-react";
import type { ThisMonth } from "@shared/types";
import { s } from "@/strings";
import { call } from "@/lib/api";
import { refreshLedger } from "@/lib/hooks";
import { ils } from "@/lib/format";
import { Card, Label } from "@/components/common/card";

export function LeftCard({ left }: { left: ThisMonth }) {
  const money = (a: number) => ils(a, { decimals: false });
  return (
    <Card className="px-8 py-6">
      <Label>{s.left.title}</Label>
      <div title={s.left.hint}>
        {left.perDay !== null ? (
          <p className="mt-2 font-heading text-[28px] leading-tight tracking-tight">
            {s.left.perDay(money(left.left), left.daysLeft, money(left.perDay))}
          </p>
        ) : left.left < 0 ? (
          <p className="mt-2 flex items-center gap-2.5 font-heading text-[28px] leading-tight tracking-tight text-status-over">
            <TriangleAlert className="size-6 shrink-0" />
            {s.left.over(money(-left.left))}
          </p>
        ) : (
          <p className="mt-2 font-heading text-[28px] leading-tight tracking-tight">{s.left.nothing(left.daysLeft)}</p>
        )}
        <p className="mt-2 text-sm text-muted-foreground">
          {left.income === 0 && <span className="me-2 text-foreground">{s.left.noIncome}</span>}
          {s.left.soFar(money(left.income), money(left.spending), left.transfers !== 0 ? money(left.transfers) : null)}
        </p>
      </div>
    </Card>
  );
}

/**
 * Demo screenshots only (`?shot=left-overspent`): excludes this month's
 * income in the throwaway Demo database, as a user could by hand, so the
 * card shows its overspent state.
 */
export function useOverspentShot(shot: string | null, left: ThisMonth | undefined): void {
  const client = useQueryClient();
  const done = useRef(false);
  useEffect(() => {
    if (shot !== "left-overspent" || !left || done.current) return;
    done.current = true;
    void (async () => {
      const { rows } = await call("transactions:list", { from: `${left.month}-01`, to: left.today, flows: ["income"] });
      await call("transactions:update", { ids: rows.map((r) => r.id), patch: { excluded: true } });
      await refreshLedger(client);
    })();
  }, [shot, left, client]);
}
