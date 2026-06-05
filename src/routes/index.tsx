import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
  Line, LineChart, Legend, ReferenceLine,
} from "recharts";
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, Cpu,
  DollarSign, Sparkles, TrendingDown, Wand2,
} from "lucide-react";
import { PageHeader, KpiCard, SectionCard, SeverityDot, formatUSD, timeAgo } from "@/components/Primitives";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  cloudUsageHistory, forecastData, kpis as mockKpis,
} from "@/lib/mockData";
import { useStore } from "@/lib/store";
import { useKpis, useKpiTrend, useCloudUsage, useAnomalies, useSavings } from "@/lib/hooks";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Flex" },
      { name: "description", content: "Spend, utilization, anomalies and savings at a glance." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data: kpis = mockKpis } = useKpis();
  const { data: trendData = forecastData } = useKpiTrend();
  const { data: usageData = cloudUsageHistory } = useCloudUsage();
  const { data: anomalies = [] } = useAnomalies();
  const { data: savings = [] } = useSavings();
  const requests = useStore((s) => s.dataRequests);

  const openAnomalies = anomalies.filter((a) => a.status !== "resolved");
  const pendingApprovals = requests.filter((r) => r.status === "pending");
  const identifiedSavings = savings.filter((s) => s.stage !== "realized").reduce((n, s) => n + s.monthlySavings, 0);
  const realizedSavings = savings.filter((s) => s.stage === "realized").reduce((n, s) => n + s.monthlySavings, 0);

  return (
    <div className="px-6 lg:px-10 py-8 max-w-[1400px] mx-auto space-y-8">
      <PageHeader
        eyebrow="Overview · May 2026"
        title="FinOps command center"
        description="Live spend, utilization, anomalies and savings across all cloud accounts."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => toast.success("Export started — finopskpi.csv")}>
              Export
            </Button>
            <Button size="sm" asChild>
              <Link to="/assistant"><Sparkles className="h-4 w-4" />Ask AI</Link>
            </Button>
          </>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Monthly spend"
          value={formatUSD(kpis.totalSpend)}
          sub={<span className="flex items-center gap-1"><ArrowDownRight className="h-3.5 w-3.5" />{kpis.spendChange}% vs prior</span>}
          tone="good"
          icon={DollarSign}
        />
        <KpiCard
          label="Utilization"
          value={`${kpis.utilization}%`}
          sub="Across 1,247 resources"
          icon={Cpu}
        />
        <KpiCard
          label="Open anomalies"
          value={openAnomalies.length}
          sub={openAnomalies.filter((a) => a.severity === "critical").length + " critical"}
          tone={openAnomalies.filter((a) => a.severity === "critical").length > 0 ? "bad" : "default"}
          icon={AlertTriangle}
        />
        <KpiCard
          label="Savings identified"
          value={formatUSD(identifiedSavings, { compact: true }) + "/mo"}
          sub={<span className="flex items-center gap-1 text-success"><CheckCircle2 className="h-3.5 w-3.5" />{formatUSD(realizedSavings, { compact: true })} realized</span>}
          tone="good"
          icon={Wand2}
        />
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-3 gap-4">
        <SectionCard title="Spend vs forecast vs budget" description="Last 6 months — projection to Jul" className="lg:col-span-2">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ left: -10, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.30 0.025 250 / 0.4)" />
                <XAxis dataKey="month" stroke="oklch(0.70 0.025 250)" fontSize={11} />
                <YAxis stroke="oklch(0.70 0.025 250)" fontSize={11} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: "oklch(0.21 0.02 250)", border: "1px solid oklch(0.30 0.025 250)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => v ? formatUSD(v) : "—"}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine y={290000} stroke="oklch(0.82 0.16 75 / 0.5)" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="budget" stroke="oklch(0.70 0.025 250)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                <Line type="monotone" dataKey="forecast" stroke="oklch(0.82 0.16 75)" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="actual" stroke="oklch(0.78 0.14 215)" strokeWidth={2.5} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Approvals queue" description={`${pendingApprovals.length} pending`}>
          {pendingApprovals.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              All caught up 🎯
            </div>
          ) : (
            <ul className="space-y-3">
              {pendingApprovals.slice(0, 4).map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-2 pb-3 border-b border-border/40 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{r.dataset}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">
                      from <span className="font-mono">{r.fromApp}</span> · {timeAgo(r.requestedAt)}
                    </div>
                  </div>
                  <Badge variant="outline" className="border-warning/40 text-warning text-[10px]">pending</Badge>
                </li>
              ))}
            </ul>
          )}
          <Button asChild variant="outline" size="sm" className="w-full mt-4">
            <Link to="/govern/exchange">Open exchange</Link>
          </Button>
        </SectionCard>
      </div>

      {/* Usage + needs attention */}
      <div className="grid lg:grid-cols-3 gap-4">
        <SectionCard title="Cloud usage by service" description="Stacked monthly $K" className="lg:col-span-2">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={usageData} margin={{ left: -10, right: 8, top: 8 }}>
                <defs>
                  {["compute","storage","network","database"].map((k, i) => (
                    <linearGradient key={k} id={`g-${k}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={`oklch(var(--chart-${i+1}))`} stopOpacity={0.5} />
                      <stop offset="100%" stopColor={`oklch(var(--chart-${i+1}))`} stopOpacity={0.05} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.30 0.025 250 / 0.4)" />
                <XAxis dataKey="date" stroke="oklch(0.70 0.025 250)" fontSize={11} />
                <YAxis stroke="oklch(0.70 0.025 250)" fontSize={11} tickFormatter={(v) => `$${v}k`} />
                <Tooltip
                  contentStyle={{ background: "oklch(0.21 0.02 250)", border: "1px solid oklch(0.30 0.025 250)", borderRadius: 8, fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="compute" stackId="1" stroke="var(--color-chart-1)" fill="url(#g-compute)" />
                <Area type="monotone" dataKey="storage" stackId="1" stroke="var(--color-chart-2)" fill="url(#g-storage)" />
                <Area type="monotone" dataKey="network" stackId="1" stroke="var(--color-chart-3)" fill="url(#g-network)" />
                <Area type="monotone" dataKey="database" stackId="1" stroke="var(--color-chart-4)" fill="url(#g-database)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Needs attention" actions={<Link to="/anomalies" className="text-xs text-primary hover:underline">View all</Link>}>
          <ul className="space-y-3">
            {openAnomalies.slice(0, 4).map((a) => (
              <li key={a.id} className="flex items-start gap-3 pb-3 border-b border-border/40 last:border-0 last:pb-0">
                <SeverityDot severity={a.severity} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{a.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                    <span className="font-mono">{a.service}</span>
                    <span>·</span>
                    <span className="truncate">{a.impact}</span>
                  </div>
                </div>
                {a.deltaPercent !== 0 && (
                  <span className={`text-xs font-medium flex items-center gap-0.5 ${a.deltaPercent > 0 ? "text-destructive" : "text-success"}`}>
                    {a.deltaPercent > 0 ? <ArrowUpRight className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {Math.abs(a.deltaPercent)}%
                  </span>
                )}
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      {/* Savings pipeline */}
      <SectionCard title="Savings pipeline" description="Identified → Approved → Implementing → Realized" actions={<Link to="/optimization" className="text-xs text-primary hover:underline">Open optimization</Link>}>
        <div className="grid sm:grid-cols-4 gap-4">
          {(["identified","approved","implementing","realized"] as const).map((stage) => {
            const items = savings.filter((s) => s.stage === stage);
            const total = items.reduce((n, s) => n + s.monthlySavings, 0);
            const pct = Math.min(100, (total / Math.max(1, identifiedSavings + realizedSavings)) * 100);
            return (
              <div key={stage}>
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">{stage}</span>
                  <span className="text-xs text-muted-foreground">{items.length}</span>
                </div>
                <div className="font-display text-2xl font-bold">{formatUSD(total, { compact: true })}</div>
                <Progress value={pct} className="h-1.5 mt-2" />
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}
