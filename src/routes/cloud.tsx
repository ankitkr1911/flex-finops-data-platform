import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { PageHeader, SectionCard, formatUSD } from "@/components/Primitives";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cloudUsageHistory, resourceAllocations } from "@/lib/mockData";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/cloud")({
  head: () => ({
    meta: [
      { title: "Cloud usage — Flex" },
      { name: "description", content: "Cloud usage and resource allocation across teams." },
    ],
  }),
  component: CloudUsage,
});

const RANGES = ["1M", "3M", "6M", "12M"] as const;

function CloudUsage() {
  const [range, setRange] = useState<(typeof RANGES)[number]>("6M");

  const filtered = useMemo(() => {
    const n = range === "1M" ? 1 : range === "3M" ? 3 : range === "6M" ? 6 : cloudUsageHistory.length;
    return cloudUsageHistory.slice(-n);
  }, [range]);

  const serviceTotals = useMemo(() => {
    const last = filtered[filtered.length - 1];
    return [
      { service: "Compute", value: last.compute },
      { service: "Database", value: last.database },
      { service: "Storage", value: last.storage },
      { service: "Network", value: last.network },
    ];
  }, [filtered]);

  return (
    <div className="px-6 lg:px-10 py-8 max-w-[1400px] mx-auto space-y-8">
      <PageHeader
        eyebrow="Cloud & cost"
        title="Cloud usage"
        description="Telemetry across AWS, GCP and Azure accounts — usage in $K per service."
        actions={
          <div className="inline-flex rounded-md border border-border/60 p-0.5 bg-secondary/40">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded transition-colors",
                  range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {r}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid lg:grid-cols-3 gap-4">
        <SectionCard title="Spend trend" className="lg:col-span-2">
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={filtered} margin={{ left: -10, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="ga" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.30 0.025 250 / 0.4)" />
                <XAxis dataKey="date" stroke="oklch(0.70 0.025 250)" fontSize={11} />
                <YAxis stroke="oklch(0.70 0.025 250)" fontSize={11} tickFormatter={(v) => `$${v}k`} />
                <Tooltip contentStyle={{ background: "oklch(0.21 0.02 250)", border: "1px solid oklch(0.30 0.025 250)", borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="compute" stackId="1" stroke="var(--color-chart-1)" fill="url(#ga)" />
                <Area type="monotone" dataKey="database" stackId="1" stroke="var(--color-chart-2)" fill="var(--color-chart-2)" fillOpacity={0.2} />
                <Area type="monotone" dataKey="storage" stackId="1" stroke="var(--color-chart-3)" fill="var(--color-chart-3)" fillOpacity={0.2} />
                <Area type="monotone" dataKey="network" stackId="1" stroke="var(--color-chart-4)" fill="var(--color-chart-4)" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="By service" description="Latest month">
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={serviceTotals} layout="vertical" margin={{ left: 0, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.30 0.025 250 / 0.4)" />
                <XAxis type="number" stroke="oklch(0.70 0.025 250)" fontSize={11} tickFormatter={(v) => `$${v}k`} />
                <YAxis type="category" dataKey="service" stroke="oklch(0.70 0.025 250)" fontSize={11} width={70} />
                <Tooltip contentStyle={{ background: "oklch(0.21 0.02 250)", border: "1px solid oklch(0.30 0.025 250)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="value" fill="var(--color-primary)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Resource allocations" description={`${resourceAllocations.length} tracked resources`} actions={<Button size="sm" variant="outline">Add resource</Button>}>
        <Table>
          <TableHeader>
            <TableRow className="border-border/60 hover:bg-transparent">
              <TableHead>Resource</TableHead>
              <TableHead>Team</TableHead>
              <TableHead className="text-right">Used / Allocated</TableHead>
              <TableHead className="text-right">Utilization</TableHead>
              <TableHead className="text-right">Trend</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {resourceAllocations.map((r) => {
              const pct = (r.used / r.allocated) * 100;
              return (
                <TableRow key={r.id} className="border-border/60">
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell><Badge variant="outline" className="font-mono text-[10px]">{r.team}</Badge></TableCell>
                  <TableCell className="text-right font-mono text-sm">{r.used} / {r.allocated} <span className="text-muted-foreground text-xs">{r.unit}</span></TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-20 h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div
                          className={cn(
                            "h-full transition-all",
                            pct > 95 ? "bg-destructive" : pct > 80 ? "bg-warning" : "bg-success",
                          )}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono w-10 text-right">{pct.toFixed(0)}%</span>
                    </div>
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
