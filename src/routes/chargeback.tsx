import { createFileRoute } from "@tanstack/react-router";
import { ArrowDownRight, ArrowUpRight, Download, Minus } from "lucide-react";
import { PageHeader, SectionCard, formatUSD } from "@/components/Primitives";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useChargeback } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/chargeback")({
  head: () => ({
    meta: [
      { title: "Chargeback — Flex" },
      { name: "description", content: "Team chargeback & showback with budget vs forecast." },
    ],
  }),
  component: Chargeback,
});

function Chargeback() {
  const { data: chargebackRows = [] } = useChargeback();
  const totalSpend = chargebackRows.reduce((n, r) => n + r.monthlySpend, 0);
  const totalBudget = chargebackRows.reduce((n, r) => n + r.budget, 0);
  const overBudget = chargebackRows.filter((r) => r.monthlySpend > r.budget);

  return (
    <div className="px-6 lg:px-10 py-8 max-w-[1400px] mx-auto space-y-8">
      <PageHeader
        eyebrow="Organization"
        title="Chargeback & showback"
        description="Team-level accountability — spend vs budget, cost per engineer, tag compliance."
        actions={
          <Button variant="outline" size="sm" onClick={() => toast.success("Chargeback report exported")}>
            <Download className="h-4 w-4" />Export
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-elev">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total spend</div>
          <div className="mt-1 font-display text-2xl font-bold">{formatUSD(totalSpend, { compact: true })}</div>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-elev">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total budget</div>
          <div className="mt-1 font-display text-2xl font-bold">{formatUSD(totalBudget, { compact: true })}</div>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-elev">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Over budget</div>
          <div className="mt-1 font-display text-2xl font-bold text-destructive">{overBudget.length}</div>
          <div className="text-xs text-muted-foreground mt-0.5">teams</div>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-elev">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Avg tag compliance</div>
          <div className="mt-1 font-display text-2xl font-bold">
            {(chargebackRows.reduce((n, r) => n + r.tagCompliance, 0) / chargebackRows.length).toFixed(0)}%
          </div>
        </div>
      </div>

      <SectionCard title="Team breakdown">
        <Table>
          <TableHeader>
            <TableRow className="border-border/60 hover:bg-transparent">
              <TableHead>Team / Initiative</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead className="text-right">Spend</TableHead>
              <TableHead className="text-right">Budget</TableHead>
              <TableHead className="text-right">Variance</TableHead>
              <TableHead className="text-right">$/Engineer</TableHead>
              <TableHead className="text-right">Tags</TableHead>
              <TableHead className="text-right">Trend</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {chargebackRows.map((r) => {
              const variance = ((r.monthlySpend - r.budget) / r.budget) * 100;
              return (
                <TableRow key={r.id} className="border-border/60">
                  <TableCell>
                    <div className="font-medium">{r.team}</div>
                    <div className="text-xs text-muted-foreground font-mono mt-0.5">{r.costCenter} · {r.initiative}</div>
                  </TableCell>
                  <TableCell className="text-sm">{r.owner}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{formatUSD(r.monthlySpend)}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-muted-foreground">{formatUSD(r.budget)}</TableCell>
                  <TableCell className={cn(
                    "text-right font-mono text-sm",
                    variance > 5 ? "text-destructive" : variance < -5 ? "text-success" : "text-muted-foreground",
                  )}>
                    {variance > 0 ? "+" : ""}{variance.toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">{formatUSD(r.costPerEngineer)}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline" className={cn(
                      "text-[10px] font-mono",
                      r.tagCompliance >= 95 && "border-success/40 text-success",
                      r.tagCompliance >= 80 && r.tagCompliance < 95 && "border-warning/40 text-warning",
                      r.tagCompliance < 80 && "border-destructive/40 text-destructive",
                    )}>
                      {r.tagCompliance}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {r.trend === "up" && <ArrowUpRight className="inline h-4 w-4 text-warning" />}
                    {r.trend === "down" && <ArrowDownRight className="inline h-4 w-4 text-success" />}
                    {r.trend === "stable" && <Minus className="inline h-4 w-4 text-muted-foreground" />}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </SectionCard>
    </div>
  );
}
