// The "Keyboard shortcuts" list (spec 31): every key in the shortcuts table,
// grouped by where it works, so the list and the keys never drift. Opens
// with ? or the link at the foot of the sidebar. Spec 36: the keys of lists
// and rows, in two balanced columns.

import { s } from "@/strings";
import { SHORTCUTS, isMac, keyFor, keyLabel, type Shortcut, type ShortcutGroup } from "@/lib/shortcuts";
import { pageName } from "@/components/layout/app-sidebar";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { KeyHint } from "./key-hint";

const GROUPS: ShortcutGroup[] = ["anywhere", "lists", "rows", "transactions", "trash", "dialogs", "charts", "budgets"];

function what(k: Shortcut, mac: boolean): string {
  if (k.to !== undefined) return s.keys.goTo(pageName(k.to));
  if (k.id === "dialogOk") return s.keys.okLine(keyFor("dialogSubmit", mac));
  return s.keys.does[k.id] ?? s.listKeys.does[k.id] ?? k.id;
}

export function KeyboardHelp({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const mac = isMac();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl" closeLabel={s.keys.close}>
        <div className="overflow-y-auto px-8 pt-7 pb-8">
          <DialogTitle>{s.keys.title}</DialogTitle>
          <DialogDescription className="mt-2">{s.keys.intro}</DialogDescription>
          <div className="mt-6 columns-2 gap-x-10">
            {GROUPS.map((group) => (
              <section key={group} className="mb-6 break-inside-avoid last:mb-0">
                <h3 className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                  {s.keys.groups[group] ?? s.listKeys.groups[group]}
                </h3>
                <ul className="mt-2 divide-y divide-border/70">
                  {SHORTCUTS.filter((k) => k.group === group).map((k) => (
                    <li key={k.id} className="flex items-center justify-between gap-4 py-2 text-sm">
                      <span>{what(k, mac)}</span>
                      <KeyHint keys={keyLabel(k, mac)} className="h-5 px-1.5 text-[11px] whitespace-nowrap" />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
