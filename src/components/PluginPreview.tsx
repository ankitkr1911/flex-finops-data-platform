import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Files, GitBranch, Search, Bug, Package, Bell, AlertTriangle,
  DollarSign, TrendingDown, TrendingUp, Check, ChevronRight, Play,
  Folder, FileCode, Terminal as TerminalIcon, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

type PreviewKind = "vscode-flex" | "vscode-eztrac" | "jetbrains-flex" | "flex-cli" | "rpt-vscode";

export function PluginPreviewDialog({
  open, onOpenChange, kind, name,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kind: PreviewKind | null;
  name: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden bg-[#1e1e1e] border-border/60">
        <DialogHeader className="px-5 py-3 border-b border-border/40 bg-[#252526]">
          <DialogTitle className="text-sm font-medium text-zinc-100 flex items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Live preview — {name}
          </DialogTitle>
          <DialogDescription className="text-[11px] text-zinc-400">
            Simulated extension UI running against your Flex workspace data.
          </DialogDescription>
        </DialogHeader>
        <div className="h-[560px]">
          {kind === "vscode-flex" && <VSCodeFlexPreview />}
          {kind === "vscode-eztrac" && <VSCodeEzTracPreview />}
          {kind === "jetbrains-flex" && <JetBrainsFlexPreview />}
          {kind === "flex-cli" && <FlexCliPreview />}
          {kind === "rpt-vscode" && <RptVscodePreview />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────── shared chrome ─────────────────────────── */

function IDEShell({
  activity, sidebar, children, statusItems,
}: {
  activity: React.ReactNode;
  sidebar: React.ReactNode;
  children: React.ReactNode;
  statusItems: { label: string; tone?: "good" | "warn" | "bad" }[];
}) {
  return (
    <div className="h-full flex flex-col bg-[#1e1e1e] text-zinc-200 text-xs font-mono">
      <div className="flex-1 flex min-h-0">
        <div className="w-12 bg-[#333333] flex flex-col items-center py-2 gap-3 border-r border-black/40">
          {activity}
        </div>
        <div className="w-60 bg-[#252526] border-r border-black/40 overflow-y-auto">
          {sidebar}
        </div>
        <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
          {children}
        </div>
      </div>
      <div className="h-6 bg-[#007acc] flex items-center px-3 gap-4 text-[10px] text-white">
        {statusItems.map((s, i) => (
          <span key={i} className={cn(
            "inline-flex items-center gap-1",
            s.tone === "warn" && "text-amber-200",
            s.tone === "bad" && "text-rose-200",
          )}>
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

const ActivityIcon = ({ icon: Icon, active }: { icon: any; active?: boolean }) => (
  <button className={cn(
    "h-8 w-8 grid place-items-center rounded text-zinc-400 hover:text-white",
    active && "text-white border-l-2 border-white -ml-[2px]",
  )}>
    <Icon className="h-5 w-5" />
  </button>
);

/* ─────────────────────────── 1. Flex for VS Code ─────────────────────────── */

function VSCodeFlexPreview() {
  const [activeFile, setActiveFile] = useState("main.tf");

  const tfLines = [
    { code: 'resource "aws_instance" "api" {', cost: null },
    { code: '  instance_type = "m5.4xlarge"', cost: "$561.60/mo", tone: "bad" },
    { code: '  ami           = "ami-0abcd1234"', cost: null },
    { code: '  count         = 6', cost: "× 6 = $3,369.60/mo", tone: "warn" },
    { code: '  tags = {', cost: null },
    { code: '    Service = "checkout-api"', cost: null },
    { code: '    Owner   = "platform-team"', cost: null },
    { code: '  }', cost: null },
    { code: '}', cost: null },
    { code: '', cost: null },
    { code: 'resource "aws_rds_cluster" "orders" {', cost: null },
    { code: '  engine             = "aurora-postgresql"', cost: null },
    { code: '  instance_class     = "db.r6g.2xlarge"', cost: "$842.40/mo", tone: "warn" },
    { code: '  backup_retention   = 35', cost: "+$120/mo storage", tone: "warn" },
    { code: '}', cost: null },
  ];

  return (
    <IDEShell
      activity={<>
        <ActivityIcon icon={Files} active />
        <ActivityIcon icon={Search} />
        <ActivityIcon icon={GitBranch} />
        <ActivityIcon icon={Bug} />
        <ActivityIcon icon={Package} />
        <div className="mt-auto">
          <div className="h-8 w-8 grid place-items-center rounded bg-violet-600 text-white text-[10px] font-bold">F</div>
        </div>
      </>}
      sidebar={<div className="p-2">
        <div className="text-[10px] uppercase tracking-wider text-zinc-500 px-2 py-1">Explorer</div>
        <div className="flex items-center gap-1 px-2 py-1 text-zinc-300">
          <Folder className="h-3 w-3" /> infra/
        </div>
        {["main.tf", "variables.tf", "outputs.tf", "modules/rds.tf"].map((f) => (
          <button key={f}
            onClick={() => setActiveFile(f)}
            className={cn(
              "w-full flex items-center gap-1 pl-6 pr-2 py-1 text-left hover:bg-white/5",
              activeFile === f && "bg-[#37373d] text-white",
            )}>
            <FileCode className="h-3 w-3 text-violet-400" /> {f}
          </button>
        ))}
        <div className="mt-4 mx-2 rounded border border-violet-500/30 bg-violet-500/10 p-2">
          <div className="text-[10px] font-semibold text-violet-300 flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> FLEX
          </div>
          <div className="mt-1 text-[10px] text-zinc-400">This file: <span className="text-amber-300">$4,332/mo</span></div>
          <div className="text-[10px] text-zinc-400">Potential savings: <span className="text-emerald-400">$1,840/mo</span></div>
        </div>
      </div>}
      statusItems={[
        { label: "⎇ main" },
        { label: "Flex: $4,332/mo this file", tone: "warn" },
        { label: "3 cost warnings", tone: "warn" },
        { label: "1 anomaly today", tone: "bad" },
      ]}
    >
      <div className="bg-[#2d2d30] border-b border-black/40 flex">
        <div className="px-3 py-1.5 bg-[#1e1e1e] text-zinc-200 text-[11px] flex items-center gap-2 border-r border-black/40">
          <FileCode className="h-3 w-3 text-violet-400" /> {activeFile}
          <span className="text-zinc-600">×</span>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-3 leading-6">
        {tfLines.map((l, i) => (
          <div key={i} className="flex items-start gap-4 group hover:bg-white/[0.02]">
            <span className="text-zinc-600 w-6 text-right select-none">{i + 1}</span>
            <span className="flex-1 text-zinc-300 whitespace-pre">{l.code || "\u00A0"}</span>
            {l.cost && (
              <span className={cn(
                "italic text-[10px] mr-3 px-2 py-0.5 rounded",
                l.tone === "bad" && "text-rose-300 bg-rose-500/10",
                l.tone === "warn" && "text-amber-300 bg-amber-500/10",
              )}>
                💰 {l.cost}
              </span>
            )}
          </div>
        ))}
        <div className="mt-6 mx-2 rounded border border-amber-500/40 bg-amber-500/10 p-3">
          <div className="text-amber-300 font-semibold flex items-center gap-1 text-[11px]">
            <AlertTriangle className="h-3 w-3" /> Flex suggestion
          </div>
          <div className="text-zinc-300 mt-1 text-[11px]">
            <code className="text-amber-200">m5.4xlarge × 6</code> averages 18% CPU. Right-sizing to
            <code className="text-emerald-300"> m5.2xlarge × 4</code> saves <b className="text-emerald-300">$1,840/mo</b> with headroom.
          </div>
          <Button size="sm" className="mt-2 h-6 text-[10px] bg-violet-600 hover:bg-violet-500">Apply quick fix</Button>
        </div>
      </div>
    </IDEShell>
  );
}

/* ─────────────────────────── 2. EzTrac Budget Lens ─────────────────────────── */

function VSCodeEzTracPreview() {
  return (
    <IDEShell
      activity={<>
        <ActivityIcon icon={Files} />
        <ActivityIcon icon={Search} />
        <ActivityIcon icon={DollarSign} active />
        <ActivityIcon icon={Bell} />
      </>}
      sidebar={<div className="p-3 space-y-3">
        <div className="text-[10px] uppercase tracking-wider text-zinc-500">EzTrac · Budgets</div>
        {[
          { svc: "checkout-api", fc: 12400, ac: 14820, pct: 119 },
          { svc: "orders-db", fc: 8200, ac: 7640, pct: 93 },
          { svc: "search-svc", fc: 4100, ac: 5380, pct: 131 },
          { svc: "analytics", fc: 9800, ac: 9210, pct: 94 },
        ].map((b) => (
          <div key={b.svc} className="rounded bg-[#2d2d30] p-2">
            <div className="flex items-center justify-between">
              <span className="text-zinc-200 text-[11px]">{b.svc}</span>
              <Badge className={cn(
                "text-[9px] h-4",
                b.pct > 100 ? "bg-rose-500/20 text-rose-300" : "bg-emerald-500/20 text-emerald-300",
              )}>{b.pct}%</Badge>
            </div>
            <div className="mt-1 h-1.5 rounded bg-black/40 overflow-hidden">
              <div className={cn("h-full", b.pct > 100 ? "bg-rose-500" : "bg-emerald-500")}
                style={{ width: `${Math.min(b.pct, 100)}%` }} />
            </div>
            <div className="flex justify-between text-[9px] text-zinc-500 mt-1">
              <span>FC ${b.fc.toLocaleString()}</span>
              <span>AC ${b.ac.toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>}
      statusItems={[
        { label: "EzTrac synced 2m ago" },
        { label: "2 services over budget", tone: "bad" },
        { label: "FY26 Q2" },
      ]}
    >
      <div className="bg-[#2d2d30] border-b border-black/40 flex">
        <div className="px-3 py-1.5 bg-[#1e1e1e] text-zinc-200 text-[11px] flex items-center gap-2 border-r border-black/40">
          <FileCode className="h-3 w-3 text-sky-400" /> checkout-service.yaml
        </div>
      </div>
      <div className="flex-1 overflow-auto p-3 leading-6 text-[11px]">
        <pre className="text-zinc-300">
{`apiVersion: apps/v1
kind: Deployment
metadata:
  name: checkout-api`}
        </pre>
        <div className="my-2 rounded border-l-2 border-rose-500 bg-rose-500/10 px-3 py-2">
          <div className="flex items-center gap-1 text-rose-300 text-[11px] font-semibold">
            <TrendingUp className="h-3 w-3" /> EzTrac: 19% over forecast
          </div>
          <div className="text-zinc-300 mt-1 text-[10px]">
            checkout-api · FC <b>$12,400</b> · AC <b className="text-rose-300">$14,820</b> · Δ +$2,420
          </div>
          <div className="text-zinc-400 mt-1 text-[10px]">Spike started 4 days ago — correlates with deploy <code className="text-sky-300">v2.18.0</code>.</div>
        </div>
        <pre className="text-zinc-300">
{`spec:
  replicas: 12
  template:
    spec:
      containers:
        - name: api
          resources:
            limits:
              cpu: "4"
              memory: "16Gi"`}
        </pre>
        <div className="mt-3 rounded border border-emerald-500/40 bg-emerald-500/10 p-3 text-[11px]">
          <div className="text-emerald-300 font-semibold flex items-center gap-1">
            <TrendingDown className="h-3 w-3" /> Re-forecast suggestion
          </div>
          <div className="text-zinc-300 mt-1">
            Drop replicas 12 → 8, projected actuals <b className="text-emerald-300">$10,210</b> (under forecast).
          </div>
          <Button size="sm" className="mt-2 h-6 text-[10px] bg-emerald-600 hover:bg-emerald-500">Open in EzTrac →</Button>
        </div>
      </div>
    </IDEShell>
  );
}

/* ─────────────────────────── 3. Flex for JetBrains ─────────────────────────── */

function JetBrainsFlexPreview() {
  return (
    <div className="h-full flex flex-col bg-[#2b2b2b] text-zinc-200 text-xs font-mono">
      <div className="h-7 bg-[#3c3f41] flex items-center px-3 gap-4 text-[10px] text-zinc-300 border-b border-black/40">
        <span className="font-semibold">IntelliJ IDEA</span>
        <span className="text-zinc-500">flex-infra [main]</span>
        <span className="ml-auto inline-flex items-center gap-1 text-emerald-400">● Flex connected</span>
      </div>
      <div className="flex-1 flex min-h-0">
        <div className="w-48 bg-[#3c3f41] border-r border-black/40 p-2 text-[11px]">
          <div className="text-zinc-500 text-[10px] uppercase mb-1">Project</div>
          {["src/", "infra/", "  main.tf", "  rds.tf", "  k8s/", "    deploy.yaml"].map((f, i) => (
            <div key={i} className={cn("py-0.5 px-1 rounded", i === 2 && "bg-[#214283] text-white")}>{f}</div>
          ))}
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <div className="bg-[#3c3f41] border-b border-black/40 px-3 py-1 text-[11px]">main.tf</div>
          <div className="flex-1 overflow-auto p-3 leading-6 text-[11px]">
            {[
              { ln: 'resource "aws_instance" "worker" {', cost: null },
              { ln: '  instance_type = "c5.9xlarge"', cost: "$1,224/mo · 14% CPU avg", tone: "bad" },
              { ln: '  count         = 4', cost: "× 4 = $4,896/mo", tone: "warn" },
              { ln: '}', cost: null },
            ].map((l, i) => (
              <div key={i} className="flex items-start gap-3 group">
                <span className="text-zinc-600 w-6 text-right">{i + 1}</span>
                <span className="flex-1 text-zinc-300 whitespace-pre">{l.ln}</span>
                {l.cost && (
                  <span className={cn(
                    "italic text-[10px] mr-3 px-2 rounded",
                    l.tone === "bad" ? "text-rose-300 bg-rose-500/10" : "text-amber-300 bg-amber-500/10",
                  )}>◐ {l.cost}</span>
                )}
              </div>
            ))}
            <div className="mt-4 rounded border border-amber-500/40 bg-amber-500/10 p-3">
              <div className="text-amber-300 font-semibold text-[11px]">Flex Inspection</div>
              <div className="text-zinc-300 mt-1 text-[11px]">Idle compute detected. <span className="text-emerald-300">Alt+Enter</span> → "Right-size with Flex"</div>
            </div>
          </div>
          <div className="h-32 bg-[#2b2b2b] border-t border-black/40 p-2 text-[10px]">
            <div className="flex gap-3 text-zinc-500 mb-1">
              <span className="text-white border-b border-violet-500">Flex Cost</span>
              <span>Terminal</span>
              <span>Problems</span>
            </div>
            <div className="space-y-0.5 text-zinc-300">
              <div>📊 This module · $6,120/mo · ↑ 8% WoW</div>
              <div className="text-amber-300">⚠ 2 right-sizing opportunities · $1,920/mo savings</div>
              <div className="text-rose-300">● 1 anomaly · checkout-api +24% (4d ago)</div>
              <div className="text-emerald-300">✓ All resources tagged · ready for chargeback</div>
            </div>
          </div>
        </div>
      </div>
      <div className="h-5 bg-[#3c3f41] border-t border-black/40 flex items-center px-3 gap-4 text-[10px] text-zinc-400">
        <span>Flex: $6,120/mo</span>
        <span className="text-amber-300">2 hints</span>
        <span className="ml-auto">UTF-8 · LF · Terraform</span>
      </div>
    </div>
  );
}

/* ─────────────────────────── 4. Flex CLI ─────────────────────────── */

function FlexCliPreview() {
  const [step, setStep] = useState(0);

  const sessions = [
    {
      cmd: "flex spend --service checkout-api --last 7d",
      out: [
        "Querying Flex workspace…",
        "",
        "  checkout-api · last 7 days",
        "  ─────────────────────────────────────",
        "  Total          $3,462.18    ↑ 18.4%",
        "  Compute        $2,140.00    ↑ 22.1%",
        "  Database       $   840.40   →  0.2%",
        "  Egress         $   481.78   ↑  6.0%",
        "",
        "  ⚠ Anomaly detected · day 4 · +$612 vs baseline",
        "    flex anomaly show ax-7124 for details",
      ],
    },
    {
      cmd: "flex anomaly show ax-7124",
      out: [
        "ax-7124 · checkout-api · OPEN · SEV-2",
        "─────────────────────────────────────────",
        "  Started   2026-05-25 14:22 UTC",
        "  Impact    +$612 (so far, $2,440 projected)",
        "  Root      m5.4xlarge × 6 (was × 4) — deploy v2.18.0",
        "  Owner     platform-team · Sara Chen",
        "",
        "Actions:",
        "  [1] flex anomaly ack ax-7124",
        "  [2] flex savings create --from ax-7124",
        "  [3] flex discussion open --anomaly ax-7124",
      ],
    },
    {
      cmd: "flex savings create --from ax-7124",
      out: [
        "Creating savings opportunity from ax-7124…",
        "  ✓ Right-size m5.4xlarge × 6 → m5.2xlarge × 4",
        "  ✓ Estimated savings:  $1,840 / month",
        "  ✓ Confidence:         92%",
        "  ✓ Pushed to pipeline: sv-2391 (Identified)",
        "",
        "  Open in browser: https://flex.app/optimization/sv-2391",
      ],
    },
  ];

  return (
    <div className="h-full flex flex-col bg-[#0c0c0c] text-emerald-300 text-xs font-mono">
      <div className="h-7 bg-[#1a1a1a] flex items-center px-3 gap-2 text-[10px] text-zinc-400 border-b border-black/60">
        <span className="h-2 w-2 rounded-full bg-rose-500" />
        <span className="h-2 w-2 rounded-full bg-amber-500" />
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        <span className="mx-auto">sara@flex-cli — zsh</span>
      </div>
      <div className="flex-1 overflow-auto p-4 leading-6">
        <div className="text-zinc-500">$ flex login --workspace acme-prod</div>
        <div className="text-zinc-300">✓ Authenticated as sara.chen@acme.com (FinOps Admin)</div>
        <div className="text-zinc-500 mt-2">$ flex whoami</div>
        <div className="text-zinc-300">acme-prod · 247 services · 6 partners synced</div>

        {sessions.slice(0, step + 1).map((s, i) => (
          <div key={i} className="mt-4">
            <div className="text-emerald-400">$ <span className="text-zinc-100">{s.cmd}</span></div>
            {s.out.map((line, j) => (
              <div key={j} className={cn(
                "whitespace-pre",
                line.includes("⚠") && "text-amber-300",
                line.includes("✓") && "text-emerald-300",
                line.includes("─") && "text-zinc-600",
                !line.includes("⚠") && !line.includes("✓") && !line.includes("─") && "text-zinc-300",
              )}>{line || "\u00A0"}</div>
            ))}
          </div>
        ))}

        <div className="mt-4 flex items-center gap-2">
          <span className="text-emerald-400">$</span>
          <span className="text-zinc-100 animate-pulse">▊</span>
          {step < sessions.length - 1 && (
            <Button size="sm" className="ml-4 h-6 text-[10px] bg-emerald-600 hover:bg-emerald-500"
              onClick={() => setStep(step + 1)}>
              <Play className="h-3 w-3 mr-1" /> Run next command
            </Button>
          )}
          {step === sessions.length - 1 && (
            <Button size="sm" variant="outline" className="ml-4 h-6 text-[10px]"
              onClick={() => setStep(0)}>Reset demo</Button>
          )}
        </div>
      </div>
      <div className="h-5 bg-[#1a1a1a] border-t border-black/60 flex items-center px-3 gap-3 text-[10px] text-zinc-500">
        <TerminalIcon className="h-3 w-3" /> flex-cli v2.0.1
        <span className="ml-auto text-emerald-400">● online</span>
      </div>
    </div>
  );
}

/* ─────────────────────────── 5. dhub-rpt Capacity Hints ─────────────────────────── */

function RptVscodePreview() {
  return (
    <IDEShell
      activity={<>
        <ActivityIcon icon={Files} active />
        <ActivityIcon icon={Search} />
        <ActivityIcon icon={Package} />
      </>}
      sidebar={<div className="p-3 space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-zinc-500">dhub-rpt · Capacity</div>
        {[
          { ns: "checkout", util: 87, headroom: "13%", tone: "warn" },
          { ns: "orders", util: 42, headroom: "58%", tone: "good" },
          { ns: "search", util: 94, headroom: "6%", tone: "bad" },
          { ns: "analytics", util: 31, headroom: "69%", tone: "good" },
        ].map((n) => (
          <div key={n.ns} className="rounded bg-[#2d2d30] p-2">
            <div className="flex justify-between text-[11px] text-zinc-200">
              <span>{n.ns}</span>
              <span className={cn(
                n.tone === "bad" && "text-rose-300",
                n.tone === "warn" && "text-amber-300",
                n.tone === "good" && "text-emerald-300",
              )}>{n.util}%</span>
            </div>
            <div className="h-1 rounded bg-black/40 mt-1 overflow-hidden">
              <div className={cn(
                "h-full",
                n.tone === "bad" && "bg-rose-500",
                n.tone === "warn" && "bg-amber-500",
                n.tone === "good" && "bg-emerald-500",
              )} style={{ width: `${n.util}%` }} />
            </div>
            <div className="text-[9px] text-zinc-500 mt-1">headroom {n.headroom}</div>
          </div>
        ))}
      </div>}
      statusItems={[
        { label: "dhub-rpt synced 4m ago" },
        { label: "1 ns at capacity", tone: "bad" },
        { label: "2 oversized", tone: "warn" },
      ]}
    >
      <div className="bg-[#2d2d30] border-b border-black/40 px-3 py-1.5 text-[11px] flex items-center gap-2">
        <FileCode className="h-3 w-3 text-teal-400" /> values.yaml
      </div>
      <div className="flex-1 overflow-auto p-3 leading-6 text-[11px]">
        <pre className="text-zinc-300">
{`replicaCount: 8

resources:
  requests:
    cpu: "2"
    memory: "8Gi"
  limits:
    cpu: "4"
    memory: "16Gi"

autoscaling:
  enabled: true
  minReplicas: 8
  maxReplicas: 24`}
        </pre>
        <div className="mt-3 rounded border-l-2 border-rose-500 bg-rose-500/10 px-3 py-2">
          <div className="text-rose-300 font-semibold text-[11px] flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> dhub-rpt: ns search at 94%
          </div>
          <div className="text-zinc-300 mt-1 text-[10px]">
            Suggested: <code className="text-emerald-300">minReplicas: 12, maxReplicas: 32</code>
          </div>
          <div className="text-zinc-400 mt-0.5 text-[10px]">Reservation pool has 4 nodes available right now.</div>
        </div>
        <div className="mt-2 rounded border-l-2 border-amber-500 bg-amber-500/10 px-3 py-2">
          <div className="text-amber-300 font-semibold text-[11px] flex items-center gap-1">
            <ChevronRight className="h-3 w-3" /> Capacity hint
          </div>
          <div className="text-zinc-300 mt-1 text-[10px]">
            requests.cpu "2" is 3.2× p95 usage. Drop to <code className="text-emerald-300">"1"</code> to fit 4 more pods per node.
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <Button size="sm" className="h-6 text-[10px] bg-teal-600 hover:bg-teal-500">
            <Check className="h-3 w-3 mr-1" /> Apply hint
          </Button>
          <Button size="sm" variant="outline" className="h-6 text-[10px]">Open in dhub-rpt</Button>
        </div>
      </div>
    </IDEShell>
  );
}

export const previewableIds = new Set<string>([
  "vscode-flex", "vscode-eztrac", "jetbrains-flex", "flex-cli", "rpt-vscode",
]);
