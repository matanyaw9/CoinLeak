// The row menu (spec 11): the same entries on right click and from a small
// "..." button, for people who do not right click. The page decides what
// the entries are and what they act on, and opens any dialog an entry
// needs (spec 36). The menu key or Shift+F10 opens the "..." menu.

import { type ReactNode } from "react";
import { ContextMenu } from "@base-ui/react/context-menu";
import { Menu } from "@base-ui/react/menu";
import { Ellipsis, type LucideIcon } from "lucide-react";
import { s } from "@/strings";
import { cn } from "@/lib/utils";

export interface MenuEntry {
  key: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  onSelect: () => void;
  danger?: boolean;
}

export interface RowMenuModel {
  /** Shown above the entries when the menu acts on several rows. */
  heading?: string;
  entries: MenuEntry[];
}

const POPUP =
  "z-50 min-w-60 max-w-80 origin-(--transform-origin) rounded-2xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg shadow-black/10 outline-none data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 data-[starting-style]:scale-95 transition-[opacity,scale] duration-150 dark:shadow-black/40";
const ITEM =
  "flex cursor-default items-start gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none select-none data-[highlighted]:bg-accent";

function Entries({ model }: { model: RowMenuModel }) {
  return (
    <>
      {model.heading && (
        <div className="px-2.5 pt-1.5 pb-1 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
          {model.heading}
        </div>
      )}
      {model.entries.map((e) => (
        <Menu.Item key={e.key} className={ITEM} onClick={e.onSelect}>
          <e.icon className={cn("mt-0.5 size-4 shrink-0", e.danger ? "text-destructive" : "text-muted-foreground")} strokeWidth={1.75} />
          <span className="min-w-0">
            <span dir="auto" className={cn("line-clamp-2 block", e.danger && "text-destructive")}>
              {e.label}
            </span>
            {e.hint && <span className="block text-xs text-muted-foreground">{e.hint}</span>}
          </span>
        </Menu.Item>
      ))}
    </>
  );
}

/** Wraps a row so a right click opens the menu at the pointer. */
export function RowContextMenu({ menu, children }: { menu: () => RowMenuModel; children: ReactNode }) {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger render={<div />}>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Positioner className="isolate z-50">
          <ContextMenu.Popup className={POPUP}>
            <Entries model={menu()} />
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

/** The "..." button with the same menu. The row opens it from the keyboard too. */
export function RowMenuButton({
  menu,
  open,
  onOpenChange,
}: {
  menu: () => RowMenuModel;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Menu.Root open={open} onOpenChange={onOpenChange}>
      <Menu.Trigger
        aria-label={s.rowMenu.open}
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-[opacity,background-color] outline-none group-hover:opacity-100 hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50 data-[popup-open]:bg-accent data-[popup-open]:opacity-100"
      >
        <Ellipsis className="size-4" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className="isolate z-50" side="bottom" align="end" sideOffset={4}>
          <Menu.Popup className={POPUP}>
            <Entries model={menu()} />
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
