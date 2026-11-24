// The window frame: sidebar on the left, the current screen scrolling on
// the right. Pages render their own top bar through <Page>. Spec 31: the
// keys that work anywhere (a letter per page, ? for the list, Ctrl+F).

import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate, useSearchParams } from "react-router";
import { TRANSACTIONS_PATH, requestFind } from "@/components/transactions/find";
import { PAGE_KEYS } from "@/lib/shortcuts";
import { useShortcuts, type ShortcutHandlers } from "@/lib/use-shortcuts";
import { KeyboardHelp } from "@/components/common/keyboard-help";
import { findTarget } from "./find-box";
import { AppSidebar } from "./app-sidebar";

export function AppShell() {
  const scroller = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const shotScroll = Number(params.get("scroll") ?? 0);
  // Screenshot aid (dev start route only): `?shot=keys` opens with the shortcuts list shown.
  const [keysOpen, setKeysOpen] = useState(() => params.get("shot") === "keys");

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [pathname]);

  // Screenshot aid (dev start route only): `#/?scroll=600` shows the lower part of a page.
  useEffect(() => {
    if (!shotScroll) return;
    const id = setTimeout(() => scroller.current?.scrollTo({ top: shotScroll }), 700);
    return () => clearTimeout(id);
  }, [shotScroll]);

  const navigate = useNavigate();
  const handlers: ShortcutHandlers = {
    help: () => setKeysOpen(true),
    // spec 17, 21: Ctrl+F (Cmd+F on Mac) focuses this page's search box, or Transactions' when it has none.
    find: () => {
      requestFind();
      if (findTarget(pathname) === "transactions") void navigate(TRANSACTIONS_PATH);
    },
  };
  for (const page of PAGE_KEYS) handlers[page.id] = () => void navigate(page.to);
  useShortcuts(handlers);

  return (
    <div className="flex h-full">
      <AppSidebar onShowKeys={() => setKeysOpen(true)} />
      <main ref={scroller} className="min-w-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <KeyboardHelp open={keysOpen} onOpenChange={setKeysOpen} />
    </div>
  );
}
