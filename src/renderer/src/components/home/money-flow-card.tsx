// "Where the money went": the period as a Sankey, from core's balanced nodes
// and links (specs 14 and 16). Income on the left, categories, savings and
// what was left on the right; spending beyond income is its own warning node.
// Clicking a group opens it (its categories, with Back); clicking a category
// opens its transactions.

import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { GroupFlow, MoneyFlowNode, PeriodFlow } from "@shared/types";
import { s } from "@/strings";
import { colorOf, OTHER_COLOR, UNCATEGORIZED_COLOR, type CategoryIndex, type Slice } from "@/lib/categories";
import { usePeriod } from "@/lib/month-context";
import { useShot } from "@/lib/shot";
import { Card, CardHeader } from "@/components/common/card";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { FlowSankey, type FlowItem } from "./flow-sankey";
import { useGroupFlow } from "./period-data";

const HUB_COLOR = "var(--muted-foreground)";
const LEFT_COLOR = "var(--status-on-track)";
/** The same warning color as the hero's "more than you earned". */
export const BEYOND_COLOR = "var(--status-over)";

function describe(index: CategoryIndex, nodes: MoneyFlowNode[], groupName?: string): FlowItem[] {
  const mixed = nodes.some((n) => n.kind === "refund" || n.kind === "from_savings" || n.kind === "beyond_income");
  return nodes.map((node) => {
    const c = node.categoryId == null ? null : (index.byId.get(node.categoryId) ?? null);
    const parent = c?.parentId != null ? index.byId.get(c.parentId) : undefined;
    const color = c ? (c.color ?? (parent ? colorOf(parent) : colorOf(c))) : UNCATEGORIZED_COLOR;
    const label = c ? `${c.emoji ? `${c.emoji} ` : ""}${c.name}` : null;
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
        const drill = node.kind === "spending" && !groupName && c != null && (index.children.get(c.id)?.length ?? 0) > 0;
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
  const [group, setGroup] = useState<number | null>(() => {
    if (shot !== "flow-group") return null;
    const first = flow.nodes.find((n) => n.kind === "spending" && n.categoryId != null && index.children.has(n.categoryId));
    return first?.categoryId ?? null;
  });
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
    if (shot !== "flow-group") setGroup(null);
  }

  const groupCat = group != null ? index.byId.get(group) : undefined;
  const empty = flow.nodes.length === 0;

  return (
    <div ref={box}>
      <Card>
        {group != null && groupCat ? (
          <>
            <CardHeader
              label={s.periodHome.flowGroupTitle(groupCat.name)}
              action={
                <Button variant="outline" className="h-8 rounded-xl px-3" onClick={() => setGroup(null)}>
                  <ArrowLeft />
                  {s.periodHome.flowBack}
                </Button>
              }
            />
            <GroupBody flow={opened.data} index={index} name={groupCat.name} onOpen={onOpen} />
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
                hoverFirst={shot === "flow-hover"}
                onPick={(item) => {
                  if (item.drill && item.node.categoryId != null) setGroup(item.node.categoryId);
                  else if (item.slice) onOpen(item.slice);
                }}
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
  name,
  onOpen,
}: {
  flow: GroupFlow | undefined;
  index: CategoryIndex;
  name: string;
  onOpen: (slice: Slice) => void;
}) {
  if (!flow) return <div className="h-[360px]" />;
  if (flow.nodes.length === 0) return <EmptyState compact title={s.periodHome.flowGroupEmpty} />;
  return (
    <FlowSankey
      items={describe(index, flow.nodes, name)}
      links={flow.links}
      share={{ of: flow.total, label: s.periodHome.flowShareOfGroup(name) }}
      onPick={(item) => item.slice && onOpen(item.slice)}
    />
  );
}
