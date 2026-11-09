// The month and the period every page looks at, shared by the top bar picker
// and pages. The period (spec 16) lasts for the session; `useMonth` stays the
// calendar month it always was, and choosing a month makes it the period.

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { DateRange, IsoDate, IsoMonth } from "@shared/types";
import { periodRange, toIsoDate, toIsoMonth, type PeriodChoice } from "./month";

interface MonthState {
  month: IsoMonth;
  /** The calendar month today falls in. */
  current: IsoMonth;
  setMonth: (month: IsoMonth) => void;
}

interface PeriodState {
  choice: PeriodChoice;
  /** The days the period covers, both ends included. */
  range: DateRange;
  today: IsoDate;
  current: IsoMonth;
  setChoice: (choice: PeriodChoice) => void;
}

const MonthContext = createContext<MonthState | null>(null);
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

  const month = useMemo<MonthState>(
    () => ({
      month: choice.month,
      current,
      setMonth: (m) => setChoiceRaw((c) => ({ ...c, kind: "month", month: m > current ? current : m })),
    }),
    [choice.month, current],
  );
  const period = useMemo<PeriodState>(
    () => ({
      choice,
      range: periodRange(choice, today),
      today,
      current,
      setChoice: (c) => setChoiceRaw({ ...c, month: c.month > current ? current : c.month }),
    }),
    [choice, today, current],
  );
  return (
    <MonthContext.Provider value={month}>
      <PeriodContext.Provider value={period}>{children}</PeriodContext.Provider>
    </MonthContext.Provider>
  );
}

export function useMonth(): MonthState {
  const ctx = useContext(MonthContext);
  if (!ctx) throw new Error("useMonth outside MonthProvider");
  return ctx;
}

export function usePeriod(): PeriodState {
  const ctx = useContext(PeriodContext);
  if (!ctx) throw new Error("usePeriod outside MonthProvider");
  return ctx;
}
