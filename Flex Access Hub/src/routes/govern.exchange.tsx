import { createFileRoute } from "@tanstack/react-router";
import { Check, Database, X } from "lucide-react";
import { SectionCard, timeAgo } from "@/components/Primitives";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { initialPublishedDatasets } from "@/lib/mockData";
import { store, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/govern/exchange")({
  head: () => ({
    meta: [
      { title: "Data exchange — Flex" },
      { name: "description", content: "Approve and manage dataset requests from partner apps." },
    ],
  }),
  component: Exchange,
});

function Exchange() {
  const requests = useStore((s) => s.dataRequests);

  return (
    <div className="space-y-6">
      <SectionCard title="Incoming requests" description={`${requests.filter(r => r.status === "pending").length} pending`}>
        <ul className="divide-y divide-border/60">
          {requests.map((r) => (
            <li key={r.id} className="py-4 flex items-start gap-4">
              <Database className="h-5 w-5 mt-1 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm font-medium">{r.dataset}</span>
                  <Badge variant="outline" className="text-[10px]">from {r.fromApp}</Badge>
                  <Badge variant="outline" className={cn(
                    "text-[10px]",
                    r.status === "pending" && "border-warning/40 text-warning",
                    r.status === "approved" && "border-success/40 text-success",
                    r.status === "rejected" && "border-destructive/40 text-destructive",
                  )}>{r.status}</Badge>
                </div>
                <div className="mt-1 text-sm text-muted-foreground">{r.purpose}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {r.recordCount.toLocaleString()} records · requested {timeAgo(r.requestedAt)}
                </div>
              </div>
              {r.status === "pending" && (
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => { store.setRequestStatus(r.id, "rejected"); toast.message("Request rejected"); }}>
                    <X className="h-3.5 w-3.5" />Reject
                  </Button>
                  <Button size="sm" onClick={() => { store.setRequestStatus(r.id, "approved"); toast.success(`Approved · ${r.dataset}`); }}>
                    <Check className="h-3.5 w-3.5" />Approve
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="Published datasets" description="Outbound data products consumed by partner apps">
        <div className="grid sm:grid-cols-2 gap-3">
          {initialPublishedDatasets.map((d) => (
            <div key={d.id} className="rounded-lg border border-border/60 bg-secondary/30 p-4">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-medium">{d.name}</span>
                <Badge variant="outline" className={cn(
                  "text-[10px]",
                  d.status === "active" ? "border-success/40 text-success" : "border-muted-foreground/40 text-muted-foreground",
                )}>{d.status}</Badge>
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">{d.description}</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {d.schema.map((s) => (
                  <code key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-background/60 border border-border/60 font-mono">{s}</code>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>{d.consumers.length} consumer{d.consumers.length !== 1 ? "s" : ""}</span>
                <span>{d.recordCount.toLocaleString()} records</span>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
