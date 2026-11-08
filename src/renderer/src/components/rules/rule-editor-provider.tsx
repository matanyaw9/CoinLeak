// One rule editor for the whole window, so the Rules page, the bulk bar,
// the "make a rule" toast and a row's rule chip all open the same dialog.

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { RuleEditor, type EditorRequest } from "./rule-editor";

interface RuleEditorApi {
  openEditor: (request: EditorRequest) => void;
}

const RuleEditorContext = createContext<RuleEditorApi | null>(null);

export function RuleEditorProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<(EditorRequest & { key: number }) | null>(null);
  const [open, setOpen] = useState(false);
  const api = useMemo<RuleEditorApi>(
    () => ({
      openEditor: (r) => {
        setRequest((prev) => ({ ...r, key: (prev?.key ?? 0) + 1 }));
        setOpen(true);
      },
    }),
    [],
  );
  return (
    <RuleEditorContext.Provider value={api}>
      {children}
      {request && <RuleEditor key={request.key} request={request} open={open} onOpenChange={setOpen} />}
    </RuleEditorContext.Provider>
  );
}

export function useRuleEditor(): RuleEditorApi {
  const api = useContext(RuleEditorContext);
  if (!api) throw new Error("useRuleEditor needs RuleEditorProvider");
  return api;
}
