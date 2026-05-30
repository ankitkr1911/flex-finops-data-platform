import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  chargebackRows,
  initialAnomalies,
  initialDataRequests,
  initialPublishedDatasets,
  initialSavings,
  kpis,
} from "./mockData";

const Msg = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1).max(8000),
});

const Input = z.object({
  messages: z.array(Msg).min(1).max(40),
});

const SYSTEM_PROMPT = `You are Flex AI, the assistant for the Flex cloud FinOps platform.
You help users understand cloud spend, anomalies, savings opportunities, chargeback, workforce/infra alignment, and governed data exchange with partner apps (EzTrac for finance forecasting, dhub-rpt for resource planning).

Style:
- Direct, expert, concise. Use polished markdown with short headings, tables, and checklists.
- Reason about FinOps tradeoffs (rightsizing, commitments, tagging, showback).
- When asked for an action, propose 1-3 concrete next steps.
- If you don't have specific data, say so — never invent dollar figures.
- Prefer an executive summary first, then a table, then next actions.

Format with markdown when helpful (tables, lists, **bold**, short code spans for service/account names).`;

type Chunk = {
  id: string;
  text: string;
  tags: string[];
};

type Intent = "anomalies" | "budget" | "savings" | "requests" | "datasets" | "general";

const KNOWLEDGE: Chunk[] = [
  ...initialAnomalies.map((a) => ({
    id: `anomaly:${a.id}`,
    text: `${a.title} | severity=${a.severity} | service=${a.service} | status=${a.status} | impact=${a.impact} | detectedAt=${a.detectedAt}`,
    tags: ["anomaly", a.severity, a.service.toLowerCase(), a.status],
  })),
  ...initialDataRequests.map((r) => ({
    id: `request:${r.id}`,
    text: `data request from ${r.fromApp}: dataset=${r.dataset}, status=${r.status}, purpose=${r.purpose}, records=${r.recordCount}`,
    tags: ["request", r.fromApp.toLowerCase(), r.status, r.dataset.toLowerCase()],
  })),
  ...initialSavings.map((s) => ({
    id: `savings:${s.id}`,
    text: `${s.title} | category=${s.category} | stage=${s.stage} | monthlySavings=$${s.monthlySavings} | confidence=${s.confidence}% | owner=${s.owner}`,
    tags: ["savings", s.category, s.stage, s.owner.toLowerCase()],
  })),
  ...initialPublishedDatasets.map((d) => ({
    id: `dataset:${d.id}`,
    text: `dataset ${d.name}: ${d.description}; status=${d.status}; consumers=${d.consumers.join(", ") || "none"}; records=${d.recordCount}`,
    tags: ["dataset", d.status, d.name.toLowerCase()],
  })),
  ...chargebackRows.map((r) => ({
    id: `team:${r.id}`,
    text: `${r.team} spend=$${r.monthlySpend}, budget=$${r.budget}, forecast=$${r.forecast}, trend=${r.trend}, tagCompliance=${r.tagCompliance}%`,
    tags: ["chargeback", "budget", r.team.toLowerCase(), r.trend],
  })),
];

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s_-]/g, " ").split(/\s+/).filter(Boolean);
}

function detectIntent(query: string): Intent {
  const q = query.toLowerCase();
  if (/\b(anomaly|critical|incident|alert|spike)\b/.test(q)) return "anomalies";
  if (/\b(budget|over budget|team|chargeback|forecast)\b/.test(q)) return "budget";
  if (/\b(save|savings|rightsiz|commitment|spot|waste)\b/.test(q)) return "savings";
  if (/\b(request|approval|approve|reject|exchange|pending)\b/.test(q)) return "requests";
  if (/\b(dataset|schema|publish|consumer|catalog)\b/.test(q)) return "datasets";
  return "general";
}

function retrieve(query: string, topK = 6): Chunk[] {
  const q = tokenize(query);
  if (!q.length) return KNOWLEDGE.slice(0, topK);

  const scored = KNOWLEDGE.map((c) => {
    const hay = `${c.text} ${c.tags.join(" ")}`.toLowerCase();
    let score = 0;
    for (const t of q) {
      if (c.tags.some((tag) => tag.includes(t))) score += 3;
      if (hay.includes(t)) score += 1;
    }
    return { c, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return (scored.length ? scored.map((x) => x.c) : KNOWLEDGE).slice(0, topK);
}

function fmtMoney(v: number): string {
  return `$${v.toLocaleString()}`;
}

function fmtSignedMoney(v: number): string {
  const prefix = v >= 0 ? "+" : "-";
  return `${prefix}${fmtMoney(Math.abs(v))}`;
}

function mdCell(value: unknown): string {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\n/g, " / ");
}

function mdTable(headers: string[], rows: unknown[][]): string[] {
  return [
    `| ${headers.map(mdCell).join(" |")} |`,
    `| ${headers.map(() => "---").join(" |")} |`,
    ...rows.map((row) => `| ${row.map(mdCell).join(" |")} |`),
  ];
}

function chunkKind(id: string): string {
  const [kind] = id.split(":");
  switch (kind) {
    case "anomaly":
      return "Anomaly";
    case "request":
      return "Request";
    case "savings":
      return "Savings";
    case "dataset":
      return "Dataset";
    case "team":
      return "Team";
    default:
      return "Context";
  }
}

function compactContext(text: string): string {
  return text
    .replace(/\s*\|\s*/g, " / ")
    .replace(/\s+/g, " ")
    .slice(0, 220);
}

function pushContextTable(lines: string[], sources: Chunk[]) {
  lines.push("");
  lines.push("### Retrieved context");
  lines.push(
    ...mdTable(
      ["Source", "Why it matched", "Evidence"],
      sources.slice(0, 4).map((s) => [
        `\`${s.id}\``,
        chunkKind(s.id),
        compactContext(s.text),
      ]),
    ),
  );
}

function buildFollowUps(query: string): string[] {
  const intent = detectIntent(query);
  switch (intent) {
    case "anomalies":
      return [
        "Turn this into a 30-minute incident triage plan.",
        "Which owner should take each anomaly next?",
        "Show the fastest savings actions from these anomalies.",
      ];
    case "budget":
      return [
        "Break this down by team owner and action.",
        "Which budget variances are most likely one-time spikes?",
        "Draft a message to over-budget teams.",
      ];
    case "savings":
      return [
        "Create a 2-week savings execution plan.",
        "Which savings need finance approval first?",
        "Compare savings impact versus implementation risk.",
      ];
    case "requests":
      return [
        "Which requests should be approved first?",
        "Draft governance questions for risky requests.",
        "Show the partner impact if these stay pending.",
      ];
    case "datasets":
      return [
        "Which datasets are ready to publish?",
        "Find missing consumers or stale datasets.",
        "Draft a dataset health checklist.",
      ];
    default:
      return [
        "Show the biggest risk right now.",
        "Turn this into an executive summary.",
        "What should I do next in Flex?",
      ];
  }
}

function relatedContext(messages: { role: "user" | "assistant" | "system"; content: string }[]): string {
  const users = messages.filter((m) => m.role === "user");
  const current = users[users.length - 1]?.content.trim() ?? "";
  const previous = users[users.length - 2]?.content.trim();
  if (!previous) return current;
  if (/^(and|also|what about|compare|same|that|this)/i.test(current)) return `${previous} ${current}`;
  return current;
}

function isVagueQuery(query: string): boolean {
  const tokens = tokenize(query);
  if (!tokens.length) return true;
  const known = new Set([
    "flex",
    "finops",
    "spend",
    "cost",
    "budget",
    "anomaly",
    "anomalies",
    "savings",
    "request",
    "requests",
    "dataset",
    "datasets",
    "chargeback",
    "showback",
    "forecast",
    "ec2",
    "rds",
    "s3",
    "eztrac",
    "dhub",
  ]);
  if (tokens.some((t) => known.has(t))) return false;
  return tokens.length < 2;
}

function buildLocalAnswer(messages: { role: "user" | "assistant" | "system"; content: string }[]): string {
  const query = relatedContext(messages);
  if (isVagueQuery(query)) {
    return [
      "I could not map that to FinOps context yet.",
      "",
      "Try a more specific request, for example:",
      "- `Show open anomalies`",
      "- `Which teams are over budget?`",
      "- `Top savings opportunities this month`",
      "- `Pending data exchange approvals`",
    ].join("\n");
  }
  const sources = retrieve(query);
  const intent = detectIntent(query);
  const lines: string[] = [];

  if (intent === "anomalies") {
    const open = initialAnomalies.filter((a) => a.status !== "resolved");
    const critical = open.filter((a) => a.severity === "critical" || a.severity === "high");
    lines.push("## Anomaly command center");
    lines.push("");
    lines.push(`**${open.length} active anomalies** with **${critical.length} high/critical** items. Prioritize projected-cost spikes first, then clear known waste in parallel.`);
    lines.push("");
    lines.push(
      ...mdTable(
        ["Priority", "Anomaly", "Service", "Severity", "Status", "Impact", "Next move"],
        open.slice(0, 5).map((a, index) => [
          index + 1,
          `**${a.title}**`,
          `\`${a.service}\``,
          a.severity,
          a.status,
          a.impact,
          a.severity === "critical"
            ? "Open incident bridge and cap blast radius"
            : a.service === "EBS"
              ? "Delete or attach unused volumes"
              : "Validate owner and compare 7-day baseline",
        ]),
      ),
    );
    lines.push("");
    lines.push("### Suggested actions");
    lines.push("1. **Triage EC2 first:** confirm instance family, deployment event, and autoscaling policy drift.");
    lines.push("2. **Add guardrails:** enable spend alerting and temporary quota checks while RCA runs.");
    lines.push("3. **Close quick waste:** resolve unattached EBS volumes separately so savings are not blocked by incident work.");
  } else if (intent === "budget") {
    const over = chargebackRows
      .filter((r) => r.monthlySpend > r.budget)
      .sort((a, b) => b.monthlySpend - b.budget - (a.monthlySpend - a.budget));
    lines.push("## Budget variance snapshot");
    lines.push("");
    lines.push(`**Total spend:** ${fmtMoney(kpis.totalSpend)} (${kpis.spendChange}% vs prior period). Focus review time on teams with positive variance and weak tag compliance.`);
    lines.push("");
    if (over.length === 0) {
      lines.push("> No team is currently above budget.");
    } else {
      lines.push(
        ...mdTable(
          ["Team", "Owner", "Spend", "Budget", "Variance", "Forecast", "Tag compliance"],
          over.slice(0, 5).map((r) => [
            `**${r.team}**`,
            r.owner,
            fmtMoney(r.monthlySpend),
            fmtMoney(r.budget),
            `**${fmtSignedMoney(r.monthlySpend - r.budget)}**`,
            fmtMoney(r.forecast),
            `${r.tagCompliance}%`,
          ]),
        ),
      );
    }
    lines.push("");
    lines.push("### Suggested actions");
    lines.push("1. Ask each over-budget owner for the workload driver and expected duration.");
    lines.push("2. Require missing `team`, `cost-center`, and `initiative` tags before month-end close.");
    lines.push("3. Use forecast variance to decide whether this is a one-time spike or a budget reset.");
  } else if (intent === "savings") {
    const ranked = [...initialSavings].sort((a, b) => b.monthlySavings - a.monthlySavings);
    lines.push("## Savings runway");
    lines.push("");
    lines.push("Ranked by monthly impact, confidence, and implementation stage.");
    lines.push("");
    lines.push(
      ...mdTable(
        ["Rank", "Opportunity", "Category", "Monthly savings", "Confidence", "Stage", "Owner"],
        ranked.slice(0, 5).map((s, index) => [
          index + 1,
          `**${s.title}**`,
          s.category,
          `**${fmtMoney(s.monthlySavings)}**`,
          `${s.confidence}%`,
          s.stage,
          s.owner,
        ]),
      ),
    );
    lines.push("");
    lines.push("### Priority");
    lines.push("1. Execute low-effort, high-confidence storage and rightsizing items first.");
    lines.push("2. Queue commitment purchases only after anomaly variance stabilizes.");
    lines.push("3. Track realized savings separately from identified savings.");
  } else if (intent === "requests") {
    const pending = initialDataRequests.filter((r) => r.status === "pending");
    lines.push("## Data exchange approval queue");
    lines.push("");
    lines.push(`**${pending.length} pending approvals** need governance review before partner consumption.`);
    lines.push("");
    lines.push(
      ...mdTable(
        ["Partner", "Dataset", "Rows", "Purpose", "Status"],
        initialDataRequests.slice(0, 6).map((r) => [
          `**${r.fromApp}**`,
          `\`${r.dataset}\``,
          r.recordCount.toLocaleString(),
          r.purpose,
          r.status,
        ]),
      ),
    );
    lines.push("");
    lines.push("### Suggested actions");
    lines.push("1. Approve low-risk refreshes with known consumers.");
    lines.push("2. Hold requests with unclear purpose until owner and retention are confirmed.");
  } else if (intent === "datasets") {
    lines.push("## Published dataset catalog");
    lines.push("");
    lines.push("Use this view to spot stale, draft, or unconsumed datasets before partner sync.");
    lines.push("");
    lines.push(
      ...mdTable(
        ["Dataset", "Status", "Consumers", "Rows", "Schema"],
        initialPublishedDatasets.slice(0, 6).map((d) => [
          `\`${d.name}\``,
          d.status,
          d.consumers.join(", ") || "none",
          d.recordCount.toLocaleString(),
          d.schema.map((field) => `\`${field}\``).join(", "),
        ]),
      ),
    );
  } else {
    lines.push("## FinOps control tower");
    lines.push("");
    lines.push("A compact view of the current Flex mock state.");
    lines.push("");
    lines.push(
      ...mdTable(
        ["Metric", "Value", "Readout"],
        [
          ["Total spend", `**${fmtMoney(kpis.totalSpend)}**`, `${kpis.spendChange}% vs prior period`],
          ["Open anomalies", initialAnomalies.filter((a) => a.status !== "resolved").length, "Needs triage"],
          ["Pending approvals", initialDataRequests.filter((r) => r.status === "pending").length, "Governance queue"],
          ["Savings identified", `**${fmtMoney(kpis.monthlySavingsIdentified)}**`, "Opportunity pipeline"],
        ],
      ),
    );
    lines.push("");
    lines.push("### Suggested actions");
    lines.push("1. Clear critical anomalies.");
    lines.push("2. Review over-budget teams.");
    lines.push("3. Convert approved savings into tracked implementation tasks.");
  }

  pushContextTable(lines, sources);

  return lines.join("\n");
}

export const askFlexAI = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    const query = relatedContext(data.messages);
    const followUps = buildFollowUps(query);

    if (!apiKey) return { content: buildLocalAnswer(data.messages), followUps };

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [{ role: "system", content: SYSTEM_PROMPT }, ...data.messages],
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        if (res.status === 429) throw new Error("Rate limit reached. Try again in a moment.");
        if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Settings → Workspace → Usage.");
        throw new Error(`AI gateway error (${res.status}): ${body.slice(0, 200)}`);
      }

      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = json.choices?.[0]?.message?.content ?? "";
      if (content.trim()) return { content, followUps };
      return { content: buildLocalAnswer(data.messages), followUps };
    } catch {
      return { content: buildLocalAnswer(data.messages), followUps };
    }
  });
