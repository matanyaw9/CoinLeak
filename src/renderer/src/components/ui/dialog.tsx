// Modal dialog on base-ui: a soft blurred backdrop and a rounded card that
// fades and zooms in, styled like the app's popovers. Spec 31: Enter presses
// OK, Ctrl+Enter presses it from a text box too, and only Ctrl+Enter presses
// an OK that deletes. base-ui's Esc cancels.

import { useRef } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { dialogEnter, type DialogFocus } from "@/lib/shortcuts";
import { isMac } from "@/components/transactions/find";

function Dialog(props: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

const CONTROL = 'button, a[href], select, [role="checkbox"], [role="radio"], [role="option"], [role="combobox"], [role="switch"], [role="menuitem"]';
const SINGLE_LINE = new Set(["text", "search", "email", "number", "tel", "url", "password", "date", "month"]);

function focusKind(el: Element, ok: HTMLButtonElement | null): DialogFocus {
  if (ok?.contains(el)) return "ok";
  if (el instanceof HTMLTextAreaElement || (el instanceof HTMLElement && el.isContentEditable)) return "multiline";
  if (el instanceof HTMLInputElement) {
    if (el.form) return "form";
    return SINGLE_LINE.has(el.type) ? "field" : "control";
  }
  return el.closest(CONTROL) ? "control" : "none";
}

/**
 * The dialog's OK button: its form's submit button, or else its last solid
 * button (variants default and destructive; Cancel buttons are ghost or
 * outline). It may be disabled.
 */
function okButton(card: HTMLElement): HTMLButtonElement | null {
  const submit = card.querySelector<HTMLButtonElement>('button[type="submit"]:not([hidden])');
  const solid = [...card.querySelectorAll<HTMLButtonElement>('button[data-variant="default"], button[data-variant="destructive"]')].at(-1);
  return submit ?? solid ?? null;
}

/** OK deletes or removes something: Enter alone must never press it. */
function isDestructive(ok: HTMLButtonElement | null): boolean {
  return ok?.dataset["variant"] === "destructive";
}

function DialogContent({
  className,
  children,
  closeLabel,
  onKeyDown,
  ...props
}: DialogPrimitive.Popup.Props & { closeLabel?: string }) {
  const popup = useRef<HTMLDivElement>(null);

  // Keys from inside this card only: a picker opened from the dialog is
  // portaled out of it, and React still bubbles its keys here.
  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as Element;
    if (e.defaultPrevented || !e.currentTarget.contains(target)) return;
    const ok = okButton(e.currentTarget);
    const what = dialogEnter(e.nativeEvent, focusKind(target, ok), isMac(), isDestructive(ok));
    if (!what) return;
    e.preventDefault();
    if (what === "ok" && ok && !ok.disabled) ok.click();
  };

  // A text box with autoFocus keeps focus. Otherwise the card takes it, so
  // Enter means OK rather than pressing Cancel, the first button; except
  // when OK deletes, where focus stays on the first button as before.
  const initialFocus = () => {
    const card = popup.current;
    return card && !isDestructive(okButton(card)) ? card : true;
  };

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-[oklch(0.25_0.02_70)]/25 backdrop-blur-[2px] transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0 dark:bg-black/50" />
      <DialogPrimitive.Viewport className="fixed inset-0 z-50 flex items-center justify-center p-6">
        <DialogPrimitive.Popup
          ref={popup}
          data-slot="dialog-content"
          initialFocus={initialFocus}
          onKeyDown={(e) => {
            onKeyDown?.(e);
            onKey(e);
          }}
          className={cn(
            "relative flex max-h-full w-full flex-col overflow-hidden rounded-3xl border border-border bg-popover text-popover-foreground shadow-2xl shadow-black/10 outline-none transition-[opacity,scale] duration-200 data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0 dark:shadow-black/50",
            className,
          )}
          {...props}
        >
          {children}
          {closeLabel && (
            <DialogPrimitive.Close
              aria-label={closeLabel}
              className="absolute end-4 top-4 flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <X className="size-4" />
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Viewport>
    </DialogPrimitive.Portal>
  );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return <DialogPrimitive.Title className={cn("font-heading text-2xl leading-tight tracking-tight", className)} {...props} />;
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return <DialogPrimitive.Description className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export { Dialog, DialogContent, DialogTitle, DialogDescription };
