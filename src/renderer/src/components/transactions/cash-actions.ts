// The cash wallet's calls (spec 20): read the wallet, add or edit a row
// typed by hand. Every change refreshes the money views and the wallet.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ManualTransactionInput } from "@shared/types";
import { call } from "@/lib/api";
import { refreshLedger } from "@/lib/hooks";

const WALLET = ["cash:wallet"];

export const useCashWallet = () => useQuery({ queryKey: WALLET, queryFn: () => call("cash:wallet", undefined) });

/** Adds a row when `id` is null, else changes that row. */
export function useSaveManual() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: number | null; input: ManualTransactionInput }): Promise<void> => {
      if (id === null) await call("transactions:addManual", input);
      else await call("transactions:editManual", { id, input });
    },
    onSettled: () => Promise.all([client.invalidateQueries({ queryKey: WALLET }), refreshLedger(client)]),
  });
}
