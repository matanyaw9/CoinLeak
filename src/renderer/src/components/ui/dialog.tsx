// Modal dialog on base-ui: a soft blurred backdrop and a rounded card that
// fades and zooms in, styled like the app's popovers. Spec 31: Enter presses
// OK and Ctrl+Enter presses it from a text box too; base-ui's Esc cancels.

import { useRef } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { dialogPressesOk, type DialogFocus } from "@/lib/shortcuts";
import { isMac } from "@/components/transactions/find";

function Dialog(props: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

const CONTROL = 'button, a[href], select, [role="checkbox"], [role="radio"], [role="option"], [role="combobox"], [role="switch"], [role="menuitem"]';
const SINGLE_LINE = new Set(["text", "search", "email", "number", "tel", "url", "password", "date", "month"]);

function focusKind(el: Element): DialogFocus {
  if (el instanceof HTMLTextAreaElement || (el instanceof HTMLElement && el.isContentEditable)) return "multiline";
  if (el instanceof HTMLInputElement) {
    if (!SINGLE_LINE.has(el.type)) return "control";
    return el.form ? "form" : "field";
  }
  return el.closest(CONTROL) ? "control" : "none";
}

/**
 * The dialog's OK button: its form's submit button, or else its last solid
 * button (variants default and destructive; Cancel buttons are ghost or
 * outline). Null when there is none or it is disabled.
 */
function okButton(popup: HTMLElement): HTMLButtonElement | null {
  const submit = popup.querySelector<HTMLButtonElement>('button[type="submit"]:not([hidden])');
  const solid = [...popup.querySelectorAll<HTMLButtonElement>("button.bg-primary, button.bg-destructive")].at(-1);
  const ok = submit ?? solid ?? null;
  return ok && !ok.disabled ? ok : null;
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
    if (!dialogPressesOk(e.nativeEvent, focusKind(target), isMac())) return;
    e.preventDefault();
    okButton(e.currentTarget)?.click();
  };

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-[oklch(0.25_0.02_70)]/25 backdrop-blur-[2px] transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0 dark:bg-black/50" />
      <DialogPrimitive.Viewport className="fixed inset-0 z-50 flex items-center justify-center p-6">
        <DialogPrimitive.Popup
          ref={popup}
          data-slot="dialog-content"
          // A text box with autoFocus keeps focus; otherwise the card takes it,
          // so Enter means OK rather than pressing Cancel, the first button.
          initialFocus={popup}
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
