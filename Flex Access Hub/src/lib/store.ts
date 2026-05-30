import { useSyncExternalStore } from "react";
import {
  initialAnomalies,
  initialDataRequests,
  initialSavings,
} from "./mockData";
import type {
  Anomaly,
  AnomalyStatus,
  DataRequest,
  RequestStatus,
  SavingsOpportunity,
  SavingsStage,
} from "./types";

const API_BASE =
  (import.meta.env?.VITE_FLEX_API_URL as string | undefined)?.trim() ||
  "http://localhost:3847";

type State = {
  anomalies: Anomaly[];
  dataRequests: DataRequest[];
  savings: SavingsOpportunity[];
};

let state: State = {
  anomalies: initialAnomalies,
  dataRequests: initialDataRequests,
  savings: initialSavings,
};

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}

function coerceAnomalyStatus(value: unknown): AnomalyStatus {
  if (value === "resolved" || value === "investigating") return value;
  return "open";
}

function normalizeAnomaly(raw: Record<string, unknown>): Anomaly | null {
  const id = String(raw.id ?? "").trim();
  if (!id) return null;
  const severity = String(raw.severity ?? "medium");
  const sev =
    severity === "critical" || severity === "high" || severity === "low"
      ? severity
      : "medium";
  return {
    id,
    title: String(raw.title ?? "Partner-reported anomaly"),
    severity: sev,
    service: String(raw.service ?? "Unknown"),
    detectedAt: String(raw.detectedAt ?? new Date().toISOString()),
    impact: String(raw.impact ?? ""),
    status: coerceAnomalyStatus(raw.status),
    deltaPercent: Number(raw.deltaPercent ?? 0),
  };
}

function normalizeRequest(raw: Record<string, unknown>): DataRequest | null {
  const id = String(raw.id ?? "").trim();
  if (!id) return null;
  const statusRaw = String(raw.status ?? "pending");
  const status: RequestStatus =
    statusRaw === "approved" || statusRaw === "rejected" ? statusRaw : "pending";
  return {
    id,
    fromApp: String(raw.fromApp ?? "partner"),
    dataset: String(raw.dataset ?? "inbound_request"),
    requestedAt: String(raw.requestedAt ?? new Date().toISOString()),
    status,
    recordCount: Number(raw.recordCount ?? 0),
    purpose: String(raw.purpose ?? ""),
  };
}

function mergeById<T extends { id: string; [k: string]: unknown }>(local: T[], incoming: T[]): T[] {
  const byId = new Map(local.map((x) => [x.id, x]));
  for (const row of incoming) byId.set(row.id, { ...(byId.get(row.id) ?? {}), ...row } as T);
  return [...byId.values()];
}

function setState(partial: Partial<State>) {
  state = { ...state, ...partial };
  emit();
}

let lastRevision: number | null = null;
let bootstrapped = false;

async function pullFromApi() {
  try {
    const revRes = await fetch(`${API_BASE}/api/v1/state/revision`);
    if (!revRes.ok) return;
    const revJson = (await revRes.json()) as { revision?: number };
    const revision = typeof revJson.revision === "number" ? revJson.revision : null;
    if (revision == null) return;
    if (lastRevision !== null && revision === lastRevision) return;

    const stateRes = await fetch(`${API_BASE}/api/v1/state`);
    if (!stateRes.ok) return;
    const api = (await stateRes.json()) as Record<string, unknown>;

    const apiAnomalies = Array.isArray(api.anomalies)
      ? api.anomalies
          .map((row) => normalizeAnomaly((row ?? {}) as Record<string, unknown>))
          .filter((x): x is Anomaly => Boolean(x))
      : [];
    const apiRequests = Array.isArray(api.dataRequests)
      ? api.dataRequests
          .map((row) => normalizeRequest((row ?? {}) as Record<string, unknown>))
          .filter((x): x is DataRequest => Boolean(x))
      : [];

    if (apiAnomalies.length || apiRequests.length) {
      setState({
        anomalies: mergeById(state.anomalies, apiAnomalies),
        dataRequests: mergeById(state.dataRequests, apiRequests),
      });
    }
    lastRevision = revision;
  } catch {
    // Keep local state as fallback.
  }
}

if (typeof window !== "undefined" && !bootstrapped) {
  bootstrapped = true;
  void pullFromApi();
  const interval = window.setInterval(() => void pullFromApi(), 1500);
  window.addEventListener("focus", () => void pullFromApi());
  try {
    const es = new EventSource(`${API_BASE}/api/v1/state/events`);
    es.onmessage = () => void pullFromApi();
    window.addEventListener("beforeunload", () => {
      window.clearInterval(interval);
      es.close();
    });
  } catch {
    // Polling fallback already active.
  }
}

export const store = {
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  get(): State {
    return state;
  },
  setAnomalyStatus(id: string, status: AnomalyStatus) {
    setState({
      anomalies: state.anomalies.map((a) =>
        a.id === id ? { ...a, status } : a,
      ),
    });
  },
  setRequestStatus(id: string, status: RequestStatus) {
    setState({
      dataRequests: state.dataRequests.map((r) =>
        r.id === id ? { ...r, status } : r,
      ),
    });
  },
  advanceSavingsStage(id: string) {
    const order: SavingsStage[] = ["identified", "approved", "implementing", "realized"];
    setState({
      savings: state.savings.map((s) => {
        if (s.id !== id) return s;
        const i = order.indexOf(s.stage);
        return { ...s, stage: order[Math.min(i + 1, order.length - 1)] };
      }),
    });
  },
};

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(state),
    () => selector({
      anomalies: initialAnomalies,
      dataRequests: initialDataRequests,
      savings: initialSavings,
    }),
  );
}
