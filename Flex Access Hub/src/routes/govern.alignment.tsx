import { createFileRoute } from "@tanstack/react-router";
import { SectionCard } from "@/components/Primitives";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { alignmentItems } from "@/lib/mockData";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/govern/alignment")({
  head: () => ({
    meta: [
      { title: "Alignment — Flex" },
      { name: "description", content: "Initiative alignment across Finance and Planning." },
    ],
  }),
  component: Alignment,
});

const statusCls = {
  "on-track": "border-success/40 text-success",
  "at-risk": "border-warning/40 text-warning",
  "off-track": "border-destructive/40 text-destructive",
} as const;

function Alignment() {
  return (
    <SectionCard title="Initiative alignment" description="Finance × Planning view derived from EzTrac and dhub-rpt">
      <Table>
        <TableHeader>
          <TableRow className="border-border/60 hover:bg-transparent">
            <TableHead>Initiative</TableHead>
            <TableHead>Squad</TableHead>
            <TableHead>Finance</TableHead>
            <TableHead>Planning</TableHead>
            <TableHead className="text-right">Spend Δ</TableHead>
            <TableHead className="text-right">Capacity Δ</TableHead>
            <TableHead>Note</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {alignmentItems.map((a) => (
            <TableRow key={a.id} className="border-border/60">
              <TableCell className="font-mono text-sm">{a.initiative}</TableCell>
              <TableCell>{a.squad}</TableCell>
              <TableCell><Badge variant="outline" className={cn("text-[10px]", statusCls[a.finance])}>{a.finance}</Badge></TableCell>
              <TableCell><Badge variant="outline" className={cn("text-[10px]", statusCls[a.planning])}>{a.planning}</Badge></TableCell>
              <TableCell className={cn("text-right font-mono text-sm", a.spendDeltaPct > 5 ? "text-destructive" : a.spendDeltaPct < -5 ? "text-success" : "text-muted-foreground")}>
                {a.spendDeltaPct > 0 ? "+" : ""}{a.spendDeltaPct}%
              </TableCell>
              <TableCell className={cn("text-right font-mono text-sm", a.capacityDeltaPct > 10 ? "text-destructive" : a.capacityDeltaPct < -10 ? "text-success" : "text-muted-foreground")}>
                {a.capacityDeltaPct > 0 ? "+" : ""}{a.capacityDeltaPct}%
              </TableCell>
              <TableCell className="text-sm text-muted-foreground max-w-md">{a.note}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SectionCard>
  );
}
