// Placeholder screen for the skeleton. The UI shell spec replaces it.

import { useEffect, useState } from "react";
import type { AppInfo } from "@shared/types";
import { formatIls } from "@shared/money";
import { call } from "./lib/api";

export function App() {
  const [info, setInfo] = useState<AppInfo | null>(null);

  useEffect(() => {
    call("app:info", undefined).then(setInfo, () => setInfo(null));
  }, []);

  return (
    <main className="flex h-full items-center justify-center p-8">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm">
        <p className="text-sm text-muted-foreground">Spent this month</p>
        <p className="num mt-1 text-5xl text-foreground">{formatIls(0, { decimals: false })}</p>
        <h1 className="mt-6 font-heading text-2xl">CoinLeak</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Skeleton is running{info ? `, version ${info.version}` : ""}.
        </p>
        <div className="mt-6 flex gap-2">
          <span className="rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground">Local only</span>
          <span className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground">
            {info?.dev ? "Dev data" : "Your data"}
          </span>
        </div>
      </div>
    </main>
  );
}
