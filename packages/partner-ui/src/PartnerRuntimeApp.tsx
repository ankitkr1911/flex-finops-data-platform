import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, RefreshCw, Store } from 'lucide-react';
import { PartnerSearchInput } from './PartnerSearchInput';
import { PartnerToast } from './PartnerToast';
import { createPartnerPluginClient } from 'flex-plugin-sdk';
import { OutputPanel } from './OutputPanel';
import { PartnerShell } from './PartnerShell';
import { PartnerWorkspace } from './PartnerWorkspace';
import {
  createImport,
  loadImports,
  saveImports,
  upsertImport,
  type ConsumeResponse,
  type PluginImport,
} from './pluginImport';
import type { PartnerAppId } from './partnerLocalContext';
import type { WorkspaceInsight } from './partnerInsights';
import { PluginRow } from './PluginRow';
import { DataFlowFilterBar } from './DataFlowFilterBar';
import { SendToFlexDialog } from './SendToFlexDialog';
import { buildProducePlans } from './produceFromImport';
import {
  matchesDataFlowFilter,
  type DataFlowFilter,
  type PartnerTab,
  type PluginListing,
} from './types';
import { flexApiBaseUrl } from './flexApiBase';

/** Flex state uses eztrac | dhub-rpt — not marketplace app id "rpt". */
function flexPartnerId(appId: PartnerAppId): 'eztrac' | 'dhub-rpt' {
  return appId === 'eztrac' ? 'eztrac' : 'dhub-rpt';
}

export interface PartnerRuntimeConfig {
  appId: PartnerAppId;
  appName: string;
  theme: 'emerald' | 'violet';
  tagline: string;
  marketplaceUrl: string;
}

function runtimePrefsKey(appId: PartnerAppId): string {
  return `flex_partner_runtime_prefs_v1:${appId}`;
}

function isEmbedMode(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('embed') === '1';
}

export function PartnerRuntimeApp({
  appId,
  appName,
  theme,
  tagline,
  marketplaceUrl,
}: PartnerRuntimeConfig) {
  const embed = isEmbedMode();
  const apiUrl = flexApiBaseUrl();
  const client = useMemo(
    () => createPartnerPluginClient(appId, { apiUrl }),
    [appId, apiUrl]
  );

  const savedPrefs = (() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(runtimePrefsKey(appId));
      return raw ? (JSON.parse(raw) as { tab?: PartnerTab; search?: string; flow?: DataFlowFilter }) : null;
    } catch {
      return null;
    }
  })();

  const [tab, setTab] = useState<PartnerTab>(
    savedPrefs?.tab === 'installed' ? savedPrefs.tab : 'workspace'
  );
  const [published, setPublished] = useState<PluginListing[]>([]);
  const [installed, setInstalled] = useState<string[]>([]);
  const [search, setSearch] = useState(savedPrefs?.search ?? '');
  const [flowFilter, setFlowFilter] = useState<DataFlowFilter>(
    savedPrefs?.flow === 'send' || savedPrefs?.flow === 'read' || savedPrefs?.flow === 'both'
      ? savedPrefs.flow
      : 'all'
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [sendOutput, setSendOutput] = useState<unknown>(null);
  const [imports, setImports] = useState<PluginImport[]>(() => loadImports(appId));
  const [selectedImportId, setSelectedImportId] = useState<string | null>(null);
  const [sendTarget, setSendTarget] = useState<{ plugin: PluginListing; dataset: string } | null>(
    null
  );
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);

  useEffect(() => {
    saveImports(appId, imports);
  }, [appId, imports]);

  useEffect(() => {
    try {
      localStorage.setItem(
        runtimePrefsKey(appId),
        JSON.stringify({ tab, search, flow: flowFilter })
      );
    } catch {
      // best-effort preference persistence
    }
  }, [appId, tab, search, flowFilter]);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(`${apiUrl}/health`);
        if (!cancelled) setApiOnline(res.ok);
      } catch {
        if (!cancelled) setApiOnline(false);
      }
    };
    void check();
    const interval = window.setInterval(() => void check(), 10000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [apiUrl]);

  const defaultFlexDataset = appId === 'eztrac' ? 'forecast_variance' : 'capacity_forecast';

  const reload = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const [publishedRows, installedIds] = await Promise.all([
        client.listPublishedPlugins() as Promise<PluginListing[]>,
        client.listInstalledPluginsRemote(),
      ]);
      setPublished(publishedRows);
      setInstalled(installedIds);
      setApiOnline(true);
    } catch (e) {
      setApiOnline(false);
      setError(
        e instanceof Error
          ? `${e.message} — is flex-api running? (npm run api)`
          : 'Could not load plugins — is flex-api running? (npm run api)'
      );
    } finally {
      setBusy(false);
    }
  }, [client]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const installedSet = useMemo(() => new Set(installed), [installed]);
  const partner = flexPartnerId(appId);

  const publishedById = useMemo(
    () => new Map(published.map((plugin) => [plugin.pluginId, plugin])),
    [published]
  );

  const installedPlugins = useMemo(
    () =>
      installed.map((pluginId) => {
        const meta = publishedById.get(pluginId);
        if (meta) return meta;
        return {
          pluginId,
          name: pluginId,
          version: '—',
          description: 'Installed from marketplace',
        } as PluginListing;
      }),
    [installed, publishedById]
  );

  const searched = installedPlugins.filter((plugin) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      plugin.name.toLowerCase().includes(q) ||
      plugin.description.toLowerCase().includes(q) ||
      plugin.pluginId.toLowerCase().includes(q)
    );
  });

  const flowCounts = useMemo(() => {
    const base = searched;
    const count = (f: DataFlowFilter) => base.filter((p) => matchesDataFlowFilter(p, f)).length;
    return {
      all: base.length,
      send: count('send'),
      read: count('read'),
      both: count('both'),
    };
  }, [searched]);

  const visible =
    tab === 'installed'
      ? searched.filter((plugin) => matchesDataFlowFilter(plugin, flowFilter))
      : [];

  const pluginDisplayName = (pluginId: string) =>
    publishedById.get(pluginId)?.name ?? pluginId;

  const runRead = async (pluginId: string, dataset: string) => {
    if (!installedSet.has(pluginId)) {
      setError(`Install ${pluginId} in the marketplace first, then return here.`);
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    setSendOutput(null);
    try {
      const params =
        pluginId === 'flex.integrations' && dataset === 'partner_consumption'
          ? { partner }
          : undefined;
      const result = (await client.consume({ pluginId, dataset, params })) as ConsumeResponse;
      if (!result?.ok) {
        setError(result?.error ?? `Read failed for ${pluginId}/${dataset}`);
        return;
      }
      const imp = createImport(pluginId, pluginDisplayName(pluginId), dataset, result);
      if (!imp) {
        setError('No records returned from Flex');
        return;
      }
      setImports((prev) => upsertImport(prev, imp));
      setSelectedImportId(imp.id);
      setTab('workspace');
      setMessage(`Imported ${dataset} into ${appName} workspace`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Read failed');
    } finally {
      setBusy(false);
    }
  };

  const confirmSend = async (pluginId: string, dataset: string, records: unknown[]) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await client.produce({
        pluginId,
        dataset,
        records,
        sourceApp: partner,
        destinationApp: 'flex',
      });
      setSendOutput(result);
      setSendTarget(null);
      const ok = result && typeof result === 'object' && 'ok' in result && (result as { ok: boolean }).ok;
      if (!ok) {
        const errMsg =
          result && typeof result === 'object' && 'error' in result
            ? String((result as { error: string }).error)
            : 'Send failed';
        setError(errMsg);
        return;
      }
      setMessage(
        result && typeof result === 'object' && 'message' in result
          ? String((result as { message: string }).message)
          : `Delivered to Flex — open Flex (localhost:5173) to see updates live`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Send failed');
    } finally {
      setBusy(false);
    }
  };

  const uninstallPlugin = async (pluginId: string) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const next = await client.uninstallPublishedPlugin(pluginId);
      setInstalled(next);
      setMessage(`Removed ${pluginDisplayName(pluginId)} from ${appName}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Uninstall failed');
    } finally {
      setBusy(false);
    }
  };

  const selectedImport = imports.find((i) => i.id === selectedImportId) ?? imports[0];

  const workspacePlans = selectedImport
    ? buildProducePlans(selectedImport, partner, defaultFlexDataset)
    : [];

  const updateImportRecords = useCallback((importId: string, records: Record<string, unknown>[]) => {
    setImports((prev) => prev.map((i) => (i.id === importId ? { ...i, records } : i)));
  }, []);

  const sendImportToFlex = async (imp: PluginImport) => {
    const plans = buildProducePlans(imp, partner, defaultFlexDataset);
    if (!plans.length) {
      setError('Nothing to send. Edit at least one row or set an anomaly status to Resolved.');
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    const messages: string[] = [];
    try {
      for (const plan of plans) {
        const result = await client.produce({
          pluginId: plan.pluginId,
          dataset: plan.dataset,
          records: plan.records,
          sourceApp: partner,
          destinationApp: 'flex',
        });
        const ok =
          result && typeof result === 'object' && 'ok' in result && (result as { ok: boolean }).ok;
        if (!ok) {
          const errMsg =
            result && typeof result === 'object' && 'error' in result
              ? String((result as { error: string }).error)
              : `${plan.label} failed`;
          setError(errMsg);
          return;
        }
        const msg =
          result && typeof result === 'object' && 'message' in result
            ? String((result as { message: string }).message)
            : plan.label;
        messages.push(msg);
      }
      setSendOutput({ ok: true, messages });
      setMessage(
        `Sent ${plans.length} update(s) to Flex — updates sync live to Flex (localhost:5173)`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Send failed');
    } finally {
      setBusy(false);
    }
  };

  const openSendFromWorkspace = () => {
    if (!selectedImport) return;
    void sendImportToFlex(selectedImport);
  };

  const handleInsightAction = (insight: WorkspaceInsight) => {
    setMessage(
      insight.actionLabel === 'Map to initiatives'
        ? 'Demo: chargeback rows queued for VIP initiative mapping in EzTrac.'
        : insight.actionLabel === 'Flag in forecast'
          ? 'Demo: anomalies flagged in Q3 risk-adjusted forecast model.'
          : insight.actionLabel === 'Update capacity board'
            ? 'Demo: allocation data applied to squad capacity board in dhub-rpt.'
            : `Action: ${insight.title}`
    );
  };

  const titleByTab: Record<PartnerTab, string> = {
    workspace: `${appName} data workspace`,
    installed: `Installed in ${appName}`,
    all: `Installed in ${appName}`,
  };

  const subtitleByTab: Record<PartnerTab, string> = {
    workspace:
      'Pull data from Flex, explore in Read mode, then switch to Edit & send when you need to push changes.',
    installed:
      'Read imports data below. Send pushes governed payloads back to Flex (see “Read & send” plugins).',
    all: 'Install plugins from Marketplace, then use Installed to run read/send actions.',
  };

  return (
    <PartnerShell
      embed={embed}
      theme={theme}
      brandIcon={<span>{appName.slice(0, 2)}</span>}
      appName={appName}
      tagline={tagline}
      tab={tab}
      onTabChange={setTab}
      tabs={['workspace', 'installed']}
      tabBadges={{ workspace: imports.length }}
      loading={busy}
      stats={[
        { label: 'Workspace feeds', value: imports.length },
        { label: 'Installed', value: installed.length },
        { label: 'Published', value: published.length },
        { label: 'Partner id', value: partner },
      ]}
      title={titleByTab[tab]}
      subtitle={subtitleByTab[tab]}
      sidebarLinks={
        embed
          ? undefined
          : [
              { label: 'Install plugins', href: marketplaceUrl, icon: <Store size={16} /> },
              { label: 'Open Flex', href: 'http://localhost:5173/', icon: <ExternalLink size={16} /> },
            ]
      }
      topActions={
        <button
          className={`btn btn-ghost${busy ? ' btn-spin-icon' : ''}`}
          type="button"
          disabled={busy}
          onClick={() => void reload()}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      }
      toolbar={
        tab === 'installed' ? (
          <>
            <div className="partner-toolbar">
              <PartnerSearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search installed plugins…"
              />
            </div>
            <DataFlowFilterBar value={flowFilter} onChange={setFlowFilter} counts={flowCounts} />
            {message && (
              <PartnerToast variant="success" onDismiss={() => setMessage(null)}>
                {message}
              </PartnerToast>
            )}
            {apiOnline === false && (
              <PartnerToast variant="error" onDismiss={() => setApiOnline(null)}>
                Cannot reach flex-api at {apiUrl}. Run <code>npm run api</code> in the project root, then
                refresh.
              </PartnerToast>
            )}
            {error && (
              <PartnerToast variant="error" onDismiss={() => setError(null)}>
                {error}. Install plugins in the marketplace (pick {appName}), then return here.
              </PartnerToast>
            )}
          </>
        ) : (
          <>
            {message && (
              <PartnerToast variant="success" onDismiss={() => setMessage(null)}>
                {message}
              </PartnerToast>
            )}
            {apiOnline === false && (
              <PartnerToast variant="error" onDismiss={() => setApiOnline(null)}>
                Cannot reach flex-api. Run <code>npm run api</code>, then refresh.
              </PartnerToast>
            )}
            {error && (
              <PartnerToast variant="error" onDismiss={() => setError(null)}>
                {error}
              </PartnerToast>
            )}
          </>
        )
      }
      footer={
        sendOutput ? (
          <OutputPanel
            output={sendOutput}
            title="Last send to Flex"
            onClear={() => setSendOutput(null)}
          />
        ) : null
      }
    >
      {tab === 'workspace' ? (
        <PartnerWorkspace
          appId={appId as PartnerAppId}
          appName={appName}
          marketplaceUrl={marketplaceUrl}
          imports={imports}
          selectedId={selectedImportId}
          onSelect={setSelectedImportId}
          onRemove={(id) => {
            setImports((prev) => prev.filter((i) => i.id !== id));
            if (selectedImportId === id) setSelectedImportId(null);
          }}
          onClearAll={() => {
            setImports([]);
            setSelectedImportId(null);
          }}
          onInsightAction={handleInsightAction}
          onRead={(pluginId, dataset) => void runRead(pluginId, dataset)}
          onOpenInstalledTab={() => setTab('installed')}
          busy={busy}
          canSendSelected={workspacePlans.length > 0}
          sendPreview={
            workspacePlans.length > 0
              ? `Ready to send ${workspacePlans.length} update(s): ${workspacePlans.map((p) => p.label).join(', ')}`
              : 'Edit imported rows to enable send.'
          }
          onUpdateRecords={updateImportRecords}
          onSendSelected={openSendFromWorkspace}
        />
      ) : visible.length === 0 ? (
        <div className="partner-empty">
          <h3>
            {flowFilter !== 'all'
              ? 'No plugins match this filter'
              : `No plugins installed in ${appName}`}
          </h3>
          <p>
            Install plugins in the{' '}
            <a href={marketplaceUrl} target="_blank" rel="noreferrer">
              marketplace
            </a>{' '}
            (select {appName}), then use Read / Send here.
          </p>
        </div>
      ) : (
        <div className="plugin-list">
          {visible.map((plugin) => (
            <PluginRow
              key={plugin.pluginId}
              plugin={plugin}
              installed
              busy={busy}
              mode="runtime"
              onUninstall={() => void uninstallPlugin(plugin.pluginId)}
              onRead={(dataset) => void runRead(plugin.pluginId, dataset)}
              onSend={(dataset) => setSendTarget({ plugin, dataset })}
            />
          ))}
        </div>
      )}

      {tab === 'installed' && imports.length > 0 && (
        <p className="partner-workspace-hint">
          {imports.length} dataset(s) in workspace —{' '}
          <button type="button" className="link-btn" onClick={() => setTab('workspace')}>
            Open data workspace
          </button>
        </p>
      )}

      <SendToFlexDialog
        open={sendTarget !== null}
        plugin={sendTarget?.plugin ?? null}
        dataset={sendTarget?.dataset ?? 'inbound_request'}
        appName={appName}
        partner={partner}
        defaultFlexDataset={defaultFlexDataset}
        busy={busy}
        onClose={() => setSendTarget(null)}
        onSend={(dataset, records) => {
          if (!sendTarget) return;
          void confirmSend(sendTarget.plugin.pluginId, dataset, records);
        }}
      />
    </PartnerShell>
  );
}
