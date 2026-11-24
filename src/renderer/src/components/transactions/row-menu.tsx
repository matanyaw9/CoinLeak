// The row menu (spec 11): the same entries on right click and from a small
// "..." button, for people who do not right click. The page decides what
// the entries are and what they act on. Spec 33: an entry may open a dialog
// instead, shown beside the row so it stays open after the menu closes.

import { createContext, useContext, useState, type ReactNode } from "react";
import { ContextMenu } from "@base-ui/react/context-menu";
import { Menu } from "@base-ui/react/menu";
import { Ellipsis, type LucideIcon } from "lucide-react";
import { s } from "@/strings";
import { cn } from "@/lib/utils";

/** Renders an entry's dialog; `close` takes it away. */
export type EntryDialog = (close: () => void) => ReactNode;

/** Each entry has `onSelect` (acts at once) or `dialog` (opens one). */
export interface MenuEntry {
  key: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  onSelect?: () => void;
  dialog?: EntryDialog;
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

/** The open entry dialog of one row, if any, and how to open one. */
function useEntryDialog(): { open: (dialog: EntryDialog) => void; shown: ReactNode } {
  // Kept in an object: React would call a bare function given to setState.
  const [dialog, setDialog] = useState<{ render: EntryDialog } | null>(null);
  return {
    open: (render) => setDialog({ render }),
    shown: dialog ? dialog.render(() => setDialog(null)) : null,
  };
}

/** The row's dialog slot, so the "..." button inside the row opens dialogs in the same place. */
const RowDialog = createContext<((dialog: EntryDialog) => void) | null>(null);

/** Opens a dialog in the row's slot (spec 33); null outside a row. */
export const useRowDialog = () => useContext(RowDialog);

function Entries({ model, openDialog }: { model: RowMenuModel; openDialog: (dialog: EntryDialog) => void }) {
  return (
    <>
      {model.heading && (
        <div className="px-2.5 pt-1.5 pb-1 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
          {model.heading}
        </div>
      )}
      {model.entries.map((e) => (
        <Menu.Item key={e.key} className={ITEM} onClick={() => (e.dialog ? openDialog(e.dialog) : e.onSelect?.())}>
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

/**
 * Wraps a row so a right click opens the menu at the pointer. Entry dialogs
 * render after the row, outside the right-click area, so a click inside
 * one never reaches the row.
 */
export function RowContextMenu({ menu, children }: { menu: () => RowMenuModel; children: ReactNode }) {
  const dialog = useEntryDialog();
  return (
    <RowDialog.Provider value={dialog.open}>
      <ContextMenu.Root>
        <ContextMenu.Trigger render={<div />}>{children}</ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Positioner className="isolate z-50">
            <ContextMenu.Popup className={POPUP}>
              <Entries model={menu()} openDialog={dialog.open} />
            </ContextMenu.Popup>
          </ContextMenu.Positioner>
        </ContextMenu.Portal>
      </ContextMenu.Root>
      {dialog.shown}
    </RowDialog.Provider>
  );
}

/** The "..." button with the same menu. Inside a row, its dialogs open in the row's slot. */
export function RowMenuButton({ menu, defaultOpen }: { menu: () => RowMenuModel; defaultOpen?: boolean }) {
  const rowDialog = useRowDialog();
  const own = useEntryDialog();
  return (
    <>
      <Menu.Root defaultOpen={defaultOpen}>
        <Menu.Trigger
          aria-label={s.rowMenu.open}
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-[opacity,background-color] outline-none group-hover:opacity-100 hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50 data-[popup-open]:bg-accent data-[popup-open]:opacity-100"
        >
          <Ellipsis className="size-4" />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner className="isolate z-50" side="bottom" align="end" sideOffset={4}>
            <Menu.Popup className={POPUP}>
              <Entries model={menu()} openDialog={rowDialog ?? own.open} />
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      {own.shown}
    </>
  );
}
