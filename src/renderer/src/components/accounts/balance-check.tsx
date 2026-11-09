// Balance check on Money accounts (spec 24): a bank account's balance with
// "as of", and one quiet line saying whether CoinLeak's rows add up to it.
// Core decides; this only shows. A gap is shown, never fixed.

import { useState } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import type { BalanceCheck } from "@shared/types";
import { s } from "@/strings";
import { call } from "@/lib/api";
import { ils, formatDayShort } from "@/lib/format";
import { usePeriod } from "@/lib/month-context";
import { useShot } from "@/lib/shot";

// Same key shape as lib/hooks, so the refresh after a sync reaches it too.
export const useBalanceChecks = () =>
  useQuery({ queryKey: ["accounts:balanceChecks"], queryFn: () => call("accounts:balanceChecks", undefined) });

const LOCALE = "en-IL";
const dayMonth = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short" });
const time = new Intl.DateTimeFormat(LOCALE, { hour: "2-digit", minute: "2-digit", hour12: false });

/** "7 Nov, 12:00" in local time. */
export function asOfText(iso: string): string {
  const d = new Date(iso);
  return `${dayMonth.format(d)}, ${time.format(d)}`;
}

/** The balance and when the bank sent it, for the right side of the line. */
export function BalanceAmount({ check }: { check: BalanceCheck | undefined }) {
  if (!check || check.balance === null || check.asOf === null || check.unknownReason === "card") return null;
  return (
    <div className="shrink-0 text-end">
      <div className="num text-[15px] font-medium">{ils(check.balance)}</div>
      <div className="text-xs text-muted-foreground">{s.balance.asOf(asOfText(check.asOf))}</div>
    </div>
  );
}

/** The one line under a bank account: adds up, a gap, or sync again. */
export function BalanceLine({ check }: { check: BalanceCheck | undefined }) {
  if (!check) return <span />;
  if (check.status === "unknown") {
    return check.unknownReason === "one_balance" ? (
      <p className="text-xs text-muted-foreground">{s.balance.syncAgain}</p>
    ) : (
      <span />
    );
  }
  const since = check.window ? formatDayShort(check.window.from) : "";
  if (check.status === "matches") {
    const text = check.rowCount === 0 ? s.balance.nothingMoved(since) : s.balance.matches(check.rowCount, since);
    return <p className="text-xs text-muted-foreground">{text}</p>;
  }
  return <GapLine check={check} since={since} />;
}

function GapLine({ check, since }: { check: BalanceCheck; since: string }) {
  // Screenshot aid: `?shot=balance-why` opens the reasons.
  const [open, setOpen] = useState(useShot() === "balance-why");
  const navigate = useNavigate();
  const period = usePeriod();
  const showRows = () => {
    if (!check.window) return;
    period.setChoice({ ...period.choice, kind: "custom", custom: check.window });
    void navigate(`/transactions?account=${check.accountId}`);
  };
  return (
    <div className="min-w-0 text-xs">
      <p className="text-status-heads-up">{s.balance.gap(ils(Math.abs(check.gap)), since)}</p>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
        <button type="button" className="text-primary underline-offset-4 hover:underline" onClick={showRows}>
          {s.balance.showRows}
        </button>
        <button
          type="button"
          className="text-muted-foreground underline-offset-4 hover:underline"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {s.balance.why}
        </button>
      </div>
      {open && (
        <div className="mt-2 text-muted-foreground">
          <ul className="list-disc space-y-0.5 ps-4">
            {s.balance.whyReasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <p className="mt-1">{s.balance.whyNote}</p>
        </div>
      )}
    </div>
  );
}
