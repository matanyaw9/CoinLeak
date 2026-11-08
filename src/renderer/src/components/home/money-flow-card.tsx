// "Where the money went": the month as a Sankey, from core's balanced nodes
// and links (spec 14). Income on the left, categories, savings and what was
// left on the right. Hover shows amounts and share of income; clicking a
// category opens its transactions.

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { ResponsiveContainer, Sankey, type SankeyLinkProps as LinkProps, type SankeyNodeProps as NodeProps } from "recharts";
import type { MoneyFlow, MoneyFlowNode } from "@shared/types";
import { s } from "@/strings";
import { colorOf, OTHER_COLOR, UNCATEGORIZED_COLOR, type CategoryIndex, type Slice } from "@/lib/categories";
import { ils, percent } from "@/lib/format";
import { useShot } from "@/lib/shot";
import { Card, CardHeader } from "@/components/common/card";
import { EmptyState } from "@/components/common/empty-state";
import { ChartTooltip } from "@/components/charts/chart-tooltip";

const HUB_COLOR = "var(--muted-foreground)";
const LEFT_COLOR = "var(--status-on-track)";

interface Item {
  node: MoneyFlowNode;
  name: string;
  color: string;
  /** Set when clicking opens that category's transactions. */
  slice?: Slice;
}

function describe(index: CategoryIndex, flow: MoneyFlow): Item[] {
  const mixed = flow.nodes.some((n) => n.kind === "refund" || n.kind === "from_savings");
  return flow.nodes.map((node) => {
    const c = node.categoryId == null ? null : (index.byId.get(node.categoryId) ?? null);
    const label = c ? `${c.emoji ? `${c.emoji} ` : ""}${c.name}` : null;
    const slice = (name: string): Slice => ({
      key: node.categoryId == null ? "none" : String(node.categoryId),
      categoryId: node.categoryId,
      name,
      emoji: c?.emoji ?? null,
      color: colorOf(c),
      amount: node.amount,
    });
    switch (node.kind) {
      case "income": {
        const name = label ?? s.flow.otherIncome;
        return { node, name, color: colorOf(c), slice: slice(name) };
      }
      case "refund": {
        const name = s.flow.refunds(label ?? s.common.uncategorized);
        return { node, name, color: colorOf(c), slice: slice(name) };
      }
      case "spending":
      case "transfer": {
        const name = label ?? s.common.uncategorized;
        return { node, name, color: c ? colorOf(c) : UNCATEGORIZED_COLOR, slice: slice(name) };
      }
      case "from_savings":
        return { node, name: s.flow.fromSavings, color: OTHER_COLOR };
      case "hub":
        return { node, name: mixed ? s.flow.moneyIn : s.flow.income, color: HUB_COLOR };
      case "left":
        return { node, name: s.flow.left, color: LEFT_COLOR };
    }
  });
}

/** The hovered node (a link counts as its outer node), where the pointer is, and which way the tooltip opens. */
type Hover = { index: number; x: number; y: number; flip: boolean };

export function MoneyFlowCard({
  flow,
  index,
  onOpen,
}: {
  flow: MoneyFlow;
  index: CategoryIndex;
  onOpen: (slice: Slice) => void;
}) {
  const items = describe(index, flow);
  const hub = flow.nodes.findIndex((n) => n.kind === "hub");
  // Demo screenshots: `?shot=flow` scrolls here, `?shot=flow-hover` also hovers the first category.
  const shot = useShot();
  const [hover, setHover] = useState<Hover | null>(() =>
    shot === "flow-hover" && hub >= 0 ? { index: hub + 1, x: 760, y: 70, flip: true } : null,
  );
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (shot?.startsWith("flow")) box.current?.scrollIntoView({ block: "center" });
  }, [shot]);
  const empty = flow.income <= 0 || flow.spending <= 0 || hub < 0;

  // A link stands for its outer end; the hub is in every link.
  const outer = (link: number): number => {
    const l = flow.links[link];
    return l ? (l.source === hub ? l.target : l.source) : -1;
  };
  const hovered = hover ? items[hover.index] : undefined;
  const at = (e: MouseEvent<SVGGraphicsElement>, i: number) => {
    const r = (e.currentTarget.ownerSVGElement ?? e.currentTarget).getBoundingClientRect();
    const x = e.clientX - r.left;
    setHover({ index: i, x, y: e.clientY - r.top, flip: x > r.width / 2 });
  };

  const node = (p: NodeProps) => {
    const item = items[p.index];
    if (!item) return null;
    const side = p.index < hub ? "start" : p.index > hub ? "end" : "hub";
    const dim = hover && hover.index !== p.index && hover.index !== hub && p.index !== hub;
    const tx = side === "start" ? p.x - 10 : side === "end" ? p.x + p.width + 10 : p.x + p.width / 2;
    const ty = side === "hub" ? p.y - 10 : p.y + p.height / 2;
    return (
      <g
        className={item.slice ? "cursor-pointer" : undefined}
        opacity={dim ? 0.45 : 1}
        onMouseMove={(e) => at(e, p.index)}
        onMouseLeave={() => setHover(null)}
        onClick={() => item.slice && onOpen(item.slice)}
      >
        <rect x={p.x} y={p.y} width={p.width} height={Math.max(p.height, 1)} rx={3} fill={item.color} />
        <text
          x={tx}
          y={ty}
          textAnchor={side === "start" ? "end" : side === "end" ? "start" : "middle"}
          dominantBaseline="middle"
          className="fill-foreground text-[13px]"
        >
          {item.name}
          <tspan dx={8} className="num fill-muted-foreground text-[12px]">
            {ils(item.node.amount, { decimals: false })}
          </tspan>
        </text>
      </g>
    );
  };

  const link = (p: LinkProps) => {
    const end = outer(p.index);
    const item = items[end];
    const active = hover?.index === end;
    return (
      <path
        d={`M${p.sourceX},${p.sourceY}C${p.sourceControlX},${p.sourceY} ${p.targetControlX},${p.targetY} ${p.targetX},${p.targetY}`}
        fill="none"
        stroke={item?.color ?? HUB_COLOR}
        strokeWidth={Math.max(p.linkWidth, 1)}
        strokeOpacity={active ? 0.55 : hover ? 0.14 : 0.3}
        className={item?.slice ? "cursor-pointer transition-[stroke-opacity]" : "transition-[stroke-opacity]"}
        onMouseMove={(e) => at(e, end)}
        onMouseLeave={() => setHover(null)}
        onClick={() => item?.slice && onOpen(item.slice)}
      />
    );
  };

  return (
    <Card>
      <CardHeader label={s.flow.title} action={empty ? undefined : s.flow.hint} />
      {empty ? (
        <EmptyState compact title={s.flow.empty} />
      ) : (
        <div ref={box} className="relative h-[360px]" data-testid="money-flow">
          <ResponsiveContainer width="100%" height="100%">
            <Sankey
              data={{
                nodes: items.map((x) => ({ name: x.name })),
                links: flow.links.map((l) => ({ source: l.source, target: l.target, value: l.amount })),
              }}
              sort={false}
              nodeWidth={10}
              nodePadding={22}
              linkCurvature={0.5}
              iterations={0}
              margin={{ top: 28, right: 230, bottom: 8, left: 230 }}
              node={node}
              link={link}
            />
          </ResponsiveContainer>
          {hovered && hover && (
            <div
              className="pointer-events-none absolute z-10"
              // Opens toward the middle, so it never spills out of the card.
              style={{
                left: hover.x,
                top: hover.y + 14,
                transform: hover.flip ? "translateX(calc(-100% - 14px))" : "translateX(14px)",
              }}
            >
              <ChartTooltip
                title={hovered.name}
                rows={[
                  {
                    key: "amount",
                    label: flow.income > 0 ? `${percent(hovered.node.amount, flow.income)} ${s.flow.shareOfIncome}` : s.flow.noIncome,
                    amount: hovered.node.amount,
                    color: hovered.color,
                    strong: true,
                  },
                ]}
              />
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
