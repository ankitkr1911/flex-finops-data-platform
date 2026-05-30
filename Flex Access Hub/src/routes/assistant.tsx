import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Check,
  Copy,
  Download,
  Eraser,
  FileJson,
  Files,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Pin,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Send,
  Share2,
  Sparkles,
  Square,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  User,
} from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { PageHeader } from "@/components/Primitives";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { askFlexAI } from "@/lib/ai.functions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/assistant")({
  head: () => ({
    meta: [
      { title: "AI assistant - Flex" },
      { name: "description", content: "Ask Flex AI about spend, anomalies, savings, and governance." },
    ],
  }),
  component: Assistant,
});

type Msg = { role: "user" | "assistant"; content: string };
type AssistantStatus = "thinking" | "retrieving" | "analyzing" | "composing" | "streaming" | "complete" | "error";
type MessageFeedback = "up" | "down";
type ChatMsg = Msg & {
  id: string;
  createdAt: string;
  displayedContent?: string;
  status?: AssistantStatus;
  feedback?: MessageFeedback;
  feedbackNote?: string;
  userComment?: string;
  followUps?: string[];
};
type ChatSession = {
  id: string;
  title: string;
  messages: ChatMsg[];
  updatedAt: string;
  pinned?: boolean;
};

const markdownComponents: Components = {
  h2: ({ children }) => (
    <h2 className="mb-3 mt-1 font-display text-lg font-semibold text-foreground">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 mt-4 font-display text-sm font-semibold uppercase tracking-wide text-primary">
      {children}
    </h3>
  ),
  p: ({ children }) => <p className="my-2 leading-6 text-foreground/90">{children}</p>,
  ul: ({ children }) => <ul className="my-3 space-y-1.5 pl-0">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 list-decimal space-y-1.5 pl-5 marker:text-primary">{children}</ol>,
  li: ({ children }) => (
    <li className="ml-4 leading-6 text-foreground/90 marker:text-primary">
      {children}
    </li>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-3 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-foreground/90">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="my-4 max-w-full overflow-x-auto rounded-lg border border-border/70 bg-card/60">
      <table className="w-full min-w-[620px] border-collapse text-left text-xs">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-secondary/80 text-muted-foreground">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-border/60">{children}</tbody>,
  tr: ({ children }) => <tr className="align-top">{children}</tr>,
  th: ({ children }) => (
    <th className="whitespace-nowrap px-3 py-2 font-semibold uppercase tracking-wide">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="px-3 py-2 text-foreground/90">{children}</td>,
  code: ({ children }) => (
    <code className="rounded-md border border-border/60 bg-secondary/70 px-1.5 py-0.5 font-mono text-[0.85em] text-primary">
      {children}
    </code>
  ),
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
};

const CHAT_STORAGE_KEY = "flex_ai_chat_sessions_v2";

const SUGGESTIONS = [
  "What should I do about my critical EC2 anomaly?",
  "Which teams are over budget this month?",
  "Explain the difference between chargeback and showback.",
  "How do I increase Savings Plan coverage safely?",
  "Summarize pending data exchange approvals.",
  "Draft a savings plan rollout checklist.",
];

const PHASE_DELAYS: Record<Exclude<AssistantStatus, "streaming" | "complete" | "error">, [number, number]> = {
  thinking: [500, 900],
  retrieving: [450, 800],
  analyzing: [400, 700],
  composing: [350, 650],
};

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function now(): string {
  return new Date().toISOString();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function charDelay(char: string, prev: string): number {
  if (char === " ") return 6;
  if (char === "\n") return 18;
  if (".!?".includes(char)) return 42;
  if (",;:".includes(char)) return 24;
  if (prev === " ") return 10;
  return 10 + Math.random() * 8;
}

function titleFromQuery(query: string): string {
  const trimmed = query.trim();
  return trimmed.length > 46 ? `${trimmed.slice(0, 46)}...` : trimmed || "New conversation";
}

function phaseLabel(status?: AssistantStatus): string {
  switch (status) {
    case "thinking":
      return "Thinking";
    case "retrieving":
      return "Searching knowledge base";
    case "analyzing":
      return "Analyzing context";
    case "composing":
      return "Composing answer";
    case "streaming":
      return "Writing";
    case "error":
      return "Something went wrong";
    default:
      return "";
  }
}

function normalizeSession(value: unknown): ChatSession | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<ChatSession>;
  const id = typeof raw.id === "string" && raw.id ? raw.id : uid();
  const messages = Array.isArray(raw.messages)
    ? raw.messages
        .filter((m): m is Partial<ChatMsg> => Boolean(m) && typeof m === "object")
        .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
        .map((m) => ({
          id: typeof m.id === "string" && m.id ? m.id : uid(),
          role: m.role as "user" | "assistant",
          content: m.content ?? "",
          createdAt: typeof m.createdAt === "string" ? m.createdAt : now(),
          displayedContent: typeof m.displayedContent === "string" ? m.displayedContent : undefined,
          status: m.role === "assistant" ? m.status ?? "complete" : undefined,
          feedback: m.feedback,
          feedbackNote: typeof m.feedbackNote === "string" ? m.feedbackNote : undefined,
          userComment: typeof m.userComment === "string" ? m.userComment : undefined,
          followUps: Array.isArray(m.followUps)
            ? m.followUps.filter((item): item is string => typeof item === "string").slice(0, 4)
            : undefined,
        }))
    : [];

  return {
    id,
    title: typeof raw.title === "string" && raw.title.trim() ? raw.title : "New conversation",
    messages,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : now(),
    pinned: Boolean(raw.pinned),
  };
}

function loadSessions(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return sortSessions(parsed.map(normalizeSession).filter((s): s is ChatSession => Boolean(s)));
  } catch {
    return [];
  }
}

function saveSessions(sessions: ChatSession[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // Keep the chat usable if storage quota or privacy settings block persistence.
  }
}

function sortSessions(sessions: ChatSession[]): ChatSession[] {
  return [...sessions].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

function stripMarkdownBold(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, "$1");
}

function normalizeAssistantMarkdown(text: string): string {
  return text.replace(/<br\s*\/?>/gi, " / ");
}

function sessionToMarkdown(session: ChatSession): string {
  const blocks = session.messages.map((m) => {
    const role = m.role === "user" ? "You" : "Flex AI";
    const lines = [`### ${role} - ${new Date(m.createdAt).toLocaleString()}`, "", stripMarkdownBold(m.content)];
    if (m.feedback) {
      lines.push("", `> Feedback: ${m.feedback === "up" ? "Helpful" : "Needs work"}`);
      if (m.feedbackNote) lines.push(`> Detail: ${m.feedbackNote}`);
    }
    if (m.userComment) lines.push("", `> Note: ${m.userComment}`);
    if (m.followUps?.length) {
      lines.push("", "> Follow-ups:");
      m.followUps.forEach((followUp) => lines.push(`> - ${followUp}`));
    }
    return lines.join("\n");
  });

  return [
    `# Flex AI - ${session.title}`,
    "",
    `_Exported ${new Date().toLocaleString()}_`,
    `_Session updated ${new Date(session.updatedAt).toLocaleString()}_`,
    "",
    "---",
    "",
    ...blocks.flatMap((block) => [block, ""]),
    "---",
    "",
    "_Generated from Flex AI assistant._",
  ].join("\n");
}

function safeFileName(title: string): string {
  return title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 48) || "chat";
}

function downloadBlob(content: string, filename: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadMarkdown(session: ChatSession): void {
  downloadBlob(
    sessionToMarkdown(session),
    `flex-ai-${safeFileName(session.title)}-${new Date().toISOString().slice(0, 10)}.md`,
    "text/markdown;charset=utf-8",
  );
}

function downloadJson(session: ChatSession): void {
  downloadBlob(
    JSON.stringify(session, null, 2),
    `flex-ai-${safeFileName(session.title)}.json`,
    "application/json;charset=utf-8",
  );
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function printSession(session: ChatSession): boolean {
  const popup = window.open("", "_blank", "width=980,height=860");
  if (!popup) return false;
  const rows = session.messages
    .map((m) => {
      const role = m.role === "user" ? "You" : "Flex AI";
      return `
        <article class="message ${m.role}">
          <header><strong>${escapeHtml(role)}</strong><span>${escapeHtml(new Date(m.createdAt).toLocaleString())}</span></header>
          <div>${escapeHtml(m.content).replaceAll("\n", "<br />")}</div>
        </article>
      `;
    })
    .join("");
  popup.document.open();
  popup.document.write(`<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Flex AI Chat Export</title>
        <style>
          body { font-family: Arial, sans-serif; color: #0f172a; margin: 28px; }
          h1 { margin: 0 0 6px; font-size: 24px; }
          .meta { color: #475569; font-size: 12px; margin-bottom: 20px; }
          .message { border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px; margin-bottom: 10px; }
          .message header { display: flex; justify-content: space-between; gap: 16px; color: #334155; font-size: 12px; margin-bottom: 8px; }
          .message div { line-height: 1.5; font-size: 14px; }
        </style>
      </head>
      <body>
        <h1>Flex AI - ${escapeHtml(session.title)}</h1>
        <div class="meta">Exported ${escapeHtml(new Date().toLocaleString())}</div>
        ${rows}
      </body>
    </html>`);
  popup.document.close();
  popup.focus();
  popup.print();
  return true;
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall back below.
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

async function shareSession(session: ChatSession): Promise<"shared" | "copied" | "failed"> {
  const url = `${window.location.origin}${window.location.pathname}?chat=${encodeURIComponent(session.id)}`;
  const body = `${sessionToMarkdown(session)}\n\nOpen in Flex: ${url}`;
  const title = `Flex AI: ${session.title}`;
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text: body, url });
      return "shared";
    } catch (err) {
      if ((err as Error).name === "AbortError") return "failed";
    }
  }
  return (await copyText(body)) ? "copied" : "failed";
}

function Assistant() {
  const ask = useServerFn(askFlexAI);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionQuery, setSessionQuery] = useState("");
  const [quickToast, setQuickToast] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef(false);
  const streamRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const linkedChatHandled = useRef(false);

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;
  const messages = activeSession?.messages ?? [];
  const sortedSessions = useMemo(() => sortSessions(sessions), [sessions]);
  const filteredSessions = useMemo(() => {
    const query = sessionQuery.trim().toLowerCase();
    if (!query) return sortedSessions;
    return sortedSessions.filter((s) => {
      if (s.title.toLowerCase().includes(query)) return true;
      return s.messages.some((m) => m.content.toLowerCase().includes(query));
    });
  }, [sessionQuery, sortedSessions]);
  const lastAssistantMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === "assistant") return messages[i].id;
    }
    return null;
  }, [messages]);
  const hasExportableChat = Boolean(activeSession?.messages.length);

  useEffect(() => {
    const loaded = loadSessions();
    setSessions(loaded);
    setActiveSessionId(loaded[0]?.id ?? null);
  }, []);

  useEffect(() => {
    if (linkedChatHandled.current || typeof window === "undefined") return;
    const chatId = new URLSearchParams(window.location.search).get("chat");
    if (!chatId || !sessions.some((s) => s.id === chatId)) return;
    linkedChatHandled.current = true;
    setActiveSessionId(chatId);
  }, [sessions]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 1e9, behavior: "smooth" });
  }, [messages]);

  function flash(message: string) {
    setQuickToast(message);
    window.setTimeout(() => setQuickToast(null), 2300);
  }

  function persistSessions(updater: ChatSession[] | ((prev: ChatSession[]) => ChatSession[])) {
    setSessions((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveSessions(next);
      return next;
    });
  }

  function updateSession(sessionId: string, updater: (session: ChatSession) => ChatSession) {
    persistSessions((prev) => prev.map((s) => (s.id === sessionId ? updater(s) : s)));
  }

  function patchMessage(sessionId: string, messageId: string, patch: Partial<ChatMsg>) {
    updateSession(sessionId, (session) => ({
      ...session,
      updatedAt: now(),
      messages: session.messages.map((m) => (m.id === messageId ? { ...m, ...patch } : m)),
    }));
  }

  function startNewChat() {
    stopGenerating();
    const session: ChatSession = {
      id: uid(),
      title: "New conversation",
      messages: [],
      updatedAt: now(),
    };
    persistSessions((prev) => [session, ...prev]);
    setActiveSessionId(session.id);
    setInput("");
  }

  function deleteSession(sessionId: string) {
    const target = sessions.find((s) => s.id === sessionId);
    if (target?.messages.length && !window.confirm("Delete this chat?")) return;
    const remaining = sortedSessions.filter((s) => s.id !== sessionId);
    persistSessions((prev) => prev.filter((s) => s.id !== sessionId));
    if (activeSessionId === sessionId) setActiveSessionId(remaining[0]?.id ?? null);
  }

  function stopGenerating() {
    abortRef.current = true;
    if (streamRef.current) {
      clearTimeout(streamRef.current);
      streamRef.current = null;
    }
    const currentAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    if (activeSessionId && currentAssistant && currentAssistant.status !== "complete") {
      const partial = currentAssistant.displayedContent || currentAssistant.content || "Stopped.";
      patchMessage(activeSessionId, currentAssistant.id, {
        content: partial,
        displayedContent: partial,
        status: "complete",
      });
    }
    setLoading(false);
  }

  async function runAssistantReply(sessionId: string, assistantId: string, context: ChatMsg[]) {
    abortRef.current = false;
    setLoading(true);
    patchMessage(sessionId, assistantId, {
      content: "",
      displayedContent: "",
      status: "thinking",
      feedback: undefined,
      feedbackNote: undefined,
      userComment: undefined,
      followUps: undefined,
    });

    try {
      for (const phase of ["thinking", "retrieving", "analyzing", "composing"] as const) {
        if (abortRef.current) return;
        patchMessage(sessionId, assistantId, { status: phase });
        const [min, max] = PHASE_DELAYS[phase];
        await delay(randomBetween(min, max));
      }

      if (abortRef.current) return;

      const payload: Msg[] = context
        .filter((m) => m.role === "user" || (m.role === "assistant" && m.content.trim()))
        .slice(-40)
        .map((m) => ({ role: m.role, content: m.content }));

      const { content, followUps } = await ask({ data: { messages: payload } });
      const answer = content || "I could not generate a response.";
      const nextFollowUps = Array.isArray(followUps)
        ? followUps.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 4)
        : [];

      patchMessage(sessionId, assistantId, { content: answer, displayedContent: "", status: "streaming", followUps: nextFollowUps });

      await new Promise<void>((resolve) => {
        let index = 0;
        const tick = () => {
          if (abortRef.current) {
            resolve();
            return;
          }
          index += 1;
          const slice = answer.slice(0, index);
          const done = index >= answer.length;
          patchMessage(sessionId, assistantId, {
            displayedContent: slice,
            status: done ? "complete" : "streaming",
          });
          if (done) {
            patchMessage(sessionId, assistantId, { displayedContent: answer, status: "complete", followUps: nextFollowUps });
            resolve();
            return;
          }
          const prev = answer[index - 2] ?? "";
          const ch = answer[index - 1] ?? "";
          streamRef.current = setTimeout(tick, charDelay(ch, prev));
        };
        tick();
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      const friendly =
        "I could not complete that response. Please retry, or ask a specific FinOps question about anomalies, budget, savings, requests, or datasets.";
      toast.error(msg);
      patchMessage(sessionId, assistantId, {
        content: friendly,
        displayedContent: friendly,
        status: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const timestamp = now();
    const sessionId = activeSession?.id ?? uid();
    const baseMessages = activeSession?.messages ?? [];
    const userMsg: ChatMsg = { id: uid(), role: "user", content: trimmed, createdAt: timestamp };
    const assistantId = uid();
    const assistantMsg: ChatMsg = {
      id: assistantId,
      role: "assistant",
      content: "",
      createdAt: now(),
      displayedContent: "",
      status: "thinking",
    };

    persistSessions((prev) => {
      const existing = prev.find((s) => s.id === sessionId);
      if (!existing) {
        return [
          {
            id: sessionId,
            title: titleFromQuery(trimmed),
            messages: [userMsg, assistantMsg],
            updatedAt: now(),
          },
          ...prev,
        ];
      }
      return prev.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              title: s.messages.length === 0 || s.title === "New conversation" ? titleFromQuery(trimmed) : s.title,
              updatedAt: now(),
              messages: [...s.messages, userMsg, assistantMsg],
            }
          : s,
      );
    });
    setActiveSessionId(sessionId);
    setInput("");

    await runAssistantReply(sessionId, assistantId, [...baseMessages, userMsg]);
  }

  async function regenerateLastResponse() {
    if (!activeSession || !activeSessionId || loading) return;
    const assistantIndex = activeSession.messages.findLastIndex((m) => m.role === "assistant");
    if (assistantIndex < 1) return;
    const previous = activeSession.messages[assistantIndex - 1];
    if (previous.role !== "user") return;
    await runAssistantReply(activeSessionId, activeSession.messages[assistantIndex].id, activeSession.messages.slice(0, assistantIndex));
  }

  function clearConversation() {
    if (!activeSessionId || !activeSession?.messages.length) return;
    if (!window.confirm("Clear all messages in this chat?")) return;
    updateSession(activeSessionId, (s) => ({
      ...s,
      title: "New conversation",
      messages: [],
      updatedAt: now(),
    }));
  }

  function renameSession() {
    if (!activeSessionId || !activeSession) return;
    const title = window.prompt("Rename chat", activeSession.title);
    if (!title?.trim()) return;
    updateSession(activeSessionId, (s) => ({ ...s, title: title.trim(), updatedAt: now() }));
  }

  function duplicateSession() {
    if (!activeSession) return;
    const copy: ChatSession = {
      ...activeSession,
      id: uid(),
      title: `Copy of ${activeSession.title}`,
      messages: activeSession.messages.map((m) => ({ ...m, id: uid() })),
      updatedAt: now(),
      pinned: false,
    };
    persistSessions((prev) => [copy, ...prev]);
    setActiveSessionId(copy.id);
    flash("Chat duplicated");
  }

  function togglePinSession(sessionId: string) {
    updateSession(sessionId, (s) => ({ ...s, pinned: !s.pinned, updatedAt: now() }));
  }

  function setMessageFeedback(messageId: string, feedback: MessageFeedback, feedbackNote?: string) {
    if (!activeSessionId) return;
    patchMessage(activeSessionId, messageId, { feedback, feedbackNote });
    flash(feedback === "up" ? "Feedback saved" : "Thanks, feedback saved");
  }

  function setMessageComment(messageId: string, userComment: string) {
    if (!activeSessionId) return;
    patchMessage(activeSessionId, messageId, { userComment: userComment.trim() || undefined });
    flash("Note saved");
  }

  const sessionSidebar = (
    <>
      <div className="border-b border-border/60 p-3">
        <Button type="button" size="sm" className="w-full" onClick={startNewChat}>
          <Plus className="h-3.5 w-3.5" />
          New chat
        </Button>
      </div>
      <div className="border-b border-border/50 p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={sessionQuery}
            onChange={(e) => setSessionQuery(e.target.value)}
            placeholder="Search chats..."
            className="h-8 w-full rounded-md border border-border/60 bg-background/50 pl-8 pr-3 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {filteredSessions.length === 0 ? (
          <p className="px-2 py-4 text-xs text-muted-foreground">
            {sessionQuery ? "No matching chats." : "No conversations yet."}
          </p>
        ) : (
          filteredSessions.map((session) => (
            <div
              key={session.id}
              className={cn(
                "group mb-1 flex items-center gap-1 rounded-lg",
                session.id === activeSessionId && "bg-primary/10",
              )}
            >
              <button
                type="button"
                onClick={() => setActiveSessionId(session.id)}
                className={cn(
                  "min-w-0 flex-1 rounded-lg px-2.5 py-2 text-left text-xs transition-colors hover:bg-accent/40",
                  session.id === activeSessionId ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {session.pinned ? <Pin className="h-3.5 w-3.5 shrink-0" /> : <MessageSquare className="h-3.5 w-3.5 shrink-0" />}
                  <span className="truncate">{session.title}</span>
                </span>
                <span className="mt-0.5 block truncate text-[10px] opacity-70">
                  {new Date(session.updatedAt).toLocaleDateString()}
                </span>
              </button>
              <button
                type="button"
                onClick={() => togglePinSession(session.id)}
                className={cn(
                  "rounded-md p-1.5 text-muted-foreground opacity-100 transition-all hover:text-primary sm:opacity-0 sm:group-hover:opacity-100",
                  session.pinned && "text-primary opacity-100",
                )}
                aria-label={session.pinned ? "Unpin chat" : "Pin chat"}
                title={session.pinned ? "Unpin chat" : "Pin chat"}
              >
                <Pin className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => deleteSession(session.id)}
                className="mr-1 rounded-md p-1.5 text-muted-foreground opacity-100 transition-all hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100"
                aria-label="Delete chat"
                title="Delete chat"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
      <div className="border-t border-border/50 p-3 text-[10px] text-muted-foreground">
        Chats are saved locally in this browser.
      </div>
    </>
  );

  return (
    <div className="h-[calc(100vh-4rem)] px-4 py-6 lg:px-8">
      <div className="mx-auto flex h-full max-w-6xl flex-col gap-4">
        <PageHeader
          eyebrow="Tools"
          title="Flex AI assistant"
          description="Powered by Lovable AI. Ask about spend, anomalies, savings or governance."
          actions={
            <AssistantToolbar
              session={activeSession}
              hasExportableChat={hasExportableChat}
              loading={loading}
              quickToast={quickToast}
              onNewChat={startNewChat}
              onDownloadMarkdown={() => {
                if (!activeSession) return;
                downloadMarkdown(activeSession);
                flash("Markdown downloaded");
              }}
              onPrint={() => {
                if (!activeSession) return;
                flash(printSession(activeSession) ? "Print dialog opened" : "Popup blocked");
              }}
              onCopy={async () => {
                if (!activeSession) return;
                flash((await copyText(sessionToMarkdown(activeSession))) ? "Copied chat" : "Copy failed");
              }}
              onExportJson={() => {
                if (!activeSession) return;
                downloadJson(activeSession);
                flash("JSON exported");
              }}
              onShare={async () => {
                if (!activeSession) return;
                const result = await shareSession(activeSession);
                flash(result === "shared" ? "Shared" : result === "copied" ? "Copied share text" : "Share cancelled");
              }}
              onRegenerate={regenerateLastResponse}
              onClear={clearConversation}
              onRename={renameSession}
              onDuplicate={duplicateSession}
              onTogglePin={() => activeSessionId && togglePinSession(activeSessionId)}
              canRegenerate={Boolean(lastAssistantMessageId)}
            />
          }
        />

        <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border/60 bg-card/50 shadow-elev">
          <div className="flex h-full min-h-0">
            <aside className="hidden w-64 shrink-0 flex-col border-r border-border/60 bg-background/20 md:flex">
              {sessionSidebar}
            </aside>

            <section className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-center gap-2 border-b border-border/50 p-2 md:hidden">
                <select
                  value={activeSessionId ?? ""}
                  onChange={(e) => setActiveSessionId(e.target.value || null)}
                  className="min-w-0 flex-1 rounded-md border border-border/60 bg-background px-2 py-1.5 text-xs text-foreground outline-none"
                  aria-label="Select chat"
                >
                  <option value="">Current chat</option>
                  {sortedSessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.title}
                    </option>
                  ))}
                </select>
                <Button type="button" variant="outline" size="sm" onClick={startNewChat}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
                {messages.length === 0 ? (
                  <div className="flex min-h-full flex-col items-center justify-center py-10 text-center">
                    <div className="inline-grid h-14 w-14 place-items-center rounded-2xl bg-primary/15 text-primary ring-brand">
                      <Sparkles className="h-7 w-7" />
                    </div>
                    <h2 className="mt-5 font-display text-2xl font-bold">How can I help?</h2>
                    <p className="mt-1.5 text-sm text-muted-foreground">Try one of these:</p>
                    <div className="mt-6 grid w-full max-w-2xl gap-2 sm:grid-cols-2">
                      {SUGGESTIONS.map((suggestion) => (
                        <button
                          key={suggestion}
                          onClick={() => send(suggestion)}
                          disabled={loading}
                          className="rounded-lg border border-border/60 bg-background/35 px-4 py-3 text-left text-sm transition-colors hover:border-primary/40 hover:bg-card/80 disabled:opacity-50"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mx-auto w-full max-w-3xl space-y-5 pb-4">
                    {messages.map((message) => (
                      <Bubble
                        key={message.id}
                        msg={message}
                        isLastAssistant={message.id === lastAssistantMessageId}
                        onFeedback={(feedback, note) => setMessageFeedback(message.id, feedback, note)}
                        onComment={(comment) => setMessageComment(message.id, comment)}
                        onRegenerate={regenerateLastResponse}
                        onFollowUp={(followUp) => void send(followUp)}
                        onFlash={flash}
                      />
                    ))}
                  </div>
                )}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void send(input);
                }}
                className="border-t border-border/50 bg-background/40 p-3 sm:p-4"
              >
                <div className="mx-auto max-w-3xl rounded-xl border border-border/60 bg-card p-2 shadow-elev focus-within:border-primary/40">
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void send(input);
                      }
                      if (e.key === "Escape" && loading) {
                        e.preventDefault();
                        stopGenerating();
                      }
                    }}
                    placeholder="Ask about your cloud spend, anomalies, savings..."
                    rows={2}
                    className="resize-none border-0 bg-transparent px-2 focus-visible:ring-0"
                  />
                  <div className="flex items-center justify-between gap-2 px-2 pb-1">
                    <span className="truncate text-[11px] text-muted-foreground">
                      {loading ? "Esc or Stop to cancel" : "Enter to send - Shift+Enter for newline"}
                    </span>
                    {loading ? (
                      <Button type="button" size="sm" variant="destructive" onClick={stopGenerating}>
                        <Square className="h-3.5 w-3.5" />
                        Stop
                      </Button>
                    ) : (
                      <Button type="submit" size="sm" disabled={!input.trim()}>
                        <Send className="h-3.5 w-3.5" />
                        Send
                      </Button>
                    )}
                  </div>
                </div>
              </form>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function AssistantToolbar({
  session,
  hasExportableChat,
  loading,
  quickToast,
  canRegenerate,
  onNewChat,
  onDownloadMarkdown,
  onPrint,
  onCopy,
  onExportJson,
  onShare,
  onRegenerate,
  onClear,
  onRename,
  onDuplicate,
  onTogglePin,
}: {
  session: ChatSession | null;
  hasExportableChat: boolean;
  loading: boolean;
  quickToast: string | null;
  canRegenerate: boolean;
  onNewChat: () => void;
  onDownloadMarkdown: () => void;
  onPrint: () => void;
  onCopy: () => void | Promise<void>;
  onExportJson: () => void;
  onShare: () => void | Promise<void>;
  onRegenerate: () => void | Promise<void>;
  onClear: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onTogglePin: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {quickToast && (
        <span className="mr-1 hidden items-center gap-1 text-[10px] text-success sm:flex">
          <Check className="h-3 w-3" />
          {quickToast}
        </span>
      )}
      <Button type="button" variant="outline" size="sm" onClick={onNewChat} title="Start a new chat">
        <Plus className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">New chat</span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={!hasExportableChat}
        onClick={onDownloadMarkdown}
        title="Download chat as Markdown"
      >
        <Download className="h-3.5 w-3.5" />
        <span className="hidden lg:inline">MD</span>
      </Button>
      <Button type="button" variant="ghost" size="sm" disabled={!hasExportableChat} onClick={onPrint} title="Print or save as PDF">
        <Printer className="h-3.5 w-3.5" />
        <span className="hidden lg:inline">PDF</span>
      </Button>
      <Button type="button" variant="ghost" size="sm" disabled={!hasExportableChat} onClick={onCopy} title="Copy chat as Markdown">
        <Copy className="h-3.5 w-3.5" />
        <span className="hidden lg:inline">Copy</span>
      </Button>
      <Button type="button" variant="ghost" size="sm" disabled={!hasExportableChat} onClick={onExportJson} title="Export chat as JSON">
        <FileJson className="h-3.5 w-3.5" />
        <span className="hidden lg:inline">JSON</span>
      </Button>
      <Button type="button" variant="ghost" size="sm" disabled={!hasExportableChat} onClick={onShare} title="Share chat">
        <Share2 className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Share</span>
      </Button>
      <ChatMoreMenu
        session={session}
        loading={loading}
        canRegenerate={canRegenerate}
        onRegenerate={onRegenerate}
        onClear={onClear}
        onRename={onRename}
        onDuplicate={onDuplicate}
        onTogglePin={onTogglePin}
      />
    </div>
  );
}

function ChatMoreMenu({
  session,
  loading,
  canRegenerate,
  onRegenerate,
  onClear,
  onRename,
  onDuplicate,
  onTogglePin,
}: {
  session: ChatSession | null;
  loading: boolean;
  canRegenerate: boolean;
  onRegenerate: () => void | Promise<void>;
  onClear: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onTogglePin: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (!session || session.messages.length === 0) return null;

  const items = [
    {
      label: "Regenerate last answer",
      icon: RefreshCw,
      disabled: !canRegenerate || loading,
      onClick: onRegenerate,
    },
    { label: "Clear conversation", icon: Eraser, disabled: false, onClick: onClear },
    { label: "Rename chat", icon: Pencil, disabled: false, onClick: onRename },
    { label: "Duplicate chat", icon: Files, disabled: false, onClick: onDuplicate },
    { label: session.pinned ? "Unpin chat" : "Pin chat", icon: Pin, disabled: false, onClick: onTogglePin },
    { label: "Print page", icon: Printer, disabled: false, onClick: () => window.print() },
  ];

  return (
    <div ref={menuRef} className="relative">
      <Button type="button" variant="ghost" size="icon" onClick={() => setOpen((value) => !value)} aria-label="More chat actions">
        <MoreHorizontal className="h-4 w-4" />
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-1 w-56 overflow-hidden rounded-lg border border-border/70 bg-popover shadow-elev">
          {items.map(({ label, icon: Icon, disabled, onClick }) => (
            <button
              key={label}
              type="button"
              disabled={disabled}
              onClick={() => {
                void onClick();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-popover-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Bubble({
  msg,
  isLastAssistant,
  onFeedback,
  onComment,
  onRegenerate,
  onFollowUp,
  onFlash,
}: {
  msg: ChatMsg;
  isLastAssistant: boolean;
  onFeedback: (feedback: MessageFeedback, note?: string) => void;
  onComment: (comment: string) => void;
  onRegenerate: () => void | Promise<void>;
  onFollowUp: (followUp: string) => void;
  onFlash: (message: string) => void;
}) {
  const [showFeedbackNote, setShowFeedbackNote] = useState(false);
  const [feedbackNote, setFeedbackNote] = useState(msg.feedbackNote ?? "");
  const [showComment, setShowComment] = useState(Boolean(msg.userComment));
  const [comment, setComment] = useState(msg.userComment ?? "");
  const [copied, setCopied] = useState(false);
  const isUser = msg.role === "user";
  const body = msg.role === "assistant" ? msg.displayedContent ?? msg.content : msg.content;
  const renderedBody = msg.role === "assistant" ? normalizeAssistantMarkdown(body) : body;
  const canInteract = msg.role === "assistant" && msg.status === "complete" && Boolean(msg.content);

  useEffect(() => {
    setFeedbackNote(msg.feedbackNote ?? "");
  }, [msg.id, msg.feedbackNote]);

  useEffect(() => {
    setComment(msg.userComment ?? "");
  }, [msg.id, msg.userComment]);

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "grid h-8 w-8 shrink-0 place-items-center rounded-lg",
          isUser ? "bg-secondary" : "bg-primary text-primary-foreground",
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
      </div>
      <div
        className={cn(
          "min-w-0 max-w-[88%] rounded-xl px-4 py-3 sm:max-w-[80%]",
          isUser ? "bg-primary/15 text-foreground" : "border border-border/60 bg-background/45",
        )}
      >
        {!isUser && msg.status && msg.status !== "complete" && (
          <div className={cn("mb-2 text-[11px] text-muted-foreground", msg.status === "error" && "text-destructive")}>
            {phaseLabel(msg.status)}...
          </div>
        )}
        <div className="max-w-none text-sm">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {renderedBody}
          </ReactMarkdown>
        </div>

        {canInteract && (
          <div className="mt-3 border-t border-border/50 pt-2">
            {msg.followUps && msg.followUps.length > 0 && (
              <div className="mb-3 rounded-lg border border-primary/15 bg-primary/5 p-2.5">
                <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                  <Sparkles className="h-3 w-3" />
                  Follow-ups
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {msg.followUps.map((followUp) => (
                    <button
                      key={followUp}
                      type="button"
                      onClick={() => onFollowUp(followUp)}
                      className="rounded-full border border-border/60 bg-background/70 px-2.5 py-1.5 text-left text-[11px] leading-snug text-foreground/85 transition-colors hover:border-primary/50 hover:bg-primary/10 hover:text-foreground"
                    >
                      {followUp}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={async () => {
                  const ok = await copyText(stripMarkdownBold(msg.content));
                  setCopied(ok);
                  onFlash(ok ? "Copied answer" : "Copy failed");
                  window.setTimeout(() => setCopied(false), 1800);
                }}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied" : "Copy"}
              </button>
              {isLastAssistant && (
                <button
                  type="button"
                  onClick={() => void onRegenerate()}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <RefreshCw className="h-3 w-3" />
                  Regenerate
                </button>
              )}
              <span className="mx-1 hidden text-[10px] text-muted-foreground sm:inline">Feedback</span>
              <button
                type="button"
                onClick={() => onFeedback("up")}
                className={cn(
                  "rounded-md p-1.5 transition-colors",
                  msg.feedback === "up" ? "bg-success/15 text-success" : "text-muted-foreground hover:bg-success/10 hover:text-success",
                )}
                aria-label="Helpful"
                title="Helpful"
              >
                <ThumbsUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  onFeedback("down", feedbackNote || undefined);
                  setShowFeedbackNote(true);
                }}
                className={cn(
                  "rounded-md p-1.5 transition-colors",
                  msg.feedback === "down" ? "bg-destructive/15 text-destructive" : "text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
                )}
                aria-label="Needs work"
                title="Needs work"
              >
                <ThumbsDown className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setShowComment((value) => !value)}
                className={cn(
                  "ml-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] transition-colors",
                  msg.userComment ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <MessageSquare className="h-3 w-3" />
                {msg.userComment ? "Edit note" : "Add note"}
              </button>
            </div>

            {(showFeedbackNote || msg.feedback === "down") && (
              <div className="mt-2 flex gap-2">
                <input
                  value={feedbackNote}
                  onChange={(e) => setFeedbackNote(e.target.value)}
                  placeholder="What was missing or wrong?"
                  className="min-w-0 flex-1 rounded-md border border-border/60 bg-background/70 px-2 py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50"
                />
                <button
                  type="button"
                  onClick={() => {
                    onFeedback(msg.feedback ?? "down", feedbackNote);
                    setShowFeedbackNote(false);
                  }}
                  className="rounded-md bg-primary/15 px-2 py-1 text-xs text-primary hover:bg-primary/25"
                >
                  Save
                </button>
              </div>
            )}

            {showComment && (
              <div className="mt-2 space-y-2">
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={2}
                  placeholder="Your note on this answer..."
                  className="w-full resize-none rounded-md border border-border/60 bg-background/70 px-2 py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50"
                />
                <button
                  type="button"
                  onClick={() => {
                    onComment(comment);
                    setShowComment(false);
                  }}
                  className="rounded-md bg-primary/15 px-2 py-1 text-xs text-primary hover:bg-primary/25"
                >
                  Save note
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
