// The period every page looks at (spec 16), shared by the top bar picker and
// pages. It lasts for the session. Choosing a calendar month (a chart bar,
// a screenshot aid) makes that month the period.

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { DateRange, IsoDate, IsoMonth } from "@shared/types";
import { periodRange, toIsoDate, toIsoMonth, type PeriodChoice } from "./month";

interface PeriodState {
  choice: PeriodChoice;
  /** The days the period covers, both ends included. */
  range: DateRange;
  today: IsoDate;
  /** The calendar month today falls in. */
  current: IsoMonth;
  setChoice: (choice: PeriodChoice) => void;
  /** Shows one calendar month, never past the current one. */
  showMonth: (month: IsoMonth) => void;
}

const PeriodContext = createContext<PeriodState | null>(null);

export function MonthProvider({ children }: { children: ReactNode }) {
  const [today] = useState(() => toIsoDate(new Date()));
  const current = today.slice(0, 7);
  const [choice, setChoiceRaw] = useState<PeriodChoice>(() => ({
    kind: "month",
    month: toIsoMonth(new Date()),
    year: Number(today.slice(0, 4)),
    custom: { from: `${current}-01`, to: today },
  }));

  const period = useMemo<PeriodState>(
    () => ({
      choice,
      range: periodRange(choice, today),
      today,
      current,
      setChoice: (c) => setChoiceRaw({ ...c, month: c.month > current ? current : c.month }),
      showMonth: (m) => setChoiceRaw((c) => ({ ...c, kind: "month", month: m > current ? current : m })),
    }),
    [choice, today, current],
  );
  return <PeriodContext.Provider value={period}>{children}</PeriodContext.Provider>;
}

export function usePeriod(): PeriodState {
  const ctx = useContext(PeriodContext);
  if (!ctx) throw new Error("usePeriod outside MonthProvider");
  return ctx;
}
