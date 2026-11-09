// The cash wallet on the Money accounts page (spec 20): its name and how
// many rows it holds. It never syncs, so no Sync button and no card mode.

import { useEffect, useRef } from "react";
import { Wallet } from "lucide-react";
import { s } from "@/strings";
import { useShot } from "@/lib/shot";
import { Card } from "@/components/common/card";
import { useCashWallet } from "@/components/transactions/cash-actions";

export function CashWalletCard() {
  const wallet = useCashWallet();
  const shot = useShot();
  const card = useRef<HTMLDivElement>(null);
  const ready = wallet.isSuccess;
  // Screenshot aid: `?shot=cash-wallet` scrolls to this card.
  useEffect(() => {
    if (shot !== "cash-wallet" || !ready) return;
    const id = setTimeout(() => card.current?.scrollIntoView({ block: "center" }), 400);
    return () => clearTimeout(id);
  }, [shot, ready]);
  if (wallet.isPending || wallet.isError) return null;
  const rows = wallet.data?.rowCount ?? 0;
  return (
    <div ref={card}>
      <Card className="p-0">
        <div className="flex items-center gap-4 p-6">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-status-on-track/15 text-status-on-track">
            <Wallet className="size-5" strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[17px] font-medium">{s.cash.accountsTitle}</p>
            <p className="text-sm text-muted-foreground">{s.cash.accountsBody}</p>
          </div>
        </div>
        <div className="border-t border-border px-6 py-3 text-sm text-muted-foreground">
          {wallet.data ? s.cash.accountsRows(rows) : s.cash.accountsEmpty}
        </div>
      </Card>
    </div>
  );
}
