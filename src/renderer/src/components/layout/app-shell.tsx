// The window frame: sidebar on the left, the current screen scrolling on
// the right. Pages render their own top bar through <Page>.

import { useEffect, useRef } from "react";
import { Outlet, useLocation, useNavigate, useSearchParams } from "react-router";
import { TRANSACTIONS_PATH, findAction, isFindKey, isMac, requestFind } from "@/components/transactions/find";
import { AppSidebar } from "./app-sidebar";

export function AppShell() {
  const scroller = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const shotScroll = Number(params.get("scroll") ?? 0);

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [pathname]);

  // Screenshot aid (dev start route only): `#/?scroll=600` shows the lower part of a page.
  useEffect(() => {
    if (!shotScroll) return;
    const id = setTimeout(() => scroller.current?.scrollTo({ top: shotScroll }), 700);
    return () => clearTimeout(id);
  }, [shotScroll]);

  // spec 17: Ctrl+F (Cmd+F on Mac) goes to the Transactions search box.
  const navigate = useNavigate();
  useEffect(() => {
    const mac = isMac();
    const onKey = (e: KeyboardEvent) => {
      if (!isFindKey(e, mac)) return;
      e.preventDefault();
      requestFind();
      if (findAction(pathname) === "navigate") void navigate(TRANSACTIONS_PATH);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pathname, navigate]);

  return (
    <div className="flex h-full">
      <AppSidebar />
      <main ref={scroller} className="min-w-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
