import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { PageHeader, SectionCard } from "@/components/Primitives";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { resourceAllocations } from "@/lib/mockData";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/resources")({
  head: () => ({
    meta: [
      { title: "Resources — Flex" },
      { name: "description", content: "Full inventory of cloud resources allocated to teams." },
    ],
  }),
  component: Resources,
});

function Resources() {
  const [q, setQ] = useState("");
  const [team, setTeam] = useState<string>("all");

  const teams = useMemo(() => Array.from(new Set(resourceAllocations.map((r) => r.team))), []);

  const filtered = useMemo(
    () => resourceAllocations.filter((r) =>
      (team === "all" || r.team === team) &&
      r.name.toLowerCase().includes(q.toLowerCase())
    ),
    [q, team],
  );

  return (
    <div className="px-6 lg:px-10 py-8 max-w-[1400px] mx-auto space-y-8">
      <PageHeader
        eyebrow="Organization"
        title="Resources"
        description="Searchable inventory of all tracked cloud resources, organized by team."
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search resources…" className="pl-9" />
        </div>
        <div className="flex gap-1">
          {(["all", ...teams]).map((t) => (
            <button
              key={t}
              onClick={() => setTeam(t)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                team === t ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {t === "all" ? "All teams" : t}
            </button>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((r) => {
          const pct = (r.used / r.allocated) * 100;
          return (
            <SectionCard key={r.id}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-display text-lg font-semibold">{r.name}</div>
                  <Badge variant="outline" className="mt-1 font-mono text-[10px]">{r.team}</Badge>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm">{r.used}/{r.allocated}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{r.unit}</div>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex justify-between items-baseline text-xs mb-1">
                  <span className="text-muted-foreground">Utilization</span>
                  <span className="font-mono">{pct.toFixed(0)}%</span>
                </div>
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <div
                    className={cn(
                      "h-full transition-all",
                      pct > 95 ? "bg-destructive" : pct > 80 ? "bg-warning" : "bg-success",
                    )}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
              </div>
            </SectionCard>
          );
        })}
        {filtered.length === 0 && (
          <SectionCard className="col-span-full">
            <div className="text-center py-8 text-sm text-muted-foreground">No resources match.</div>
          </SectionCard>
        )}
      </div>
    </div>
  );
}
