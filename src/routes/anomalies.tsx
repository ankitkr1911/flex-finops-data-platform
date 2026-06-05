import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowUpRight, CheckCircle2, Eye, TrendingDown } from "lucide-react";
import { PageHeader, SectionCard, SeverityDot, timeAgo } from "@/components/Primitives";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { store, useStore } from "@/lib/store";
import { useAnomalies, useUpdateAnomalyStatus } from "@/lib/hooks";
import type { AnomalyStatus, Severity } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/anomalies")({
  head: () => ({
    meta: [
      { title: "Anomalies — Flex" },
      { name: "description", content: "Detected anomalies across cloud accounts and services." },
    ],
  }),
  component: Anomalies,
});

const FILTERS: { label: string; value: AnomalyStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Open", value: "open" },
  { label: "Investigating", value: "investigating" },
  { label: "Resolved", value: "resolved" },
];

function Anomalies() {
  const { data: anomalies = [] } = useAnomalies();
  const requests = useStore((s) => s.dataRequests);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("all");

  const filtered = useMemo(
    () => filter === "all" ? anomalies : anomalies.filter((a) => a.status === filter),
    [anomalies, filter],
  );

  const bySeverity: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  anomalies.filter((a) => a.status !== "resolved").forEach((a) => bySeverity[a.severity]++);

  const recentPartnerSends = useMemo(
    () =>
      requests
        .filter((r) => r.fromApp === "eztrac" || r.fromApp === "dhub-rpt")
        .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())
        .slice(0, 3),
    [requests],
  );

  return (
    <div className="px-6 lg:px-10 py-8 max-w-[1400px] mx-auto space-y-8">
      <PageHeader
        eyebrow="Cloud & cost"
        title="Anomalies"
        description="Statistical detections from cost & telemetry streams. Investigate, dismiss or escalate to FinOps."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(Object.keys(bySeverity) as Severity[]).map((sev) => (
          <div key={sev} className="rounded-xl border border-border/60 bg-card p-4 shadow-elev">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
              <span>{sev}</span>
              <SeverityDot severity={sev} />
            </div>
            <div className="mt-1 font-display text-2xl font-bold">{bySeverity[sev]}</div>
          </div>
        ))}
      </div>

      {recentPartnerSends.length > 0 && (
        <SectionCard
          title="Recent partner sends"
          description="Partner updates can land as governance requests or dataset updates, not always as anomalies."
          actions={
            <Button asChild size="sm" variant="outline">
              <Link to="/govern/exchange">Open data exchange</Link>
            </Button>
          }
        >
          <ul className="divide-y divide-border/60">
            {recentPartnerSends.map((r) => (
              <li key={r.id} className="py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">from {r.fromApp}</Badge>
                    <span className="font-mono text-xs">{r.dataset}</span>
                    <Badge variant="outline" className={cn(
                      "text-[10px]",
                      r.status === "pending" && "border-warning/40 text-warning",
                      r.status === "approved" && "border-success/40 text-success",
                      r.status === "rejected" && "border-destructive/40 text-destructive",
                    )}>{r.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 truncate">{r.purpose}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{timeAgo(r.requestedAt)}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <SectionCard
        title="Detected anomalies"
        actions={
          <div className="inline-flex rounded-md border border-border/60 p-0.5 bg-secondary/40">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded transition-colors",
                  filter === f.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        }
      >
        <ul className="divide-y divide-border/60">
          {filtered.map((a) => (
            <li key={a.id} className="py-4 flex items-start gap-4">
              <div className="mt-1.5"><SeverityDot severity={a.severity} /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{a.title}</span>
                  <Badge variant="outline" className="font-mono text-[10px]">{a.service}</Badge>
                  <Badge variant="outline" className={cn(
                    "text-[10px]",
                    a.status === "open" && "border-destructive/40 text-destructive",
                    a.status === "investigating" && "border-warning/40 text-warning",
                    a.status === "resolved" && "border-success/40 text-success",
                  )}>{a.status}</Badge>
                </div>
                <div className="mt-1 text-sm text-muted-foreground">{a.impact}</div>
                <div className="mt-1.5 text-xs text-muted-foreground flex items-center gap-3">
                  <span>Detected {timeAgo(a.detectedAt)}</span>
                  {a.deltaPercent !== 0 && (
                    <span className={cn(
                      "flex items-center gap-0.5 font-medium",
                      a.deltaPercent > 0 ? "text-destructive" : "text-success",
                    )}>
                      {a.deltaPercent > 0 ? <ArrowUpRight className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {Math.abs(a.deltaPercent)}%
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                {a.status === "open" && (
                  <Button size="sm" variant="outline" onClick={() => { store.setAnomalyStatus(a.id, "investigating"); toast.success("Marked as investigating"); }}>
                    <Eye className="h-3.5 w-3.5" />Investigate
                  </Button>
                )}
                {a.status !== "resolved" && (
                  <Button size="sm" onClick={() => { store.setAnomalyStatus(a.id, "resolved"); toast.success("Anomaly resolved"); }}>
                    <CheckCircle2 className="h-3.5 w-3.5" />Resolve
                  </Button>
                )}
                {a.status === "resolved" && (
                  <Button size="sm" variant="outline" onClick={() => { store.setAnomalyStatus(a.id, "open"); toast.message("Re-opened"); }}>
                    Reopen
                  </Button>
                )}
              </div>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="py-12 text-center text-sm text-muted-foreground">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-40" />
              No anomalies match this filter.
            </li>
          )}
        </ul>
      </SectionCard>
    </div>
  );
}
