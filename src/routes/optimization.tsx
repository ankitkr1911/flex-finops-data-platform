import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Clock, Wand2, Zap } from "lucide-react";
import { PageHeader, SectionCard, formatUSD } from "@/components/Primitives";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { store, useStore } from "@/lib/store";
import type { SavingsOpportunity, SavingsStage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/optimization")({
  head: () => ({
    meta: [
      { title: "Optimization — Flex" },
      { name: "description", content: "Savings opportunities pipeline — identified through realized." },
    ],
  }),
  component: Optimization,
});

const STAGES: SavingsStage[] = ["identified", "approved", "implementing", "realized"];

const stageStyle: Record<SavingsStage, string> = {
  identified: "border-muted-foreground/30 text-muted-foreground",
  approved: "border-primary/40 text-primary",
  implementing: "border-warning/40 text-warning",
  realized: "border-success/40 text-success",
};

function Optimization() {
  const savings = useStore((s) => s.savings);
  const [q, setQ] = useState("");

  const filtered = useMemo(
    () => savings.filter((s) => s.title.toLowerCase().includes(q.toLowerCase())),
    [savings, q],
  );

  const total = savings.reduce((n, s) => n + s.monthlySavings, 0);
  const realized = savings.filter((s) => s.stage === "realized").reduce((n, s) => n + s.monthlySavings, 0);

  return (
    <div className="px-6 lg:px-10 py-8 max-w-[1400px] mx-auto space-y-8">
      <PageHeader
        eyebrow="Cloud & cost"
        title="Optimization"
        description="Cost savings pipeline across rightsizing, storage, compute and commitments."
        actions={
          <>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Realized / Total</div>
              <div className="font-display text-lg font-bold">
                {formatUSD(realized, { compact: true })} <span className="text-muted-foreground text-sm">/ {formatUSD(total, { compact: true })}</span>
              </div>
            </div>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {STAGES.map((stage) => {
          const items = savings.filter((s) => s.stage === stage);
          const sum = items.reduce((n, s) => n + s.monthlySavings, 0);
          return (
            <div key={stage} className="rounded-xl border border-border/60 bg-card p-4 shadow-elev">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{stage}</div>
              <div className="mt-1 font-display text-2xl font-bold">{formatUSD(sum, { compact: true })}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{items.length} item{items.length !== 1 ? "s" : ""} · /mo</div>
            </div>
          );
        })}
      </div>

      <SectionCard
        title="Opportunities"
        actions={
          <Input
            placeholder="Search…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-56 h-8 text-sm"
          />
        }
      >
        <ul className="divide-y divide-border/60">
          {filtered.map((s) => (
            <OpportunityRow key={s.id} s={s} />
          ))}
          {filtered.length === 0 && (
            <li className="py-12 text-center text-sm text-muted-foreground">No opportunities match.</li>
          )}
        </ul>
      </SectionCard>
    </div>
  );
}

function OpportunityRow({ s }: { s: SavingsOpportunity }) {
  const next: Record<SavingsStage, SavingsStage | null> = {
    identified: "approved",
    approved: "implementing",
    implementing: "realized",
    realized: null,
  };
  const canAdvance = next[s.stage] !== null;
  return (
    <li className="py-4 grid grid-cols-12 gap-4 items-center">
      <div className="col-span-12 sm:col-span-5">
        <div className="font-medium">{s.title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{s.action}</div>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="font-mono text-[10px]">{s.category}</Badge>
          <Badge variant="outline" className={cn("text-[10px]", stageStyle[s.stage])}>{s.stage}</Badge>
          <span className="text-xs text-muted-foreground">Owner · {s.owner}</span>
        </div>
      </div>
      <div className="col-span-6 sm:col-span-2 text-left sm:text-right">
        <div className="font-display text-lg font-bold">{formatUSD(s.monthlySavings, { compact: true })}</div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">/ month</div>
      </div>
      <div className="col-span-6 sm:col-span-2 text-left sm:text-center">
        <div className="text-xs text-muted-foreground">Confidence</div>
        <div className="font-mono text-sm">{s.confidence}%</div>
      </div>
      <div className="col-span-6 sm:col-span-1 text-left sm:text-center">
        <Badge variant="outline" className={cn(
          "text-[10px]",
          s.effort === "low" && "border-success/40 text-success",
          s.effort === "medium" && "border-warning/40 text-warning",
          s.effort === "high" && "border-destructive/40 text-destructive",
        )}>
          {s.effort}
        </Badge>
      </div>
      <div className="col-span-6 sm:col-span-2 flex justify-end">
        {s.stage === "realized" ? (
          <Badge className="bg-success/15 text-success border-success/40 gap-1"><CheckCircle2 className="h-3 w-3" />Realized</Badge>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={!canAdvance}
            onClick={() => {
              store.advanceSavingsStage(s.id);
              toast.success(`Moved to ${next[s.stage]}`);
            }}
          >
            {s.stage === "identified" && <><Zap className="h-3.5 w-3.5" />Approve</>}
            {s.stage === "approved" && <><Clock className="h-3.5 w-3.5" />Start</>}
            {s.stage === "implementing" && <><Wand2 className="h-3.5 w-3.5" />Realize</>}
            <ArrowRight className="h-3 w-3" />
          </Button>
        )}
      </div>
    </li>
  );
}
