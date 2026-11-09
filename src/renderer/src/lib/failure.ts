// One way to say that an action failed: the app's own coded message when it
// gave one, else what the user tried ("Failed to add the transaction.").
// Never the raw error text, which could hold transaction data.

import { toast } from "sonner";
import { s } from "@/strings";
import { ApiError } from "./api";

export function showFailure(error: unknown, what: string): void {
  if (error instanceof ApiError) toast.error(error.message);
  else toast.error(what, { description: s.errors.tryAgain });
}
