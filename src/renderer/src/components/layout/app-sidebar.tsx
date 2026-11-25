// Left sidebar: brand, the screens, and the open profile with its switcher.
// Look adapted from Spent (github.com/Shaya16/Spent), src/components/layout/app-sidebar.tsx.
// Spec 31: each screen shows its key, and the foot opens the shortcuts list.

import { NavLink } from "react-router";
import {
  ArrowLeftRight,
  House,
  Keyboard,
  Landmark,
  PiggyBank,
  Settings,
  Shapes,
  Trash2,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { PAGE_KEYS, keyFor } from "@/lib/shortcuts";
import { KeyHint } from "@/components/common/key-hint";
import { Logo } from "./logo";
import { ProfileSwitcher } from "./profile-switcher";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const MAIN: NavItem[] = [
  { to: "/", label: s.nav.home, icon: House },
  { to: "/transactions", label: s.nav.transactions, icon: ArrowLeftRight },
  { to: "/categories", label: s.nav.categories, icon: Shapes },
  { to: "/budgets", label: s.plan.nav, icon: PiggyBank },
  { to: "/rules", label: s.rules.nav, icon: WandSparkles },
  { to: "/accounts", label: s.nav.accounts, icon: Landmark },
];
const MORE: NavItem[] = [
  { to: "/trash", label: s.trash.nav, icon: Trash2 },
  { to: "/settings", label: s.nav.settings, icon: Settings },
];

/** The sidebar's name for a page, for the shortcuts list. */
export function pageName(to: string): string {
  return [...MAIN, ...MORE].find((item) => item.to === to)?.label ?? to;
}

function Item({ to, label, icon: Icon }: NavItem) {
  const key = PAGE_KEYS.find((k) => k.to === to)?.key;
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        cn(
          "flex h-10 items-center gap-3 rounded-xl px-3 text-[15px] text-sidebar-foreground/85 transition-colors outline-none hover:bg-sidebar-accent/70 hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring/50",
          isActive && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
        )
      }
    >
      <Icon className="size-[18px] shrink-0" strokeWidth={1.75} />
      <span className="flex-1 truncate">{label}</span>
      {key && <KeyHint keys={key.toUpperCase()} className="border-sidebar-border text-muted-foreground/80" />}
    </NavLink>
  );
}

export function AppSidebar({ onShowKeys }: { onShowKeys: () => void }) {
  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-e border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2.5 px-5 pt-6 pb-7">
        <Logo className="size-8 shrink-0 text-sidebar-foreground" />
        <div className="min-w-0">
          <div className="font-heading text-[19px] leading-tight font-semibold tracking-tight">{s.app.name}</div>
          <div className="mt-0.5 text-[10px] leading-tight font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            {s.app.tagline}
          </div>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5 px-3">
        {MAIN.map((item) => (
          <Item key={item.to} {...item} />
        ))}
        <div className="mx-3 my-3 h-px bg-sidebar-border" />
        {MORE.map((item) => (
          <Item key={item.to} {...item} />
        ))}
      </nav>

      <div className="mt-auto p-4">
        <button
          type="button"
          onClick={onShowKeys}
          className="mb-3 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-muted-foreground transition-colors outline-none hover:bg-sidebar-accent/70 hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring/50"
        >
          <Keyboard className="size-4 shrink-0" strokeWidth={1.75} />
          <span className="flex-1 text-start">{s.keys.link}</span>
          <KeyHint keys={keyFor("help", false)} className="border-sidebar-border text-muted-foreground/80" />
        </button>
        <ProfileSwitcher />
      </div>
    </aside>
  );
}
