import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  anomalies as initialAnomalies,
  initialDataRequests,
  initialKpis,
  initialPublishedDatasets,
} from '../data/mockData';
import { savingsOpportunities as initialSavings } from '../data/insights';
import { chargebackRows as initialChargeback } from '../data/chargeback';
import { tagComplianceRules as initialTagRules } from '../data/tagCompliance';
import { squadWorkforceRows as initialWorkforce } from '../data/workforce';
import { connectedApps as initialConnectedApps, resourceAllocations as initialResourceAllocations } from '../data/mockData';
import { deriveAlignmentRows, initialAlignmentRows, computeAlignmentScore } from '../lib/deriveAlignment';
import { getPartnerConsumption, partnerLabel } from '../lib/partnerConsumption';
import { buildOutcomeNotification } from '../lib/workflowGlue';
import { notifyExtension, syncToExtensionStorage } from '../lib/extensionBridge';
import {
  cancelScheduledSyncToApi,
  enableApiSyncPush,
  flushSyncStateToApi,
  mergeApiStateIntoFlex,
  pullStateFromApi,
  scheduleSyncStateToApi,
  subscribeToApiStateChanges,
} from '../lib/flexApiSync';
import {
  canApproveRequest,
  canPublishDataset,
  canResolveAnomaly,
  rbacDenyMessage,
} from '../lib/rbac';
import type { SavingsStage } from '../data/insights';
import type {
  AppId,
  DataRequest,
  PublishedDataset,
  TransferLogEntry,
} from '../types';
import type {
  CreateAnomalyInput,
  CreateDatasetInput,
  CreateSavingsInput,
  FlexSettings,
  FlexState,
} from './flexTypes';

const STORAGE_KEY = 'flex_state_v2';
const UNDO_MS = 8000;

const defaultSettings: FlexSettings = {
  userRole: 'admin',
  slackApprovals: true,
  presentationMode: false,
  meetingMode: false,
  spendPulse: true,
  desktopNotifications: true,
};

export interface UndoEntry {
  label: string;
  snapshot: FlexState;
  expiresAt: number;
}

interface FlexContextValue extends FlexState {
  pendingCount: number;
  alignmentScore: number;
  derivedAlignmentRows: ReturnType<typeof deriveAlignmentRows>;
  undoEntry: UndoEntry | null;
  lastActionError: string | null;
  clearActionError: () => void;
  approveRequest: (id: string, options?: { skipUndo?: boolean }) => boolean;
  rejectRequest: (id: string, options?: { skipUndo?: boolean }) => boolean;
  publishDataset: (id: string, options?: { skipUndo?: boolean }) => boolean;
  unpublishDataset: (id: string) => void;
  createDataset: (input: CreateDatasetInput) => string;
  updateDataset: (id: string, patch: Partial<Pick<PublishedDataset, 'description' | 'schema' | 'consumers'>>) => void;
  archiveDataRequest: (id: string) => void;
  resolveAnomaly: (id: string, options?: { skipUndo?: boolean }) => boolean;
  reopenAnomaly: (id: string) => void;
  createAnomaly: (input: CreateAnomalyInput) => string;
  updateAnomaly: (id: string, patch: Partial<Pick<CreateAnomalyInput, 'title' | 'severity' | 'impact' | 'service'>>) => void;
  deleteAnomaly: (id: string) => void;
  advanceSavingsStage: (id: string) => void;
  createSavings: (input: CreateSavingsInput) => string;
  dismissSavings: (id: string) => void;
  assignAnomalyOwner: (id: string, ownerName: string, squad: string) => void;
  updateChargeback: (id: string, patch: Partial<{ budget: number; owner: string }>) => void;
  updateTagRule: (id: string, patch: Partial<{ coveragePct: number; untaggedSpend: number }>) => void;
  acknowledgeWorkforceSignal: (id: string) => void;
  resolveAlignmentConflict: (id: string) => void;
  setUserRole: (role: FlexSettings['userRole']) => void;
  setSlackApprovals: (enabled: boolean) => void;
  setPresentationMode: (enabled: boolean) => void;
  setMeetingMode: (enabled: boolean) => void;
  setSpendPulse: (enabled: boolean) => void;
  setDesktopNotifications: (enabled: boolean) => void;
  resetDemoData: () => void;
  undoLastAction: () => void;
  dismissUndo: () => void;
  refreshFromExternal: (app: 'eztrac' | 'dhub-rpt') => Promise<DataRequest>;
  addInboundRequest: (
    input: Omit<DataRequest, 'id' | 'status' | 'requestedAt'> & { requestedAt?: string }
  ) => DataRequest;
  pullPartnerData: (partner: 'eztrac' | 'dhub-rpt') => number;
  lastSyncMessage: string | null;
  clearSyncMessage: () => void;
}

const FlexContext = createContext<FlexContextValue | null>(null);

function makeLog(
  partial: Omit<TransferLogEntry, 'id' | 'at'>
): TransferLogEntry {
  return {
    id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    ...partial,
  };
}

const initialTransferLog: TransferLogEntry[] = [
  makeLog({
    direction: 'outbound',
    from: 'flex',
    to: 'eztrac',
    dataset: 'cloud_cost_daily',
    recordCount: 36500,
    status: 'delivered',
    message: 'Delivered cloud_cost_daily to EzTrac',
  }),
  makeLog({
    direction: 'outbound',
    from: 'flex',
    to: 'dhub-rpt',
    dataset: 'allocation_matrix',
    recordCount: 420,
    status: 'delivered',
    message: 'Delivered allocation_matrix to dhub-rpt',
  }),
];

function normalizeState(parsed: Partial<FlexState>): FlexState {
  return {
    dataRequests: parsed.dataRequests ?? initialDataRequests,
    publishedDatasets: parsed.publishedDatasets ?? initialPublishedDatasets,
    anomalies: parsed.anomalies ?? initialAnomalies,
    kpis: parsed.kpis ?? initialKpis,
    transferLog: parsed.transferLog?.length ? parsed.transferLog : initialTransferLog,
    savings: parsed.savings?.length ? parsed.savings : initialSavings,
    chargeback: parsed.chargeback?.length ? parsed.chargeback : initialChargeback,
    resourceAllocations: parsed.resourceAllocations?.length
      ? parsed.resourceAllocations
      : initialResourceAllocations,
    tagRules: parsed.tagRules?.length ? parsed.tagRules : initialTagRules,
    workforce: parsed.workforce?.length ? parsed.workforce : initialWorkforce,
    connectedApps: parsed.connectedApps?.length ? parsed.connectedApps : initialConnectedApps,
    alignmentRows: parsed.alignmentRows?.length ? parsed.alignmentRows : initialAlignmentRows,
    resolvedAlignmentIds: parsed.resolvedAlignmentIds ?? [],
    settings: { ...defaultSettings, ...parsed.settings },
  };
}

function freshState(): FlexState {
  return normalizeState({});
}

function loadState(): FlexState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizeState(JSON.parse(raw) as Partial<FlexState>);
  } catch {
    /* ignore */
  }
  return normalizeState({});
}

export function FlexProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FlexState>(loadState);
  const [lastSyncMessage, setLastSyncMessage] = useState<string | null>(null);
  const [lastActionError, setLastActionError] = useState<string | null>(null);
  const [undoEntry, setUndoEntry] = useState<UndoEntry | null>(null);
  const stateRef = useRef(state);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  stateRef.current = state;

  const clearActionError = useCallback(() => setLastActionError(null), []);

  const flashError = useCallback((msg: string) => {
    setLastActionError(msg);
    setTimeout(() => setLastActionError(null), 5000);
  }, []);

  const dismissUndo = useCallback(() => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoEntry(null);
  }, []);

  const scheduleUndo = useCallback(
    (label: string, snapshot: FlexState) => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      const entry: UndoEntry = {
        label,
        snapshot: JSON.parse(JSON.stringify(snapshot)) as FlexState,
        expiresAt: Date.now() + UNDO_MS,
      };
      setUndoEntry(entry);
      undoTimerRef.current = setTimeout(() => setUndoEntry(null), UNDO_MS);
    },
    []
  );

  const undoLastAction = useCallback(() => {
    if (!undoEntry) return;
    setState(undoEntry.snapshot);
    dismissUndo();
  }, [dismissUndo, undoEntry]);

  useEffect(() => {
    document.documentElement.classList.toggle('demo-mode', state.settings.presentationMode);
  }, [state.settings.presentationMode]);

  useEffect(() => {
    const onDismiss = () => dismissUndo();
    window.addEventListener('flex-dismiss-undo', onDismiss);
    return () => window.removeEventListener('flex-dismiss-undo', onDismiss);
  }, [dismissUndo]);

  useEffect(() => {
    const json = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, json);
    syncToExtensionStorage(json);
    scheduleSyncStateToApi(state);
  }, [state]);

  useEffect(() => {
    let cancelled = false;
    const pull = async () => {
      cancelScheduledSyncToApi();
      const api = await pullStateFromApi();
      if (!api || cancelled) return;
      let partnerSyncMessage: string | null = null;
      let mergedSnapshot: FlexState | null = null;
      setState((current) => {
        const prevLogIds = new Set(current.transferLog.map((e) => e.id));
        const prevRequestIds = new Set(current.dataRequests.map((r) => r.id));
        const merged = mergeApiStateIntoFlex(current, api);
        mergedSnapshot = merged;
        const newPartnerLogs = merged.transferLog.filter(
          (e) => !prevLogIds.has(e.id) && (e.from === 'eztrac' || e.from === 'dhub-rpt')
        );
        const newestPartnerLog = newPartnerLogs[0];
        const newRequest = merged.dataRequests.find((r) => !prevRequestIds.has(r.id));
        const anomalyChanged =
          JSON.stringify(current.anomalies) !== JSON.stringify(merged.anomalies);
        const chargebackChanged =
          JSON.stringify(current.chargeback) !== JSON.stringify(merged.chargeback);
        const allocChanged =
          JSON.stringify(current.resourceAllocations) !==
          JSON.stringify(merged.resourceAllocations);
        const workforceChanged =
          JSON.stringify(current.workforce) !== JSON.stringify(merged.workforce);
        if (newestPartnerLog?.message) partnerSyncMessage = newestPartnerLog.message;
        else if (newRequest) {
          const label = newRequest.fromApp === 'eztrac' ? 'EzTrac' : 'dhub-rpt';
          if (newRequest.status === 'pending') {
            partnerSyncMessage = `${label} sent ${newRequest.dataset} — awaiting approval`;
            if (!cancelled && stateRef.current.settings.desktopNotifications) {
              notifyExtension(
                'Flex — Approval needed',
                `${label}: ${newRequest.dataset} (${newRequest.recordCount.toLocaleString()} rows)`
              );
            }
          } else {
            partnerSyncMessage = `${label} → Flex: ${newRequest.dataset} (${newRequest.status})`;
          }
        } else if (anomalyChanged) {
          partnerSyncMessage = 'Partner anomaly updates synced to Flex';
        } else if (chargebackChanged) {
          partnerSyncMessage = 'Partner chargeback updates synced to Flex';
        } else if (allocChanged) {
          partnerSyncMessage = 'dhub-rpt updated resource allocations in Flex';
        } else if (workforceChanged) {
          partnerSyncMessage = 'dhub-rpt updated workforce allocations in Flex';
        }
        if (newestPartnerLog && !cancelled && stateRef.current.settings.desktopNotifications) {
          notifyExtension('Flex — Partner update', newestPartnerLog.message);
        }
        return merged;
      });
      if (partnerSyncMessage) setLastSyncMessage(partnerSyncMessage);
      enableApiSyncPush();
      if (mergedSnapshot && !cancelled) void flushSyncStateToApi(mergedSnapshot);
    };
    void pull();
    const unsubscribe = subscribeToApiStateChanges(() => void pull());
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const pendingCount = state.dataRequests.filter((r) => r.status === 'pending').length;
  const derivedAlignmentRows = useMemo(() => deriveAlignmentRows(state), [state]);
  const alignmentScore = useMemo(
    () => computeAlignmentScore(derivedAlignmentRows),
    [derivedAlignmentRows]
  );

  const notifyIfEnabled = useCallback((title: string, body: string) => {
    if (stateRef.current.settings.desktopNotifications) {
      notifyExtension(title, body);
    }
  }, []);

  const approveRequest = useCallback(
    (id: string, options?: { skipUndo?: boolean }): boolean => {
      const before = stateRef.current;
      const req = before.dataRequests.find((r) => r.id === id);
      if (!req || req.status !== 'pending') return false;
      if (!canApproveRequest(before.settings.userRole, req)) {
        flashError(rbacDenyMessage(before.settings.userRole, 'approve this request'));
        return false;
      }

      if (!options?.skipUndo) scheduleUndo(`Approved ${req.dataset}`, before);

      setState((s) => {
        const current = s.dataRequests.find((r) => r.id === id);
        if (!current || current.status !== 'pending') return s;

        const log = makeLog({
          direction: 'inbound',
          from: current.fromApp,
          to: 'flex',
          dataset: current.dataset,
          recordCount: current.recordCount,
          status: 'approved',
          message: `Approved: ${current.fromApp} → Flex (${current.dataset})`,
        });

        const delivered = makeLog({
          direction: 'outbound',
          from: 'flex',
          to: current.fromApp,
          dataset: current.dataset,
          recordCount: current.recordCount,
          status: 'delivered',
          message: `Transferred ${current.recordCount.toLocaleString()} rows to ${current.fromApp === 'eztrac' ? 'EzTrac' : 'dhub-rpt'}`,
        });

        return {
          ...s,
          dataRequests: s.dataRequests.map((r) =>
            r.id === id ? { ...r, status: 'approved' as const } : r
          ),
          kpis: {
            ...s.kpis,
            pendingApprovals: Math.max(0, s.kpis.pendingApprovals - 1),
          },
          transferLog: [delivered, log, ...s.transferLog].slice(0, 50),
        };
      });
      setLastSyncMessage('Data transfer complete — see activity log below.');
      const outcome = buildOutcomeNotification(req, 'approved');
      notifyIfEnabled(outcome.desktopTitle, outcome.desktopBody);
      return true;
    },
    [flashError, scheduleUndo]
  );

  const rejectRequest = useCallback(
    (id: string, options?: { skipUndo?: boolean }): boolean => {
      const before = stateRef.current;
      const req = before.dataRequests.find((r) => r.id === id);
      if (!req || req.status !== 'pending') return false;
      if (!canApproveRequest(before.settings.userRole, req)) {
        flashError(rbacDenyMessage(before.settings.userRole, 'reject this request'));
        return false;
      }

      if (!options?.skipUndo) scheduleUndo(`Rejected ${req.dataset}`, before);

      setState((s) => {
        const current = s.dataRequests.find((r) => r.id === id);
        if (!current || current.status !== 'pending') return s;

        const log = makeLog({
          direction: 'inbound',
          from: current.fromApp,
          to: 'flex',
          dataset: current.dataset,
          recordCount: current.recordCount,
          status: 'rejected',
          message: `Rejected request from ${current.fromApp === 'eztrac' ? 'EzTrac' : 'dhub-rpt'}`,
        });

        return {
          ...s,
          dataRequests: s.dataRequests.map((r) =>
            r.id === id ? { ...r, status: 'rejected' as const } : r
          ),
          kpis: {
            ...s.kpis,
            pendingApprovals: Math.max(0, s.kpis.pendingApprovals - 1),
          },
          transferLog: [log, ...s.transferLog].slice(0, 50),
        };
      });
      const outcome = buildOutcomeNotification(req, 'rejected');
      notifyIfEnabled(outcome.desktopTitle, outcome.desktopBody);
      setLastSyncMessage(`Rejected ${req.dataset} — notify ${outcome.target.label} if needed.`);
      return true;
    },
    [flashError, scheduleUndo]
  );

  const publishDataset = useCallback(
    (id: string, options?: { skipUndo?: boolean }): boolean => {
      const before = stateRef.current;
      const ds = before.publishedDatasets.find((d) => d.id === id);
      if (!ds) return false;
      if (!canPublishDataset(before.settings.userRole, ds)) {
        flashError(rbacDenyMessage(before.settings.userRole, 'publish this dataset'));
        return false;
      }

      if (!options?.skipUndo) scheduleUndo(`Published ${ds.name}`, before);

      setState((s) => {
        const current = s.publishedDatasets.find((d) => d.id === id);
        if (!current) return s;

        const consumers: Exclude<AppId, 'flex'>[] = current.consumers.length
          ? current.consumers
          : ['eztrac', 'dhub-rpt'];

        const logs = consumers.map((c) =>
          makeLog({
            direction: 'outbound',
            from: 'flex',
            to: c,
            dataset: current.name,
            recordCount: current.recordCount || 128,
            status: 'delivered',
            message: `Published ${current.name} → ${c === 'eztrac' ? 'EzTrac' : 'dhub-rpt'}`,
          })
        );

        return {
          ...s,
          publishedDatasets: s.publishedDatasets.map((d) =>
            d.id === id
              ? {
                  ...d,
                  status: 'active' as const,
                  lastPublished: new Date().toISOString(),
                  consumers,
                  recordCount: d.recordCount || 128,
                }
              : d
          ),
          transferLog: [...logs, ...s.transferLog].slice(0, 50),
        };
      });
      setLastSyncMessage('Dataset published to connected apps.');
      return true;
    },
    [flashError, scheduleUndo]
  );

  const resolveAnomaly = useCallback(
    (id: string, options?: { skipUndo?: boolean }): boolean => {
      const before = stateRef.current;
      const anomaly = before.anomalies.find((a) => a.id === id);
      if (!anomaly || anomaly.status === 'resolved') return false;
      if (!canResolveAnomaly(before.settings.userRole)) {
        flashError(rbacDenyMessage(before.settings.userRole, 'resolve anomalies'));
        return false;
      }

      if (!options?.skipUndo) scheduleUndo(`Resolved ${anomaly.title}`, before);

      setState((s) => ({
        ...s,
        anomalies: s.anomalies.map((a) =>
          a.id === id ? { ...a, status: 'resolved' as const } : a
        ),
        kpis: {
          ...s.kpis,
          openAnomalies: Math.max(
            0,
            s.kpis.openAnomalies -
              (s.anomalies.find((a) => a.id === id && a.status !== 'resolved') ? 1 : 0)
          ),
        },
      }));
      return true;
    },
    [flashError, scheduleUndo]
  );

  const advanceSavingsStage = useCallback((id: string) => {
    const stages: SavingsStage[] = ['identified', 'approved', 'implementing', 'realized'];
    setState((s) => ({
      ...s,
      savings: s.savings.map((item) => {
        if (item.id !== id) return item;
        const idx = stages.indexOf(item.stage);
        const next = stages[Math.min(idx + 1, stages.length - 1)];
        return {
          ...item,
          stage: next,
          realizedSavings: next === 'realized' ? item.monthlySavings : item.realizedSavings,
        };
      }),
    }));
  }, []);

  const assignAnomalyOwner = useCallback((id: string, ownerName: string, squad: string) => {
    setState((s) => ({
      ...s,
      anomalies: s.anomalies.map((a) =>
        a.id === id
          ? {
              ...a,
              assignedOwner: ownerName,
              assignedSquad: squad,
              assignedAt: new Date().toISOString(),
              status: a.status === 'open' ? ('investigating' as const) : a.status,
            }
          : a
      ),
      transferLog: [
        makeLog({
          direction: 'outbound',
          from: 'flex',
          to: 'dhub-rpt',
          dataset: 'anomaly_owner',
          recordCount: 1,
          status: 'delivered',
          message: `Assigned ${ownerName} (${squad}) to anomaly ${id}`,
        }),
        ...s.transferLog,
      ].slice(0, 50),
    }));
    notifyIfEnabled('Flex — Owner assigned', `${ownerName} (${squad}) owns critical anomaly`);
  }, []);

  const setUserRole = useCallback((role: FlexSettings['userRole']) => {
    setState((s) => ({ ...s, settings: { ...s.settings, userRole: role } }));
  }, []);

  const setSlackApprovals = useCallback((enabled: boolean) => {
    setState((s) => ({ ...s, settings: { ...s.settings, slackApprovals: enabled } }));
  }, []);

  const setPresentationMode = useCallback((enabled: boolean) => {
    setState((s) => ({ ...s, settings: { ...s.settings, presentationMode: enabled } }));
  }, []);

  const setMeetingMode = useCallback((enabled: boolean) => {
    setState((s) => ({ ...s, settings: { ...s.settings, meetingMode: enabled } }));
  }, []);

  const setSpendPulse = useCallback((enabled: boolean) => {
    setState((s) => ({ ...s, settings: { ...s.settings, spendPulse: enabled } }));
  }, []);

  const setDesktopNotifications = useCallback((enabled: boolean) => {
    setState((s) => ({ ...s, settings: { ...s.settings, desktopNotifications: enabled } }));
  }, []);

  const resetDemoData = useCallback(() => {
    setState(freshState());
    setLastSyncMessage(null);
    setLastActionError(null);
    dismissUndo();
  }, [dismissUndo]);

  const unpublishDataset = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      publishedDatasets: s.publishedDatasets.map((d) =>
        d.id === id && d.status === 'active'
          ? { ...d, status: 'draft' as const, consumers: [], lastPublished: '' }
          : d
      ),
      transferLog: [
        makeLog({
          direction: 'outbound',
          from: 'flex',
          to: 'eztrac',
          dataset: s.publishedDatasets.find((d) => d.id === id)?.name ?? id,
          recordCount: 0,
          status: 'rejected',
          message: 'Dataset unpublished — consumers disconnected',
        }),
        ...s.transferLog,
      ].slice(0, 50),
    }));
    setLastSyncMessage('Dataset moved back to draft.');
  }, []);

  const createDataset = useCallback((input: CreateDatasetInput): string => {
    const id = `pd-${Date.now()}`;
    setState((s) => ({
      ...s,
      publishedDatasets: [
        {
          ...input,
          id,
          status: 'draft' as const,
          lastPublished: '',
        },
        ...s.publishedDatasets,
      ],
    }));
    return id;
  }, []);

  const updateDataset = useCallback(
    (id: string, patch: Partial<{ description: string; schema: string[]; consumers: Exclude<AppId, 'flex'>[] }>) => {
      setState((s) => ({
        ...s,
        publishedDatasets: s.publishedDatasets.map((d) => (d.id === id ? { ...d, ...patch } : d)),
      }));
    },
    []
  );

  const archiveDataRequest = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      dataRequests: s.dataRequests.filter((r) => r.id !== id),
    }));
  }, []);

  const createAnomaly = useCallback((input: CreateAnomalyInput): string => {
    const id = `an-${Date.now()}`;
    setState((s) => ({
      ...s,
      anomalies: [{ ...input, id }, ...s.anomalies],
      kpis: { ...s.kpis, openAnomalies: s.kpis.openAnomalies + (input.status !== 'resolved' ? 1 : 0) },
    }));
    notifyIfEnabled('Flex — New anomaly', input.title);
    return id;
  }, [notifyIfEnabled]);

  const updateAnomaly = useCallback(
    (id: string, patch: Partial<Pick<CreateAnomalyInput, 'title' | 'severity' | 'impact' | 'service'>>) => {
      setState((s) => ({
        ...s,
        anomalies: s.anomalies.map((a) => (a.id === id ? { ...a, ...patch } : a)),
      }));
    },
    []
  );

  const deleteAnomaly = useCallback((id: string) => {
    setState((s) => {
      const target = s.anomalies.find((a) => a.id === id);
      return {
        ...s,
        anomalies: s.anomalies.filter((a) => a.id !== id),
        kpis: {
          ...s.kpis,
          openAnomalies: Math.max(
            0,
            s.kpis.openAnomalies - (target && target.status !== 'resolved' ? 1 : 0)
          ),
        },
      };
    });
  }, []);

  const reopenAnomaly = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      anomalies: s.anomalies.map((a) =>
        a.id === id && a.status === 'resolved' ? { ...a, status: 'open' as const } : a
      ),
      kpis: { ...s.kpis, openAnomalies: s.kpis.openAnomalies + 1 },
    }));
  }, []);

  const createSavings = useCallback((input: CreateSavingsInput): string => {
    const id = `s-${Date.now()}`;
    setState((s) => ({ ...s, savings: [{ ...input, id }, ...s.savings] }));
    return id;
  }, []);

  const dismissSavings = useCallback((id: string) => {
    setState((s) => ({ ...s, savings: s.savings.filter((item) => item.id !== id) }));
  }, []);

  const updateChargeback = useCallback(
    (id: string, patch: Partial<{ budget: number; owner: string }>) => {
      setState((s) => ({
        ...s,
        chargeback: s.chargeback.map((row) => (row.id === id ? { ...row, ...patch } : row)),
      }));
    },
    []
  );

  const updateTagRule = useCallback(
    (id: string, patch: Partial<{ coveragePct: number; untaggedSpend: number }>) => {
      setState((s) => ({
        ...s,
        tagRules: s.tagRules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)),
      }));
    },
    []
  );

  const acknowledgeWorkforceSignal = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      workforce: s.workforce.map((row) =>
        row.id === id
          ? {
              ...row,
              signal: 'stable' as const,
              signalReason: 'Acknowledged — action tracked in dhub-rpt planning cycle',
            }
          : row
      ),
    }));
    setLastSyncMessage('Workforce signal acknowledged.');
  }, []);

  const resolveAlignmentConflict = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      resolvedAlignmentIds: s.resolvedAlignmentIds.includes(id)
        ? s.resolvedAlignmentIds
        : [...s.resolvedAlignmentIds, id],
      transferLog: [
        makeLog({
          direction: 'outbound',
          from: 'flex',
          to: 'dhub-rpt',
          dataset: 'alignment_resolution',
          recordCount: 1,
          status: 'delivered',
          message: `Alignment conflict ${id} marked resolved`,
        }),
        ...s.transferLog,
      ].slice(0, 50),
    }));
    setLastSyncMessage('Alignment conflict resolved — score will update.');
  }, []);

  const refreshFromExternal = useCallback(async (app: 'eztrac' | 'dhub-rpt') => {
    const appLabel = app === 'eztrac' ? 'EzTrac' : 'dhub-rpt';
    cancelScheduledSyncToApi();
    const api = await pullStateFromApi();
    if (api) {
      let latest: DataRequest | undefined;
      let mergedSnapshot: FlexState | null = null;
      setState((current) => {
        const merged = mergeApiStateIntoFlex(current, api);
        mergedSnapshot = {
          ...merged,
          connectedApps: merged.connectedApps.map((ca) =>
            ca.id === app ? { ...ca, lastSync: new Date().toISOString() } : ca
          ),
        };
        latest =
          mergedSnapshot.dataRequests.find((r) => r.fromApp === app) ??
          api.dataRequests.find((r) => r.fromApp === app);
        return mergedSnapshot;
      });
      if (mergedSnapshot) {
        enableApiSyncPush();
        await flushSyncStateToApi(mergedSnapshot);
      }
      const recentLog = api.transferLog?.find((e) => e.from === app);
      setLastSyncMessage(
        recentLog?.message ??
          (latest
            ? `${appLabel} synced — ${latest.dataset} (${latest.status})`
            : `${appLabel} connected — no new transfers yet`)
      );
      if (latest) {
        notifyIfEnabled('Flex — Partner sync', `${appLabel}: ${latest.dataset}`);
        return latest;
      }
    }

    setLastSyncMessage(`${appLabel}: open the partner app, send to Flex, then refresh again.`);
    return {
      id: `dr-stub-${Date.now()}`,
      fromApp: app,
      dataset: app === 'eztrac' ? 'forecast_variance' : 'capacity_forecast',
      requestedAt: new Date().toISOString(),
      status: 'pending',
      recordCount: 0,
      purpose: 'Waiting for partner send',
    } satisfies DataRequest;
  }, [notifyIfEnabled]);

  const addInboundRequest = useCallback(
    (input: Omit<DataRequest, 'id' | 'status' | 'requestedAt'> & { requestedAt?: string }) => {
      const appLabel = input.fromApp === 'eztrac' ? 'EzTrac' : 'dhub-rpt';
      const newRequest: DataRequest = {
        id: `dr-${Date.now()}`,
        fromApp: input.fromApp,
        dataset: input.dataset,
        requestedAt: input.requestedAt ?? new Date().toISOString(),
        status: 'approved',
        recordCount: input.recordCount,
        purpose: input.purpose,
      };

      setState((s) => {
        const pending = s.dataRequests.filter((r) => r.status === 'pending').length;
        const approvedLog = makeLog({
          direction: 'inbound',
          from: input.fromApp,
          to: 'flex',
          dataset: input.dataset,
          recordCount: input.recordCount,
          status: 'approved',
          message: `${appLabel} → Flex (${input.dataset}) accepted`,
        });
        const deliveredLog = makeLog({
          direction: 'outbound',
          from: 'flex',
          to: input.fromApp,
          dataset: input.dataset,
          recordCount: input.recordCount,
          status: 'delivered',
          message: `Delivered ${input.recordCount.toLocaleString()} rows to ${appLabel}`,
        });
        return {
          ...s,
          dataRequests: [newRequest, ...s.dataRequests],
          kpis: { ...s.kpis, pendingApprovals: pending },
          connectedApps: s.connectedApps.map((ca) =>
            ca.id === input.fromApp ? { ...ca, lastSync: new Date().toISOString() } : ca
          ),
          transferLog: [deliveredLog, approvedLog, ...s.transferLog].slice(0, 50),
        };
      });

      setLastSyncMessage(`Delivered ${input.dataset} from ${appLabel} (${input.recordCount} rows)`);
      notifyIfEnabled('Flex — Partner delivery', `${appLabel}: ${input.dataset}`);

      return newRequest;
    },
    [notifyIfEnabled]
  );

  const clearSyncMessage = useCallback(() => setLastSyncMessage(null), []);

  const pullPartnerData = useCallback(
    (partner: 'eztrac' | 'dhub-rpt'): number => {
      const rows = getPartnerConsumption(stateRef.current, partner).filter(
        (r) => r.status === 'consuming' || r.status === 'stale'
      );
      if (rows.length === 0) {
        setLastSyncMessage(`${partnerLabel(partner)} has no published datasets to pull yet.`);
        return 0;
      }

      const now = new Date().toISOString();
      const logs = rows.map((row) =>
        makeLog({
          direction: 'outbound',
          from: 'flex',
          to: partner,
          dataset: row.datasetName,
          recordCount: row.recordCount,
          status: 'delivered',
          message: `${partnerLabel(partner)} pulled ${row.datasetName} (${row.recordCount.toLocaleString()} rows)`,
        })
      );

      setState((s) => ({
        ...s,
        publishedDatasets: s.publishedDatasets.map((d) =>
          rows.some((r) => r.datasetName === d.name) ? { ...d, lastPublished: now } : d
        ),
        connectedApps: s.connectedApps.map((app) =>
          app.id === partner ? { ...app, lastSync: now } : app
        ),
        transferLog: [...logs, ...s.transferLog].slice(0, 50),
      }));

      const label = partnerLabel(partner);
      setLastSyncMessage(`${label} pulled ${rows.length} dataset(s) from Flex.`);
      notifyIfEnabled(`Flex → ${label}`, `Pulled ${rows.map((r) => r.datasetName).join(', ')}`);
      return rows.length;
    },
    [notifyIfEnabled]
  );

  const value = useMemo(
    () => ({
      ...state,
      pendingCount,
      alignmentScore,
      derivedAlignmentRows,
      undoEntry,
      lastActionError,
      clearActionError,
      approveRequest,
      rejectRequest,
      publishDataset,
      unpublishDataset,
      createDataset,
      updateDataset,
      archiveDataRequest,
      resolveAnomaly,
      reopenAnomaly,
      createAnomaly,
      updateAnomaly,
      deleteAnomaly,
      advanceSavingsStage,
      createSavings,
      dismissSavings,
      assignAnomalyOwner,
      updateChargeback,
      updateTagRule,
      acknowledgeWorkforceSignal,
      resolveAlignmentConflict,
      setUserRole,
      setSlackApprovals,
      setPresentationMode,
      setMeetingMode,
      setSpendPulse,
      setDesktopNotifications,
      resetDemoData,
      undoLastAction,
      dismissUndo,
      refreshFromExternal,
      addInboundRequest,
      pullPartnerData,
      lastSyncMessage,
      clearSyncMessage,
    }),
    [
      state,
      pendingCount,
      alignmentScore,
      derivedAlignmentRows,
      undoEntry,
      lastActionError,
      clearActionError,
      approveRequest,
      rejectRequest,
      publishDataset,
      unpublishDataset,
      createDataset,
      updateDataset,
      archiveDataRequest,
      resolveAnomaly,
      reopenAnomaly,
      createAnomaly,
      updateAnomaly,
      deleteAnomaly,
      advanceSavingsStage,
      createSavings,
      dismissSavings,
      assignAnomalyOwner,
      updateChargeback,
      updateTagRule,
      acknowledgeWorkforceSignal,
      resolveAlignmentConflict,
      setUserRole,
      setSlackApprovals,
      setPresentationMode,
      setMeetingMode,
      setSpendPulse,
      setDesktopNotifications,
      resetDemoData,
      undoLastAction,
      dismissUndo,
      refreshFromExternal,
      addInboundRequest,
      pullPartnerData,
      lastSyncMessage,
      clearSyncMessage,
    ]
  );

  return <FlexContext.Provider value={value}>{children}</FlexContext.Provider>;
}

export function useFlex() {
  const ctx = useContext(FlexContext);
  if (!ctx) throw new Error('useFlex must be used within FlexProvider');
  return ctx;
}
