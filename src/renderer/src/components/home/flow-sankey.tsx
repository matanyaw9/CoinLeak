// Draws core's nodes and links as a Sankey: names left of the first column,
// right of the last, above any middle one. Hover shows one tooltip that opens
// toward the middle; a link stands for its outer end.

import { useState, type MouseEvent } from "react";
import { ResponsiveContainer, Sankey, type SankeyLinkProps as LinkProps, type SankeyNodeProps as NodeProps } from "recharts";
import type { MoneyFlowLink, MoneyFlowNode } from "@shared/types";
import type { Slice } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { ils, percent } from "@/lib/format";
import { ChartTooltip } from "@/components/charts/chart-tooltip";

export interface FlowItem {
  node: MoneyFlowNode;
  name: string;
  color: string;
  /** Set when clicking opens that category's transactions. */
  slice?: Slice;
  /** Clicking opens this group's own flow instead. */
  drill?: boolean;
  /** Drawn and named in the warning color. */
  warn?: boolean;
}

type Hover = { index: number; x: number; y: number; flip: boolean };
type Side = "start" | "middle" | "end";

export function FlowSankey({
  items,
  links,
  share,
  hoverFirst,
  onPick,
}: {
  items: FlowItem[];
  links: MoneyFlowLink[];
  /** What the tooltip's percentage is of. */
  share: { of: number; label: string };
  /** Demo screenshots: start hovering the first node on the right. */
  hoverFirst?: boolean;
  onPick: (item: FlowItem) => void;
}) {
  const sides: Side[] = items.map((_, i) => {
    const into = links.some((l) => l.target === i);
    const out = links.some((l) => l.source === i);
    return into && out ? "middle" : into ? "end" : "start";
  });
  const middle = sides.indexOf("middle");
  const [hover, setHover] = useState<Hover | null>(() => {
    const first = sides.indexOf("end");
    return hoverFirst && first >= 0 ? { index: first, x: 760, y: 70, flip: true } : null;
  });

  // A link stands for its end that is not in the middle.
  const outer = (link: number): number => {
    const l = links[link];
    if (!l) return -1;
    return sides[l.target] === "end" ? l.target : l.source;
  };
  const hovered = hover ? items[hover.index] : undefined;
  const at = (e: MouseEvent<SVGGraphicsElement>, i: number) => {
    const r = (e.currentTarget.ownerSVGElement ?? e.currentTarget).getBoundingClientRect();
    const x = e.clientX - r.left;
    setHover({ index: i, x, y: e.clientY - r.top, flip: x > r.width / 2 });
  };
  const clickable = (item: FlowItem | undefined) => Boolean(item && (item.slice || item.drill));

  const node = (p: NodeProps) => {
    const item = items[p.index];
    if (!item) return null;
    const side = sides[p.index] ?? "start";
    const dim = hover && hover.index !== p.index && p.index !== middle && hover.index !== middle;
    const tx = side === "start" ? p.x - 10 : side === "end" ? p.x + p.width + 10 : p.x + p.width / 2;
    const ty = side === "middle" ? p.y - 10 : p.y + p.height / 2;
    return (
      <g
        className={clickable(item) ? "cursor-pointer" : undefined}
        opacity={dim ? 0.45 : 1}
        onMouseMove={(e) => at(e, p.index)}
        onMouseLeave={() => setHover(null)}
        onClick={() => clickable(item) && onPick(item)}
      >
        <rect x={p.x} y={p.y} width={p.width} height={Math.max(p.height, 1)} rx={3} fill={item.color} />
        <text
          x={tx}
          y={ty}
          textAnchor={side === "start" ? "end" : side === "end" ? "start" : "middle"}
          dominantBaseline="middle"
          className={cn("text-[13px]", item.warn ? "fill-status-over font-medium" : "fill-foreground", item.drill && "underline decoration-dotted underline-offset-4")}
        >
          {item.name}
          <tspan dx={8} className={cn("num text-[12px]", item.warn ? "fill-status-over" : "fill-muted-foreground")}>
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
        stroke={item?.color ?? "var(--muted-foreground)"}
        strokeWidth={Math.max(p.linkWidth, 1)}
        strokeOpacity={active ? 0.55 : hover ? 0.14 : item?.warn ? 0.4 : 0.3}
        className={clickable(item) ? "cursor-pointer transition-[stroke-opacity]" : "transition-[stroke-opacity]"}
        onMouseMove={(e) => at(e, end)}
        onMouseLeave={() => setHover(null)}
        onClick={() => item && clickable(item) && onPick(item)}
      />
    );
  };

  return (
    <div className="relative h-[360px]" data-testid="money-flow">
      <ResponsiveContainer width="100%" height="100%">
        <Sankey
          data={{
            nodes: items.map((x) => ({ name: x.name })),
            links: links.map((l) => ({ source: l.source, target: l.target, value: l.amount })),
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
                label: share.of > 0 ? `${percent(hovered.node.amount, share.of)} ${share.label}` : share.label,
                amount: hovered.node.amount,
                color: hovered.color,
                strong: true,
              },
            ]}
          />
        </div>
      )}
    </div>
  );
}
