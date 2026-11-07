// The month every page looks at, shared by the top bar picker and pages.

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { IsoMonth } from "@shared/types";
import { toIsoMonth } from "./month";

interface MonthState {
  month: IsoMonth;
  /** The calendar month today falls in. */
  current: IsoMonth;
  setMonth: (month: IsoMonth) => void;
}

const MonthContext = createContext<MonthState | null>(null);

export function MonthProvider({ children }: { children: ReactNode }) {
  const [current] = useState(() => toIsoMonth(new Date()));
  const [month, setMonthRaw] = useState(current);
  const value = useMemo<MonthState>(
    () => ({ month, current, setMonth: (m) => setMonthRaw(m > current ? current : m) }),
    [month, current],
  );
  return <MonthContext.Provider value={value}>{children}</MonthContext.Provider>;
}

export function useMonth(): MonthState {
  const ctx = useContext(MonthContext);
  if (!ctx) throw new Error("useMonth outside MonthProvider");
  return ctx;
}
