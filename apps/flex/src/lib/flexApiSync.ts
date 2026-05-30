import type { DataRequest } from '../types';
import type { FlexState } from '../store/flexTypes';

const API_URL =
  import.meta.env.VITE_FLEX_API_URL ??
  (import.meta.env.DEV ? '' : 'http://localhost:3847');

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let apiPushEnabled = false;

/** Avoid pushing stale localStorage to API before the first pull from flex-api. */
export function enableApiSyncPush(): void {
  apiPushEnabled = true;
}

/** Cancel a pending debounced push (call before pulling partner data from API). */
export function cancelScheduledSyncToApi(): void {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = null;
}

/** Push Flex state to local API (VS Code extension reads the same data). */
export function scheduleSyncStateToApi(state: FlexState): void {
  if (!apiPushEnabled) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    void syncStateToApi(state);
  }, 400);
}

/** Push immediately — use after merging partner data from flex-api. */
export async function flushSyncStateToApi(state: FlexState): Promise<void> {
  cancelScheduledSyncToApi();
  if (!apiPushEnabled) return;
  await syncStateToApi(state);
}

export async function syncStateToApi(state: FlexState): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/v1/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function stripApiMeta(raw: Record<string, unknown>): FlexState {
  const { _stateRevision: _r, ...rest } = raw;
  return rest as unknown as FlexState;
}

export async function pullStateFromApi(): Promise<FlexState | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/state`);
    if (!res.ok) return null;
    const json = (await res.json()) as Record<string, unknown>;
    return stripApiMeta(json);
  } catch {
    return null;
  }
}

async function fetchStateRevision(): Promise<number | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/state/revision`);
    if (!res.ok) return null;
    const json = (await res.json()) as { revision?: number };
    return typeof json.revision === 'number' ? json.revision : null;
  } catch {
    return null;
  }
}

/**
 * Subscribe to partner/API state changes (SSE + revision poll fallback).
 * Calls `onChange` when flex-api state updates (e.g. partner produce).
 */
export function subscribeToApiStateChanges(onChange: () => void): () => void {
  let lastRevision: number | null = null;
  let es: EventSource | null = null;
  let disposed = false;

  const notifyIfNew = (revision: number) => {
    // If API came online after app boot, trigger an initial pull once.
    if (lastRevision === null) {
      lastRevision = revision;
      onChange();
      return;
    }
    if (revision !== lastRevision) onChange();
    lastRevision = revision;
  };

  const pollRevision = async () => {
    if (disposed) return;
    const revision = await fetchStateRevision();
    if (revision == null) return;
    notifyIfNew(revision);
  };

  void pollRevision();

  try {
    es = new EventSource(`${API_URL}/api/v1/state/events`);
    es.onmessage = (ev) => {
      try {
        const { revision } = JSON.parse(ev.data) as { revision?: number };
        if (typeof revision === 'number') notifyIfNew(revision);
        else onChange();
      } catch {
        onChange();
      }
    };
  } catch {
    /* EventSource unavailable — revision poll only */
  }

  const interval = window.setInterval(() => void pollRevision(), 1500);
  const onFocus = () => void pollRevision();
  window.addEventListener('focus', onFocus);

  return () => {
    disposed = true;
    es?.close();
    window.clearInterval(interval);
    window.removeEventListener('focus', onFocus);
  };
}

function preferApiRequest(local: DataRequest, api: DataRequest): boolean {
  if (api.status === 'approved' && local.status === 'pending') return true;
  if (api.status === 'rejected' && local.status === 'pending') return true;
  return new Date(api.requestedAt).getTime() >= new Date(local.requestedAt).getTime();
}

function mergeDataRequests(local: DataRequest[], api: DataRequest[]): DataRequest[] {
  const map = new Map<string, DataRequest>();
  for (const r of local) map.set(r.id, r);
  for (const r of api) {
    const prev = map.get(r.id);
    if (!prev || preferApiRequest(prev, r)) map.set(r.id, r);
  }
  return [...map.values()].sort(
    (a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
  );
}

/** Merge partner/API writes into Flex UI state — API wins for partner deliveries. */
export function mergeApiStateIntoFlex(local: FlexState, api: FlexState): FlexState {
  const dataRequests = mergeDataRequests(local.dataRequests, api.dataRequests);

  const anomalyMap = new Map(local.anomalies.map((a) => [a.id, a]));
  for (const a of api.anomalies) anomalyMap.set(a.id, { ...anomalyMap.get(a.id), ...a });

  const chargebackMap = new Map(local.chargeback.map((c) => [c.id, c]));
  for (const c of api.chargeback ?? []) {
    const prev = chargebackMap.get(c.id);
    chargebackMap.set(c.id, prev ? { ...prev, ...c } : c);
  }

  const logIds = new Set(local.transferLog.map((e) => e.id));
  const mergedLog = [
    ...api.transferLog.filter((e) => !logIds.has(e.id)),
    ...local.transferLog,
  ].slice(0, 80);

  const localConnected = local.connectedApps ?? [];
  const apiConnected = api.connectedApps ?? [];
  const connectedMap = new Map(localConnected.map((ca) => [ca.id, ca]));
  for (const fromApi of apiConnected) {
    const prev = connectedMap.get(fromApi.id);
    if (!prev) {
      connectedMap.set(fromApi.id, fromApi);
      continue;
    }
    connectedMap.set(
      fromApi.id,
      new Date(fromApi.lastSync) > new Date(prev.lastSync) ? fromApi : prev
    );
  }
  const connectedApps = [...connectedMap.values()];

  const resourceMap = new Map(local.resourceAllocations.map((r) => [r.id, r]));
  for (const r of api.resourceAllocations ?? []) {
    const prev = resourceMap.get(r.id);
    resourceMap.set(r.id, prev ? { ...prev, ...r } : r);
  }

  const workforceMap = new Map(local.workforce.map((w) => [w.id, w]));
  for (const w of api.workforce ?? []) {
    const prev = workforceMap.get(w.id);
    workforceMap.set(w.id, prev ? { ...prev, ...w } : w);
  }

  const pendingApprovals = dataRequests.filter((r) => r.status === 'pending').length;

  return {
    ...local,
    dataRequests,
    anomalies: [...anomalyMap.values()],
    chargeback: [...chargebackMap.values()],
    resourceAllocations: [...resourceMap.values()],
    workforce: [...workforceMap.values()],
    transferLog: mergedLog,
    connectedApps,
    kpis: { ...local.kpis, ...(api.kpis ?? {}), pendingApprovals },
    publishedDatasets: api.publishedDatasets?.length
      ? api.publishedDatasets
      : local.publishedDatasets,
  };
}

export function getFlexApiUrl(): string {
  return API_URL;
}
