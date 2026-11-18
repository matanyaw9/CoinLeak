// The period every page looks at (spec 16), shared by the top bar picker and
// pages. It lasts for the session. Choosing a calendar month (a chart bar,
// a screenshot aid) makes that month the period. Today stays current while
// the window is open, so a new day or month is never out of reach.

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { DateRange, IsoDate, IsoMonth } from "@shared/types";
import { periodRange, toIsoDate, type PeriodChoice } from "./month";

/** How often the date is checked while the window stays open. */
const CHECK_MS = 60_000;

/** Today's date, checked every minute and whenever the window gets focus back. */
function useToday(): IsoDate {
  const [today, setToday] = useState(() => toIsoDate(new Date()));
  useEffect(() => {
    const check = () => setToday(toIsoDate(new Date()));
    const id = setInterval(check, CHECK_MS);
    window.addEventListener("focus", check);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", check);
    };
  }, []);
  return today;
}

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
  const today = useToday();
  const current = today.slice(0, 7);
  const [choice, setChoiceRaw] = useState<PeriodChoice>(() => ({
    kind: "month",
    month: current,
    year: Number(today.slice(0, 4)),
    custom: { from: `${current}-01`, to: today },
  }));

  // A new day moves "this month", the budget week and every "so far": ask again.
  const client = useQueryClient();
  const seen = useRef(today);
  useEffect(() => {
    if (seen.current === today) return;
    seen.current = today;
    void client.invalidateQueries();
  }, [today, client]);

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
