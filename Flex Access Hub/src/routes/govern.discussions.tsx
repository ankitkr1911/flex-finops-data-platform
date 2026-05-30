import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AtSign, Building2, CheckCheck, MessageSquare, Paperclip, Send,
  Sparkles, Users,
} from "lucide-react";
import { z } from "zod";
import { SectionCard, timeAgo } from "@/components/Primitives";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { connectedApps } from "@/lib/mockData";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/govern/discussions")({
  validateSearch: (s) => z.object({ partner: z.string().optional() }).parse(s),
  head: () => ({
    meta: [
      { title: "Discussions — Flex" },
      { name: "description", content: "Direct discussion threads between Flex teams and partner apps." },
    ],
  }),
  component: Discussions,
});

type Message = {
  id: string;
  author: string;
  role: "you" | "team" | "partner" | "system";
  initials: string;
  body: string;
  at: string; // iso
  read?: boolean;
};

type Thread = {
  partnerId: string;
  topic: string;
  context: string;
  participants: string[];
  unread: number;
  messages: Message[];
};

const SEED: Thread[] = [
  {
    partnerId: "eztrac",
    topic: "Q3 forecast — spend export schema",
    context: "Dataset · monthly_spend_by_service",
    participants: ["S. Chen", "M. Patel", "EzTrac Bot"],
    unread: 2,
    messages: [
      { id: "m1", author: "EzTrac Bot", role: "partner", initials: "EZ", body: "We need `region` granularity added to the monthly export — current rollup hides west-coast variance.", at: "2026-05-22T07:55:00Z", read: true },
      { id: "m2", author: "S. Chen", role: "you", initials: "SC", body: "Adding region in v2 of the schema. Can ship Thursday — does that work for the forecast cycle?", at: "2026-05-22T08:10:00Z", read: true },
      { id: "m3", author: "M. Patel", role: "team", initials: "MP", body: "Heads up: enabling region will roughly 5× the row count. EzTrac, can your ingest handle ~180K rows/mo?", at: "2026-05-22T08:21:00Z" },
      { id: "m4", author: "EzTrac Bot", role: "partner", initials: "EZ", body: "Yes — we batch-ingest in 10K chunks. Ship it.", at: "2026-05-22T08:34:00Z" },
    ],
  },
  {
    partnerId: "dhub-rpt",
    topic: "Capacity planning — ML Platform overrun",
    context: "Alignment · INIT-AI-RND",
    participants: ["S. Chen", "R. Nakamura", "dhub-rpt"],
    unread: 0,
    messages: [
      { id: "m1", author: "dhub-rpt", role: "partner", initials: "DH", body: "ML Platform reporting 118% capacity. Recommending +2 GPU units allocation.", at: "2026-05-21T14:30:00Z", read: true },
      { id: "m2", author: "R. Nakamura", role: "team", initials: "RN", body: "Confirmed — GPU spend up 34%. Approving the bump from FinOps side.", at: "2026-05-21T15:02:00Z", read: true },
      { id: "m3", author: "S. Chen", role: "you", initials: "SC", body: "Logged · routed to chargeback under CC-4500.", at: "2026-05-21T15:10:00Z", read: true },
    ],
  },
  {
    partnerId: "snowflake",
    topic: "Tag compliance audit results",
    context: "Dataset · tag_compliance_audit",
    participants: ["L. Kim", "Snowflake Sync"],
    unread: 1,
    messages: [
      { id: "m1", author: "Snowflake Sync", role: "partner", initials: "SN", body: "Audit complete — 12 warehouses missing `cost_center` tag.", at: "2026-05-22T09:12:00Z" },
    ],
  },
  {
    partnerId: "okta",
    topic: "RBAC handshake — pending approval",
    context: "Integration · Identity sync",
    participants: ["S. Chen", "Okta"],
    unread: 0,
    messages: [
      { id: "m1", author: "System", role: "system", initials: "·", body: "Okta integration is pending — awaiting admin handshake.", at: "2026-05-22T06:00:00Z", read: true },
    ],
  },
];

function partnerName(id: string) {
  return connectedApps.find((a) => a.id === id)?.name ?? id;
}

function Discussions() {
  const { partner } = Route.useSearch();
  const [threads, setThreads] = useState<Thread[]>(SEED);
  const [activeId, setActiveId] = useState<string>(partner ?? SEED[0].partnerId);
  const [draft, setDraft] = useState("");

  const active = useMemo(() => threads.find((t) => t.partnerId === activeId) ?? threads[0], [threads, activeId]);

  function send() {
    if (!draft.trim()) return;
    const newMsg: Message = {
      id: `m${Date.now()}`,
      author: "S. Chen",
      role: "you",
      initials: "SC",
      body: draft.trim(),
      at: new Date().toISOString(),
    };
    setThreads((arr) =>
      arr.map((t) => t.partnerId === active.partnerId
        ? { ...t, messages: [...t.messages, newMsg], unread: 0 }
        : t),
    );
    setDraft("");
  }

  return (
    <SectionCard
      className="p-0 overflow-hidden"
      title="Team discussions"
      description="Direct threads between Flex teams and connected partner apps"
    >
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] min-h-[560px] -m-5">
        {/* Thread list */}
        <aside className="border-r border-border/60 bg-secondary/20">
          <div className="p-3 border-b border-border/60 flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {threads.length} threads
            </div>
            <Button size="icon" variant="ghost" className="h-7 w-7">
              <MessageSquare className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="divide-y divide-border/60">
            {threads.map((t) => {
              const last = t.messages[t.messages.length - 1];
              const isActive = t.partnerId === active.partnerId;
              return (
                <button
                  key={t.partnerId}
                  onClick={() => {
                    setActiveId(t.partnerId);
                    setThreads((arr) => arr.map((x) => x.partnerId === t.partnerId ? { ...x, unread: 0 } : x));
                  }}
                  className={cn(
                    "w-full text-left px-4 py-3 transition-colors",
                    isActive ? "bg-primary/10" : "hover:bg-secondary/40",
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="grid h-9 w-9 place-items-center rounded-lg bg-background border border-border/60 text-primary shrink-0">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium truncate">{partnerName(t.partnerId)}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(last.at)}</span>
                      </div>
                      <div className="text-[11px] text-primary/80 truncate">{t.topic}</div>
                      <div className="mt-1 text-xs text-muted-foreground truncate">{last.body}</div>
                    </div>
                    {t.unread > 0 && (
                      <Badge className="h-5 min-w-5 px-1.5 text-[10px] shrink-0">{t.unread}</Badge>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Conversation pane */}
        <section className="flex flex-col h-full">
          <header className="px-5 py-3 border-b border-border/60 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-display text-base font-semibold">{partnerName(active.partnerId)}</span>
                <Badge variant="outline" className="text-[10px]">{active.context}</Badge>
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">{active.topic}</div>
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Users className="h-3 w-3" />
                {active.participants.join(" · ")}
              </div>
            </div>
            <Button size="sm" variant="outline" className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              AI summary
            </Button>
          </header>

          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-background/40">
            {active.messages.map((m) => {
              const mine = m.role === "you";
              if (m.role === "system") {
                return (
                  <div key={m.id} className="text-center">
                    <span className="text-[11px] text-muted-foreground bg-secondary/40 px-3 py-1 rounded-full">
                      {m.body} · {timeAgo(m.at)}
                    </span>
                  </div>
                );
              }
              return (
                <div key={m.id} className={cn("flex gap-3", mine && "flex-row-reverse")}>
                  <div className={cn(
                    "grid h-8 w-8 place-items-center rounded-full text-[11px] font-semibold shrink-0",
                    m.role === "you" && "bg-primary text-primary-foreground",
                    m.role === "team" && "bg-secondary text-foreground",
                    m.role === "partner" && "bg-accent text-accent-foreground",
                  )}>
                    {m.initials}
                  </div>
                  <div className={cn("max-w-[70%]", mine && "items-end flex flex-col")}>
                    <div className={cn(
                      "flex items-center gap-2 text-[11px] text-muted-foreground mb-1",
                      mine && "flex-row-reverse",
                    )}>
                      <span className="font-medium text-foreground/80">{m.author}</span>
                      <span>{timeAgo(m.at)}</span>
                      {m.role === "partner" && <Badge variant="outline" className="text-[9px] h-4 px-1.5">Partner</Badge>}
                    </div>
                    <div className={cn(
                      "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed border",
                      mine
                        ? "bg-primary text-primary-foreground border-primary/40 rounded-tr-sm"
                        : "bg-card border-border/60 rounded-tl-sm",
                    )}>
                      {m.body}
                    </div>
                    {mine && m.read && (
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                        <CheckCheck className="h-3 w-3" /> Read
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <footer className="border-t border-border/60 p-3 bg-card">
            <div className="flex items-end gap-2">
              <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0">
                <Paperclip className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0">
                <AtSign className="h-4 w-4" />
              </Button>
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder={`Message ${partnerName(active.partnerId)}…`}
                className="h-9"
              />
              <Button onClick={send} size="sm" className="gap-1.5 h-9">
                <Send className="h-3.5 w-3.5" />
                Send
              </Button>
            </div>
          </footer>
        </section>
      </div>
    </SectionCard>
  );
}
