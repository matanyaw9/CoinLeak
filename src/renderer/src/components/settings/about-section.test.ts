// spec 42 A: each About button asks main for its own fixed page by name, and a
// refused call is said in a toast.

import { isValidElement, type ReactNode } from "react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ERROR_MESSAGES } from "@shared/errors";
import { s } from "@/strings";
import { ApiError, call } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { AboutCard } from "./about-section";

vi.mock("@/lib/api", async (original) => ({ ...(await original<typeof import("@/lib/api")>()), call: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

type Props = { children?: ReactNode; onClick?: () => void };

/** Every Button in the card, with the words on it and what pressing it does. */
function buttons(node: ReactNode): { words: string; press: () => void }[] {
  if (Array.isArray(node)) return node.flatMap(buttons);
  if (!isValidElement<Props>(node)) return [];
  const { children, onClick } = node.props;
  if (node.type !== Button) return buttons(children);
  const words = [children].flat().filter((c) => typeof c === "string").join("");
  return [{ words, press: () => onClick?.() }];
}

const card = () => buttons(AboutCard({ version: "1.2.3" }));

beforeEach(() => {
  vi.mocked(call).mockReset().mockResolvedValue(null);
  vi.mocked(toast.error).mockReset();
});

describe("About CoinLeak", () => {
  it.each([
    [s.about.updates, "releases"],
    [s.about.feedback, "feedback"],
    [s.about.star, "star"],
  ])("%s opens its fixed page", (words, link) => {
    card()
      .find((b) => b.words === words)
      ?.press();
    expect(vi.mocked(call).mock.calls).toEqual([["app:openLink", { link }]]);
  });

  it("has these three buttons and no others", () => {
    expect(card().map((b) => b.words)).toEqual([s.about.updates, s.about.feedback, s.about.star]);
  });

  it("says the coded message when the page cannot be opened", async () => {
    vi.mocked(call).mockRejectedValue(new ApiError({ code: "BAD_REQUEST", message: ERROR_MESSAGES.BAD_REQUEST }));
    card()[0]?.press();
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith(ERROR_MESSAGES.BAD_REQUEST));
  });
});
