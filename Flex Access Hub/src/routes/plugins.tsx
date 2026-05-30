import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Activity, AlertTriangle, BarChart3, Check, Code2, Play, Plug, Search, Shield,
  Sparkles, Star, Terminal, Wand2, Zap,
} from "lucide-react";
import { PageHeader, SectionCard, KpiCard } from "@/components/Primitives";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PluginPreviewDialog, previewableIds } from "@/components/PluginPreview";

export const Route = createFileRoute("/plugins")({
  head: () => ({
    meta: [
      { title: "Marketplace — Flex" },
      { name: "description", content: "Plugin marketplace — extend Flex with detection, workflow, analytics, and AI modules." },
    ],
  }),
  component: Plugins,
});

type Category = "All" | "Detection" | "Workflow" | "Analytics" | "Governance" | "AI" | "IDE";

type PluginDef = {
  id: string;
  name: string;
  description: string;
  category: Exclude<Category, "All">;
  icon: React.ComponentType<{ className?: string }>;
  installed: boolean;
  author: string;
  version: string;
  rating: number;
  installs: string;
  featured?: boolean;
  accent: string;
};

const ALL: PluginDef[] = [
  { id: "anomaly-stories", name: "Anomaly Stories", description: "Correlate anomalies with deploys & transfers to tell the why behind every spike.", category: "Detection", icon: AlertTriangle, installed: true, author: "Flex Core", version: "2.1.0", rating: 4.8, installs: "12.4K", featured: true, accent: "from-orange-500/30 to-red-500/10" },
  { id: "command-palette", name: "Command Palette", description: "⌘K intent-driven navigation across every page in Flex.", category: "Workflow", icon: Sparkles, installed: true, author: "Flex Core", version: "1.6.2", rating: 4.9, installs: "28.1K", accent: "from-violet-500/30 to-indigo-500/10" },
  { id: "savings-pipeline", name: "Savings Pipeline", description: "Track opportunities identified → approved → implementing → realized.", category: "Workflow", icon: Wand2, installed: true, author: "Flex Core", version: "1.4.0", rating: 4.7, installs: "9.8K", accent: "from-emerald-500/30 to-teal-500/10" },
  { id: "executive-export", name: "Executive Export", description: "One-click markdown bundle of KPIs, anomalies & savings for leadership reviews.", category: "Analytics", icon: BarChart3, installed: false, author: "Flex Labs", version: "0.9.1", rating: 4.4, installs: "3.2K", accent: "from-sky-500/30 to-cyan-500/10" },
  { id: "rbac-lite", name: "RBAC Lite", description: "Finance / Platform / Admin / Viewer role gating with audit log.", category: "Governance", icon: Shield, installed: true, author: "Flex Core", version: "1.2.0", rating: 4.6, installs: "6.7K", accent: "from-amber-500/30 to-yellow-500/10" },
  { id: "page-sense", name: "Page Sense", description: "Browser extension — smart chip on AWS, Azure & GCP consoles.", category: "Detection", icon: Activity, installed: false, author: "Flex Labs", version: "0.7.4", rating: 4.3, installs: "2.1K", accent: "from-pink-500/30 to-rose-500/10" },
  { id: "rag-chat", name: "RAG Chat", description: "Cite-back AI answers grounded in your spend, anomaly and chargeback data.", category: "AI", icon: Sparkles, installed: false, author: "Flex Labs", version: "0.5.0", rating: 4.7, installs: "5.4K", featured: true, accent: "from-fuchsia-500/30 to-purple-500/10" },
  { id: "forecast-lens", name: "Forecast Lens", description: "Bayesian forecast overlays with confidence bands & budget alerts.", category: "Analytics", icon: BarChart3, installed: false, author: "Acme Data", version: "1.0.3", rating: 4.5, installs: "1.9K", accent: "from-lime-500/30 to-green-500/10" },
  { id: "policy-bot", name: "Policy Bot", description: "Auto-enforce tagging, region and instance-type policies on every deploy.", category: "Governance", icon: Shield, installed: false, author: "Flex Core", version: "1.1.0", rating: 4.6, installs: "4.0K", accent: "from-blue-500/30 to-indigo-500/10" },
  { id: "vscode-flex", name: "Flex for VS Code", description: "Inline cloud-cost annotations on Terraform, k8s manifests & IaC — see $/month next to every resource.", category: "IDE", icon: Code2, installed: false, author: "Flex Core", version: "1.3.2", rating: 4.8, installs: "18.7K", featured: true, accent: "from-blue-500/30 to-sky-500/10" },
  { id: "vscode-eztrac", name: "EzTrac Budget Lens", description: "VS Code extension — pull EzTrac forecast vs actuals into your editor for any service you touch.", category: "IDE", icon: Code2, installed: false, author: "EzTrac", version: "0.8.0", rating: 4.5, installs: "3.4K", accent: "from-violet-500/30 to-indigo-500/10" },
  { id: "jetbrains-flex", name: "Flex for JetBrains", description: "IntelliJ / PyCharm / GoLand plugin — same cost gutter & anomaly inlays as the VS Code extension.", category: "IDE", icon: Code2, installed: false, author: "Flex Core", version: "1.1.0", rating: 4.6, installs: "5.2K", accent: "from-fuchsia-500/30 to-pink-500/10" },
  { id: "flex-cli", name: "Flex CLI", description: "Terminal-first FinOps — query spend, ack anomalies and approve savings from your shell.", category: "IDE", icon: Terminal, installed: true, author: "Flex Core", version: "2.0.1", rating: 4.9, installs: "9.1K", accent: "from-emerald-500/30 to-green-500/10" },
  { id: "rpt-vscode", name: "dhub-rpt Capacity Hints", description: "VS Code extension — capacity & allocation hints from dhub-rpt inline on Helm/k8s files.", category: "IDE", icon: Code2, installed: false, author: "dhub", version: "0.6.4", rating: 4.4, installs: "1.6K", accent: "from-teal-500/30 to-cyan-500/10" },
];

const CATEGORIES: Category[] = ["All", "Detection", "Workflow", "Analytics", "Governance", "AI", "IDE"];

function Plugins() {
  const [items, setItems] = useState(ALL);
  const [cat, setCat] = useState<Category>("All");
  const [q, setQ] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const previewPlugin = items.find((p) => p.id === previewId) ?? null;

  const filtered = useMemo(() => {
    return items.filter((p) =>
      (cat === "All" || p.category === cat) &&
      (q === "" || (p.name + p.description).toLowerCase().includes(q.toLowerCase()))
    );
  }, [items, cat, q]);

  const installedCount = items.filter((i) => i.installed).length;
  const featured = items.filter((p) => p.featured);

  return (
    <div className="px-6 lg:px-10 py-8 max-w-[1400px] mx-auto space-y-8">
      <PageHeader
        eyebrow="Marketplace"
        title="Flex plugin marketplace"
        description="Extend Flex with first-party modules and partner-built extensions. Toggle anything on without leaving the app."
        actions={
          <Button size="sm" variant="outline" className="gap-2">
            <Plug className="h-4 w-4" /> Submit a plugin
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Installed" value={installedCount} sub={`of ${items.length} available`} icon={Check} tone="good" />
        <KpiCard label="Available" value={items.length} sub="across 7 categories" icon={Plug} />
        <KpiCard label="Featured" value={featured.length} sub="curated this month" icon={Star} tone="warn" />
        <KpiCard label="Avg rating" value="4.6" sub="from 73K teams" icon={Zap} />
      </div>

      {/* Featured strip */}
      {featured.length > 0 && (
        <SectionCard title="Featured this month" description="Hand-picked by the Flex team">
          <div className="grid md:grid-cols-2 gap-4">
            {featured.map((p) => (
              <div
                key={p.id}
                className={cn(
                  "relative overflow-hidden rounded-xl border border-border/60 p-5 bg-gradient-to-br",
                  p.accent,
                )}
              >
                <div className="absolute inset-0 bg-card/60 backdrop-blur-[2px]" />
                <div className="relative">
                  <div className="flex items-start justify-between">
                    <div className="grid h-11 w-11 place-items-center rounded-xl bg-background/80 text-primary border border-border/60">
                      <p.icon className="h-5 w-5" />
                    </div>
                    <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">Featured</Badge>
                  </div>
                  <div className="mt-3 font-display text-lg font-semibold">{p.name}</div>
                  <p className="text-sm text-muted-foreground mt-1">{p.description}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Star className="h-3 w-3 fill-warning text-warning" />{p.rating}</span>
                      <span>{p.installs} installs</span>
                      <span>v{p.version}</span>
                    </div>
                    <div className="flex gap-2">
                      {previewableIds.has(p.id) && (
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => setPreviewId(p.id)}>
                          <Play className="h-3 w-3" /> Preview
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant={p.installed ? "secondary" : "default"}
                        onClick={() => {
                          setItems((arr) => arr.map((x) => x.id === p.id ? { ...x, installed: !x.installed } : x));
                          toast.success(`${p.name} ${p.installed ? "disabled" : "enabled"}`);
                        }}
                      >
                        {p.installed ? "Installed" : "Install"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Filter + grid */}
      <SectionCard
        title="All plugins"
        description={`${filtered.length} results`}
        actions={
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search plugins…"
              className="h-8 pl-8 text-xs"
            />
          </div>
        }
      >
        <div className="flex flex-wrap gap-2 mb-5">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                cat === c
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border/60 text-muted-foreground hover:text-foreground hover:border-border",
              )}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="group rounded-xl border border-border/60 bg-secondary/20 p-4 hover:border-primary/40 hover:bg-secondary/40 transition-colors flex flex-col"
            >
              <div className="flex items-start justify-between">
                <div className={cn("grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br text-primary border border-border/60", p.accent)}>
                  <p.icon className="h-5 w-5" />
                </div>
                <Switch
                  checked={p.installed}
                  onCheckedChange={(v) => {
                    setItems((arr) => arr.map((x) => x.id === p.id ? { ...x, installed: v } : x));
                    toast.success(`${p.name} ${v ? "enabled" : "disabled"}`);
                  }}
                />
              </div>
              <div className="mt-3 font-display font-semibold">{p.name}</div>
              <p className="text-xs text-muted-foreground mt-1 flex-1">{p.description}</p>
              <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{p.author} · v{p.version}</span>
                <span className="inline-flex items-center gap-1"><Star className="h-3 w-3 fill-warning text-warning" />{p.rating}</span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <Badge variant="outline" className="text-[10px]">{p.category}</Badge>
                <span className="text-[10px] text-muted-foreground">{p.installs} installs</span>
              </div>
              {previewableIds.has(p.id) && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 w-full gap-1 h-7 text-[11px]"
                  onClick={() => setPreviewId(p.id)}
                >
                  <Play className="h-3 w-3" /> Preview live UI
                </Button>
              )}
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No plugins match your filters.
          </div>
        )}
      </SectionCard>

      <PluginPreviewDialog
        open={!!previewId}
        onOpenChange={(v) => !v && setPreviewId(null)}
        kind={(previewPlugin?.id as any) ?? null}
        name={previewPlugin?.name ?? ""}
      />
    </div>
  );
}
