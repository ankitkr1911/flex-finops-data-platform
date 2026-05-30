import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeftRight, ArrowDownLeft, ArrowUpRight, Building2,
  CheckCircle2, Clock, Database, MessageSquare, MoreHorizontal,
  RefreshCcw, Settings as SettingsIcon, XCircle, Zap,
} from "lucide-react";
import { KpiCard, SectionCard, timeAgo } from "@/components/Primitives";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { connectedApps } from "@/lib/mockData";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/govern/partners")({
  head: () => ({
    meta: [
      { title: "Partners — Flex" },
      { name: "description", content: "Connected partner apps, sync direction, and integration health." },
    ],
  }),
  component: Partners,
});

const APP_TINT: Record<string, string> = {
  eztrac: "from-violet-500/30 to-indigo-500/10",
  "dhub-rpt": "from-emerald-500/30 to-teal-500/10",
  snowflake: "from-sky-500/30 to-cyan-500/10",
  okta: "from-amber-500/30 to-orange-500/10",
};

function dirIcon(d: string) {
  if (d === "inbound") return ArrowDownLeft;
  if (d === "outbound") return ArrowUpRight;
  return ArrowLeftRight;
}

function Partners() {
  const connected = connectedApps.filter((a) => a.status === "connected").length;
  const pending = connectedApps.filter((a) => a.status === "pending").length;
  const bidi = connectedApps.filter((a) => a.direction === "bidirectional").length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Connected" value={connected} sub="healthy partner links" icon={CheckCircle2} tone="good" />
        <KpiCard label="Pending" value={pending} sub="awaiting handshake" icon={Clock} tone="warn" />
        <KpiCard label="Bidirectional" value={bidi} sub="two-way data flow" icon={ArrowLeftRight} />
        <KpiCard label="Datasets shared" value={12} sub="across all partners" icon={Database} />
      </div>

      <SectionCard
        title="Partner integrations"
        description="Each connected app shares scoped datasets under your governance policies"
        actions={
          <Button size="sm" className="gap-2">
            <Building2 className="h-4 w-4" /> Connect partner
          </Button>
        }
      >
        <div className="grid md:grid-cols-2 gap-4">
          {connectedApps.map((app) => {
            const DirIcon = dirIcon(app.direction);
            const tint = APP_TINT[app.id] ?? "from-primary/20 to-primary/5";
            return (
              <div
                key={app.id}
                className="relative overflow-hidden rounded-xl border border-border/60 bg-card hover:border-primary/40 transition-colors"
              >
                <div className={cn("absolute inset-x-0 top-0 h-20 bg-gradient-to-br opacity-60", tint)} />
                <div className="relative p-5">
                  <div className="flex items-start gap-4">
                    <div className="grid h-12 w-12 place-items-center rounded-xl bg-background border border-border/60 text-primary shrink-0">
                      <Building2 className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-display text-base font-semibold">{app.name}</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] capitalize",
                            app.status === "connected" && "border-success/40 text-success bg-success/5",
                            app.status === "pending" && "border-warning/40 text-warning bg-warning/5",
                            app.status === "disconnected" && "border-destructive/40 text-destructive bg-destructive/5",
                          )}
                        >
                          <span className={cn(
                            "mr-1 inline-block h-1.5 w-1.5 rounded-full",
                            app.status === "connected" && "bg-success animate-pulse",
                            app.status === "pending" && "bg-warning",
                            app.status === "disconnected" && "bg-destructive",
                          )} />
                          {app.status}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{app.description}</p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-7 w-7">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => toast.success(`Syncing ${app.name}…`)}>
                          <RefreshCcw className="h-3.5 w-3.5 mr-2" /> Sync now
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toast.info(`Opening ${app.name} settings`)}>
                          <SettingsIcon className="h-3.5 w-3.5 mr-2" /> Configure
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => toast.error(`${app.name} disconnected`)}
                        >
                          <XCircle className="h-3.5 w-3.5 mr-2" /> Disconnect
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-secondary/40 p-2.5">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Direction</div>
                      <div className="mt-1 flex items-center justify-center gap-1 text-xs font-medium capitalize">
                        <DirIcon className="h-3 w-3" />
                        {app.direction}
                      </div>
                    </div>
                    <div className="rounded-lg bg-secondary/40 p-2.5">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Last sync</div>
                      <div className="mt-1 text-xs font-medium">{app.lastSync ? timeAgo(app.lastSync) : "—"}</div>
                    </div>
                    <div className="rounded-lg bg-secondary/40 p-2.5">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Latency</div>
                      <div className="mt-1 flex items-center justify-center gap-1 text-xs font-medium">
                        <Zap className="h-3 w-3 text-success" />
                        {app.status === "connected" ? "120ms" : "—"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <Button asChild size="sm" variant="outline" className="gap-1.5 flex-1">
                      <Link to="/govern/discussions" search={{ partner: app.id }}>
                        <MessageSquare className="h-3.5 w-3.5" />
                        Open discussion
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5"
                      onClick={() => toast.success(`Syncing ${app.name}…`)}
                    >
                      <RefreshCcw className="h-3.5 w-3.5" />
                      Sync
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}
