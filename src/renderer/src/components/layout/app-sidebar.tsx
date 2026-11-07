// Left sidebar: brand, the five screens, and a reminder that data is local.
// Look adapted from Spent (github.com/Shaya16/Spent), src/components/layout/app-sidebar.tsx.

import { NavLink } from "react-router";
import { ArrowLeftRight, House, Landmark, Lock, Settings, Shapes, FlaskConical, type LucideIcon } from "lucide-react";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { DEMO } from "@/lib/api";
import { Logo } from "./logo";

const MAIN: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/", label: s.nav.home, icon: House },
  { to: "/transactions", label: s.nav.transactions, icon: ArrowLeftRight },
  { to: "/categories", label: s.nav.categories, icon: Shapes },
  { to: "/accounts", label: s.nav.accounts, icon: Landmark },
];

function Item({ to, label, icon: Icon }: { to: string; label: string; icon: LucideIcon }) {
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
      <span>{label}</span>
    </NavLink>
  );
}

export function AppSidebar() {
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
        <Item to="/settings" label={s.nav.settings} icon={Settings} />
      </nav>

      <div className="mt-auto p-4">
        {DEMO ? (
          <div className="rounded-2xl border border-status-heads-up/30 bg-status-heads-up/10 px-3.5 py-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FlaskConical className="size-4 text-status-heads-up" strokeWidth={1.75} />
              {s.app.demo}
            </div>
            <p className="mt-1 text-xs leading-snug text-muted-foreground">{s.app.demoHint}</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-sidebar-accent/60 px-3.5 py-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Lock className="size-4 text-primary" strokeWidth={1.75} />
              {s.app.localOnly}
            </div>
            <p className="mt-1 text-xs leading-snug text-muted-foreground">{s.app.localOnlyHint}</p>
          </div>
        )}
      </div>
    </aside>
  );
}
