import { createFileRoute } from "@tanstack/react-router";
import { Briefcase, TrendingUp, UserPlus, Wand2 } from "lucide-react";
import { PageHeader, SectionCard, formatUSD } from "@/components/Primitives";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { squadWorkforceRows } from "@/lib/mockData";
import type { WorkforceSignal } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/workforce")({
  head: () => ({
    meta: [
      { title: "Workforce — Flex" },
      { name: "description", content: "Squad × infrastructure alignment. HR meets FinOps." },
    ],
  }),
  component: Workforce,
});

const signalStyle: Record<WorkforceSignal, { cls: string; icon: React.ComponentType<{ className?: string }>; label: string }> = {
  hire: { cls: "border-primary/40 text-primary", icon: UserPlus, label: "Hire" },
  reallocate: { cls: "border-warning/40 text-warning", icon: TrendingUp, label: "Reallocate" },
  optimize: { cls: "border-success/40 text-success", icon: Wand2, label: "Optimize" },
  stable: { cls: "border-muted-foreground/40 text-muted-foreground", icon: Briefcase, label: "Stable" },
};

function Workforce() {
  return (
    <div className="px-6 lg:px-10 py-8 max-w-[1400px] mx-auto space-y-8">
      <PageHeader
        eyebrow="Organization"
        title="Workforce × infrastructure"
        description="Squad capacity, cloud spend per head and signals from dhub-rpt — pair people with platform."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(["hire", "reallocate", "optimize", "stable"] as WorkforceSignal[]).map((sig) => {
          const items = squadWorkforceRows.filter((r) => r.signal === sig);
          const S = signalStyle[sig];
          return (
            <div key={sig} className="rounded-xl border border-border/60 bg-card p-4 shadow-elev">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                <span>{S.label}</span>
                <S.icon className={cn("h-3.5 w-3.5", S.cls.split(" ")[1])} />
              </div>
              <div className="mt-1 font-display text-2xl font-bold">{items.length}</div>
              <div className="text-xs text-muted-foreground mt-0.5">squads</div>
            </div>
          );
        })}
      </div>

      <SectionCard title="Squad alignment">
        <Table>
          <TableHeader>
            <TableRow className="border-border/60 hover:bg-transparent">
              <TableHead>Squad</TableHead>
              <TableHead>Lead</TableHead>
              <TableHead className="text-right">Headcount</TableHead>
              <TableHead className="text-right">Capacity</TableHead>
              <TableHead className="text-right">Cloud/mo</TableHead>
              <TableHead className="text-right">$/Head</TableHead>
              <TableHead>Signal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {squadWorkforceRows.map((r) => {
              const S = signalStyle[r.signal];
              return (
                <TableRow key={r.id} className="border-border/60">
                  <TableCell>
                    <div className="font-medium">{r.squad}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 max-w-md">{r.signalReason}</div>
                  </TableCell>
                  <TableCell className="text-sm">{r.platformLead}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{r.headcount}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div
                          className={cn(
                            "h-full",
                            r.capacityUsedPct > 100 ? "bg-destructive" : r.capacityUsedPct > 90 ? "bg-warning" : "bg-success",
                          )}
                          style={{ width: `${Math.min(100, r.capacityUsedPct)}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs w-10 text-right">{r.capacityUsedPct}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">{formatUSD(r.cloudCostMonthly, { compact: true })}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{formatUSD(r.costPerHead)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("gap-1 text-[10px]", S.cls)}>
                      <S.icon className="h-3 w-3" />{S.label}
                    </Badge>
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
