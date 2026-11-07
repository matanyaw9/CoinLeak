// The window frame: sidebar on the left, the current screen scrolling on
// the right. Pages render their own top bar through <Page>.

import { useEffect, useRef } from "react";
import { Outlet, useLocation, useSearchParams } from "react-router";
import { DEMO } from "@/lib/api";
import { AppSidebar } from "./app-sidebar";

export function AppShell() {
  const scroller = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const shotScroll = DEMO ? Number(params.get("scroll") ?? 0) : 0;

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [pathname]);

  // Demo screenshot aid: `#/?scroll=600` shows the lower part of a page.
  useEffect(() => {
    if (!shotScroll) return;
    const id = setTimeout(() => scroller.current?.scrollTo({ top: shotScroll }), 700);
    return () => clearTimeout(id);
  }, [shotScroll]);

  return (
    <div className="flex h-full">
      <AppSidebar />
      <main ref={scroller} className="min-w-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
