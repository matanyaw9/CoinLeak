// Toasts in the app's colors, following the current theme.
// Adapted from Spent (github.com/Shaya16/Spent), src/components/ui/sonner.tsx,
// with next-themes replaced by our own theme setting.

import { Toaster as Sonner } from "sonner";
import { CircleCheck, Info, LoaderCircle, OctagonX, TriangleAlert } from "lucide-react";
import { useTheme } from "@/lib/theme";

export function Toaster() {
  const { resolved } = useTheme();
  return (
    <Sonner
      theme={resolved}
      position="bottom-right"
      className="toaster group"
      icons={{
        success: <CircleCheck className="size-4 text-status-on-track" />,
        info: <Info className="size-4" />,
        warning: <TriangleAlert className="size-4 text-status-heads-up" />,
        error: <OctagonX className="size-4 text-status-over" />,
        loading: <LoaderCircle className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "calc(var(--radius) * 1.2)",
        } as React.CSSProperties
      }
      toastOptions={{ classNames: { toast: "font-sans shadow-lg shadow-black/5", description: "!text-muted-foreground" } }}
    />
  );
}
