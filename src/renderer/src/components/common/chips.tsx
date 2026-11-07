// Small identity chips: category emoji bubble, provider badge, account chip.

import type { Account, Category, ProviderId } from "@shared/types";
import { Tag, type LucideIcon } from "lucide-react";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { colorOf } from "@/lib/categories";

const tint = (color: string, pct: number) => `color-mix(in oklab, ${color} ${pct}%, transparent)`;

export function CategoryBubble({
  category,
  size = 36,
  className,
}: {
  category: Category | null | undefined;
  size?: number;
  className?: string;
}) {
  if (!category) {
    return (
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full border border-dashed border-foreground/25 text-muted-foreground",
          className,
        )}
        style={{ width: size, height: size }}
      >
        <Tag className="size-[40%]" strokeWidth={1.75} />
      </span>
    );
  }
  const color = colorOf(category);
  return (
    <span
      className={cn("flex shrink-0 items-center justify-center rounded-full", className)}
      style={{ width: size, height: size, backgroundColor: tint(color, 24), fontSize: size * 0.48 }}
    >
      <span className="leading-none">{category.emoji ?? category.name.slice(0, 1)}</span>
    </span>
  );
}

/** A neutral bubble with an icon, for rows that are not spending. */
export function IconBubble({ icon: Icon, size = 36, className }: { icon: LucideIcon; size?: number; className?: string }) {
  return (
    <span
      className={cn("flex shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground", className)}
      style={{ width: size, height: size }}
    >
      <Icon className="size-[42%]" strokeWidth={1.75} />
    </span>
  );
}

export function ColorDot({ color, className }: { color: string; className?: string }) {
  return <span className={cn("inline-block size-2.5 shrink-0 rounded-full", className)} style={{ backgroundColor: color }} />;
}

const PROVIDER_COLORS: Record<ProviderId, string> = {
  discount: "#4E9A6A",
  visaCal: "#5A8BC4",
};

export function ProviderBadge({ provider, size = 20, className }: { provider: ProviderId; size?: number; className?: string }) {
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center font-heading font-semibold text-white", className)}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        backgroundColor: PROVIDER_COLORS[provider],
        fontSize: size * 0.55,
      }}
      aria-hidden
    >
      {s.providers[provider].short.slice(0, 1)}
    </span>
  );
}

export const lastDigits = (a: Account) => a.accountNumber.slice(-4);

export function accountLabel(a: Account): string {
  return a.name ?? `${s.providers[a.provider].short} ${lastDigits(a)}`;
}

export function AccountChip({ account, className }: { account: Account | undefined; className?: string }) {
  if (!account) return null;
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full bg-secondary/70 py-0.5 ps-1 pe-2 text-xs text-secondary-foreground/80",
        className,
      )}
      title={`${s.providers[account.provider].name} · ${accountLabel(account)}`}
    >
      <ProviderBadge provider={account.provider} size={16} />
      <span className="truncate">{s.providers[account.provider].short}</span>
      <span className="num text-muted-foreground tabular-nums">··{lastDigits(account)}</span>
    </span>
  );
}
