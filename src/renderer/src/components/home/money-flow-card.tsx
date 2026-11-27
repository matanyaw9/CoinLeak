// "Where the money went": the period as a Sankey, from core's balanced nodes
// and links (specs 14 and 16). Income on the left, categories, savings and
// what was left on the right; spending beyond income is its own warning node.
// Clicking a category that holds others opens it one level down (spec 34,
// down to level 3, with Back one level up and, two levels in, Show all to the
// top, spec 43); its own rows show as "Other in <name>". Clicking any other
// category opens its transactions. Enter does the same as a click (spec 45).

import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { GroupFlow, MoneyFlowNode, PeriodFlow } from "@shared/types";
import { s } from "@/strings";
import { colorOf, OTHER_COLOR, pathOf, UNCATEGORIZED_COLOR, type CategoryIndex, type Slice } from "@/lib/categories";
import { usePeriod } from "@/lib/month-context";
import { useShot } from "@/lib/shot";
import { Card, CardHeader } from "@/components/common/card";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { FlowSankey, type FlowItem, type FlowPick } from "./flow-sankey";
import { useGroupFlow } from "./period-data";

const HUB_COLOR = "var(--muted-foreground)";
const LEFT_COLOR = "var(--status-on-track)";
/** The same warning color as the hero's "more than you earned". */
export const BEYOND_COLOR = "var(--status-over)";

/** `opened` is the category shown one level down, when there is one. */
function describe(index: CategoryIndex, nodes: MoneyFlowNode[], opened?: { id: number; name: string }): FlowItem[] {
  const groupName = opened?.name;
  const mixed = nodes.some((n) => n.kind === "refund" || n.kind === "from_savings" || n.kind === "beyond_income");
  return nodes.map((node) => {
    const c = node.categoryId == null ? null : (index.byId.get(node.categoryId) ?? null);
    const parent = c?.parentId != null ? index.byId.get(c.parentId) : undefined;
    const color = c ? (c.color ?? (parent ? colorOf(parent) : colorOf(c))) : UNCATEGORIZED_COLOR;
    // On the right of an opened category, its own rows are "Other in <name>".
    const own = opened !== undefined && node.kind === "spending" && node.categoryId === opened.id;
    const label = c ? `${c.emoji ? `${c.emoji} ` : ""}${own ? s.nested.otherIn(c.name) : c.name}` : null;
    const slice = (name: string): Slice => ({
      key: node.categoryId == null ? "none" : String(node.categoryId),
      categoryId: node.categoryId,
      name,
      emoji: c?.emoji ?? null,
      color,
      amount: node.amount,
    });
    switch (node.kind) {
      case "income": {
        const name = label ?? s.flow.otherIncome;
        return { node, name, color, slice: slice(name) };
      }
      case "refund": {
        const name = s.flow.refunds(label ?? s.common.uncategorized);
        return { node, name, color, slice: slice(name) };
      }
      case "spending":
      case "transfer":
      case "group": {
        const name = label ?? s.common.uncategorized;
        const drill = node.kind === "spending" && !own && c != null && (index.children.get(c.id)?.length ?? 0) > 0;
        return { node, name, color, slice: slice(name), drill };
      }
      case "from_savings":
        return { node, name: s.periodHome.flowFromSavings, color: OTHER_COLOR };
      case "beyond_income":
        return { node, name: s.periodHome.flowBeyond, color: BEYOND_COLOR, warn: true };
      case "hub":
        return { node, name: groupName ?? (mixed ? s.flow.moneyIn : s.flow.income), color: HUB_COLOR };
      case "left":
        return { node, name: s.flow.left, color: LEFT_COLOR };
    }
  });
}

export function MoneyFlowCard({
  flow,
  index,
  onOpen,
}: {
  flow: PeriodFlow;
  index: CategoryIndex;
  onOpen: (slice: Slice) => void;
}) {
  const { range } = usePeriod();
  const shot = useShot();
  // The categories opened, top level first (spec 34): Back goes up one, Show all to the top.
  const [path, setPath] = useState<number[]>(() => demoPath(shot, flow, index));
  // The level last opened came from the keyboard, so its chart takes the focus.
  const [byKeys, setByKeys] = useState(false);
  const go = (next: number[], fromKeys = false) => {
    setByKeys(fromKeys);
    setPath(next);
  };
  const pick = (what: FlowPick, fromKeys: boolean) => {
    if ("drill" in what) go([...path, what.drill], fromKeys);
    else onOpen(what.open);
  };
  const group = path.at(-1) ?? null;
  const opened = useGroupFlow(range, group);
  const box = useRef<HTMLDivElement>(null);
  // Demo screenshots: `?shot=flow...` and `?shot=overspent-flow` scroll here.
  useEffect(() => {
    if (shot?.startsWith("flow") || shot === "overspent-flow") box.current?.scrollIntoView({ block: "center" });
  }, [shot]);
  // A new period closes the group: its numbers belong to the old one.
  const rangeKey = `${range.from}:${range.to}`;
  const [seen, setSeen] = useState(rangeKey);
  if (seen !== rangeKey) {
    setSeen(rangeKey);
    if (!shot?.startsWith("flow-")) setPath([]);
  }

  const groupCat = group != null ? index.byId.get(group) : undefined;
  const upCat = path.length > 1 ? index.byId.get(path.at(-2) as number) : undefined;
  const empty = flow.nodes.length === 0;

  return (
    <div ref={box}>
      <Card>
        {group != null && groupCat ? (
          <>
            <CardHeader
              label={s.periodHome.flowGroupTitle(pathOf(index, groupCat))}
              action={
                <span className="flex items-center gap-2">
                  <Button variant="outline" className="h-8 rounded-xl px-3" onClick={() => go(path.slice(0, -1))}>
                    <ArrowLeft />
                    {upCat ? s.nested.flowUp(upCat.name) : s.periodHome.flowBack}
                  </Button>
                  {/* One level in, Back already goes to the top. */}
                  {path.length > 1 && (
                    <Button variant="ghost" className="h-8 rounded-xl px-2.5" title={s.showAll.flowHint} onClick={() => go([])}>
                      {s.showAll.button}
                    </Button>
                  )}
                </span>
              }
            />
            {/* Keyed, so each level is a fresh chart with its own focus. */}
            <GroupBody
              key={groupCat.id}
              flow={opened.data}
              index={index}
              opened={{ id: groupCat.id, name: groupCat.name }}
              takeFocus={byKeys}
              onPick={pick}
            />
          </>
        ) : (
          <>
            <CardHeader label={s.flow.title} action={empty ? undefined : `${s.periodHome.flowGroupHint} · ${s.flow.hint}`} />
            {empty ? (
              <EmptyState compact title={s.flow.empty} />
            ) : (
              <FlowSankey
                items={describe(index, flow.nodes)}
                links={flow.links}
                share={{ of: flow.income, label: flow.income > 0 ? s.flow.shareOfIncome : s.periodHome.noIncome }}
                hoverFirst={shot === "flow-hover"}                onPick={pick}
              />
            )}
          </>
        )}
      </Card>
    </div>
  );
}

function GroupBody({
  flow,
  index,
  opened,
  takeFocus,
  onPick,
}: {
  flow: GroupFlow | undefined;
  index: CategoryIndex;
  opened: { id: number; name: string };
  takeFocus: boolean;
  onPick: (what: FlowPick, byKeys: boolean) => void;
}) {
  if (!flow) return <div className="h-[360px]" />;
  if (flow.nodes.length === 0) return <EmptyState compact title={s.periodHome.flowGroupEmpty} />;
  return (
    <FlowSankey
      items={describe(index, flow.nodes, opened)}
      links={flow.links}
      share={{ of: flow.total, label: s.periodHome.flowShareOfGroup(opened.name) }}
      takeFocus={takeFocus}
      onPick={onPick}
    />
  );
}

/**
 * Demo screenshots: `?shot=flow-group` opens the first spending category that
 * holds others; `?shot=flow-deep` goes on into its first child that holds
 * others too (level 3 on the right).
 */
function demoPath(shot: string | null, flow: PeriodFlow, index: CategoryIndex): number[] {
  if (shot !== "flow-group" && shot !== "flow-deep") return [];
  const holds = (id: number) => (index.children.get(id)?.length ?? 0) > 0;
  const tops = flow.nodes.filter((n) => n.kind === "spending" && n.categoryId != null).map((n) => n.categoryId as number);
  if (shot === "flow-group") {
    const first = tops.find(holds);
    return first === undefined ? [] : [first];
  }
  for (const top of tops) {
    const child = (index.children.get(top) ?? []).find((c) => holds(c.id));
    if (child) return [top, child.id];
  }
  return [];
}
