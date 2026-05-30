import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import {
  ExternalLink,
  PackageCheck,
  RefreshCw,
  Store,
} from 'lucide-react';
import {
  canSendToFlex,
  DataFlowFilterBar,
  matchesDataFlowFilter,
  PartnerSearchInput,
  PartnerShell,
  PartnerToast,
  PluginRow,
  type DataFlowFilter,
  type PartnerTab,
  type PluginListing,
} from 'partner-ui';
import 'partner-ui/styles.css';

type AppId = 'eztrac' | 'rpt';
type SortMode = 'newest' | 'name';
const isExtension = Boolean((globalThis as { chrome?: { runtime?: { id?: string } } }).chrome?.runtime?.id);
const Router = isExtension ? HashRouter : BrowserRouter;

interface PublishedPlugin extends PluginListing {
  targetApp: AppId;
  publisher?: string;
  kind?: 'core' | 'extension';
  publishedAt: string;
}

/** Empty in dev — paths are `/api/v1/...` (Vite proxies `/api` → flex-api :3847). */
const API_URL =
  import.meta.env.VITE_FLEX_API_URL ??
  (import.meta.env.DEV ? '' : 'http://localhost:3847');

const APPS: Record<AppId, { label: string; url: string; summary: string }> = {
  eztrac: {
    label: 'EzTrac',
    url: 'http://localhost:5174/',
    summary: 'Finance forecasting and governed inbound requests.',
  },
  rpt: {
    label: 'dhub-rpt',
    url: 'http://localhost:5175/',
    summary: 'Resource planning and capacity sync with Flex.',
  },
};

async function readJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, init);
  const text = await res.text();
  const trimmed = text.trimStart();
  if (trimmed.startsWith('<!') || trimmed.startsWith('<html')) {
    throw new Error(
      'flex-api returned HTML instead of JSON — start it with npm run api (port 3847), then refresh.'
    );
  }
  let json: T & { error?: string };
  try {
    json = (text ? JSON.parse(text) : {}) as T & { error?: string };
  } catch {
    throw new Error(
      'Invalid response from flex-api — run npm run api in the project root, then refresh.'
    );
  }
  if (!res.ok) throw new Error(json.error ?? `Marketplace API ${res.status}`);
  return json as T;
}

function App() {
  const searchParams = new URLSearchParams(window.location.search);
  const selectedParam = searchParams.get('app');
  const initialApp: AppId = selectedParam === 'rpt' ? 'rpt' : 'eztrac';
  const initialTab = searchParams.get('tab') === 'installed' ? 'installed' : 'all';
  const initialFlow = searchParams.get('flow');
  const initialSort = searchParams.get('sort');

  const [selectedApp, setSelectedApp] = useState<AppId>(initialApp);
  const [tab, setTab] = useState<PartnerTab>(initialTab);
  const [published, setPublished] = useState<PublishedPlugin[]>([]);
  const [installed, setInstalled] = useState<string[]>([]);
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [flowFilter, setFlowFilter] = useState<DataFlowFilter>(
    initialFlow === 'send' || initialFlow === 'read' || initialFlow === 'both' ? initialFlow : 'all'
  );
  const [sortMode, setSortMode] = useState<SortMode>(initialSort === 'name' ? 'name' : 'newest');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedMeta = APPS[selectedApp];

  const reload = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const [plugins, installs] = await Promise.all([
        readJson<PublishedPlugin[]>(`/api/v1/partner-marketplace?app=${selectedApp}`),
        readJson<string[]>(`/api/v1/partner-marketplace/installed?app=${selectedApp}`),
      ]);
      setPublished(plugins);
      setInstalled(installs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load marketplace');
    } finally {
      setBusy(false);
    }
  }, [selectedApp]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const next = new URLSearchParams();
    next.set('app', selectedApp);
    next.set('tab', tab);
    if (search.trim()) next.set('q', search.trim());
    if (flowFilter !== 'all') next.set('flow', flowFilter);
    if (sortMode !== 'newest') next.set('sort', sortMode);
    const q = next.toString();
    window.history.replaceState(null, '', q ? `?${q}` : window.location.pathname);
  }, [selectedApp, tab, search, flowFilter, sortMode]);

  const installedSet = useMemo(() => new Set(installed), [installed]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const searched = published.filter((plugin) => {
      if (!q) return true;
      return (
        plugin.name.toLowerCase().includes(q) ||
        plugin.description.toLowerCase().includes(q) ||
        plugin.pluginId.toLowerCase().includes(q)
      );
    });
    return searched.sort((a, b) => {
      if (sortMode === 'name') return a.name.localeCompare(b.name);
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });
  }, [published, search, sortMode]);

  const tabPool =
    tab === 'installed'
      ? filtered.filter((plugin) => installedSet.has(plugin.pluginId))
      : filtered;

  const flowCounts = useMemo(() => {
    const count = (f: DataFlowFilter) => tabPool.filter((p) => matchesDataFlowFilter(p, f)).length;
    return {
      all: tabPool.length,
      send: count('send'),
      read: count('read'),
      both: count('both'),
    };
  }, [tabPool]);

  const visible = tabPool.filter((plugin) => matchesDataFlowFilter(plugin, flowFilter));

  const install = async (pluginId: string) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await readJson<{ installed: string[] }>('/api/v1/partner-marketplace/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app: selectedApp, pluginId }),
      });
      setInstalled(result.installed);
      setMessage(`Installed ${pluginId} in ${selectedMeta.label}`);
      setTab('installed');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Install failed');
    } finally {
      setBusy(false);
    }
  };

  const uninstall = async (pluginId: string) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await readJson<{ installed: string[] }>('/api/v1/partner-marketplace/uninstall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app: selectedApp, pluginId }),
      });
      setInstalled(result.installed);
      setMessage(`Removed ${pluginId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Uninstall failed');
    } finally {
      setBusy(false);
    }
  };

  const installVisible = async () => {
    if (visible.length === 0) return;
    const names = visible.map((p) => p.name).slice(0, 5);
    const more = visible.length > 5 ? `\n…and ${visible.length - 5} more` : '';
    if (
      !window.confirm(
        `Install ${visible.length} plugin(s) into ${selectedMeta.label}?\n\n${names.join('\n')}${more}`
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      let next = installed;
      for (const plugin of visible) {
        if (next.includes(plugin.pluginId)) continue;
        const result = await readJson<{ installed: string[] }>('/api/v1/partner-marketplace/install', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ app: selectedApp, pluginId: plugin.pluginId }),
        });
        next = result.installed;
      }
      setInstalled(next);
      setMessage(`Installed ${visible.length} plugin(s) for ${selectedMeta.label}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Install failed');
    } finally {
      setBusy(false);
    }
  };

  const uninstallVisible = async () => {
    if (visible.length === 0) return;
    const installedVisible = visible.filter((p) => installedSet.has(p.pluginId));
    if (installedVisible.length === 0) return;
    if (
      !window.confirm(
        `Remove ${installedVisible.length} plugin(s) from ${selectedMeta.label}? This only affects this app.`
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      let next = installed;
      for (const plugin of installedVisible) {
        const result = await readJson<{ installed: string[] }>('/api/v1/partner-marketplace/uninstall', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ app: selectedApp, pluginId: plugin.pluginId }),
        });
        next = result.installed;
      }
      setInstalled(next);
      setMessage(`Removed ${installedVisible.length} plugin(s) from ${selectedMeta.label}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Uninstall failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PartnerShell
      theme="market"
      brandIcon={<Store size={20} />}
      appName="Flex Marketplace"
      tagline="Publish once, install in partner apps"
      tab={tab}
      onTabChange={setTab}
      tabs={['all', 'installed']}
      stats={[
        { label: 'Target app', value: selectedMeta.label },
        { label: 'Available', value: published.length },
        { label: 'Can send to Flex', value: published.filter(canSendToFlex).length },
        { label: 'Installed', value: installed.length },
      ]}
      tabLabels={{ all: 'Catalog', installed: `Installed in ${selectedMeta.label}` }}
      tabBadges={{ installed: installed.length }}
      loading={busy}
      title={tab === 'installed' ? `Installed in ${selectedMeta.label}` : `Catalog for ${selectedMeta.label}`}
      subtitle={
        tab === 'installed'
          ? 'Plugins installed in this app only — other apps have their own install list.'
          : selectedMeta.summary
      }
      sidebarLinks={[
        { label: 'Flex publisher', href: 'http://localhost:5173/plugins', icon: <ExternalLink size={16} /> },
        { label: `Open ${selectedMeta.label}`, href: selectedMeta.url, icon: <ExternalLink size={16} /> },
      ]}
      topActions={null}
      toolbar={
        <>
          <div className="partner-toolbar">
            <PartnerSearchInput value={search} onChange={setSearch} placeholder="Search plugins…" />
            <div className="partner-toolbar-row">
              {(Object.keys(APPS) as AppId[]).map((appId) => (
                <button
                  key={appId}
                  type="button"
                  className={`btn ${selectedApp === appId ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setSelectedApp(appId)}
                >
                  {APPS[appId].label}
                </button>
              ))}
            </div>
            <div className="partner-toolbar-row partner-actions">
              <select
                className="partner-select"
                aria-label="Sort plugins"
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
              >
                <option value="newest" className="partner-select-option">Sort: newest</option>
                <option value="name" className="partner-select-option">Sort: name</option>
              </select>
              <button
                className={`btn btn-ghost${busy ? ' btn-spin-icon' : ''}`}
                type="button"
                disabled={busy}
                onClick={() => void reload()}
              >
                <RefreshCw size={16} />
                Refresh
              </button>
              <button
                className="btn btn-primary"
                type="button"
                disabled={busy || visible.length === 0}
                onClick={() => void installVisible()}
              >
                <PackageCheck size={16} />
                Install shown ({visible.length})
              </button>
              {(tab === 'installed' || tab === 'all') && (
                <button
                  className="btn btn-ghost"
                  type="button"
                  disabled={busy || visible.filter((p) => installedSet.has(p.pluginId)).length === 0}
                  onClick={() => void uninstallVisible()}
                >
                  Remove shown ({visible.filter((p) => installedSet.has(p.pluginId)).length})
                </button>
              )}
            </div>
          </div>
          <DataFlowFilterBar value={flowFilter} onChange={setFlowFilter} counts={flowCounts} />
          {message && (
            <PartnerToast variant="success" onDismiss={() => setMessage(null)}>
              {message}
            </PartnerToast>
          )}
          {error && (
            <PartnerToast variant="error" onDismiss={() => setError(null)}>
              {error}. Run <code>npm run api</code> in the project root (port 3847), then refresh.
            </PartnerToast>
          )}
        </>
      }
    >
      {visible.length === 0 ? (
        <div className="partner-empty">
          <h3>
            {flowFilter !== 'all'
              ? 'No plugins match this filter'
              : tab === 'installed'
                ? 'Nothing installed yet'
                : 'No plugins published'}
          </h3>
          <p>
            {flowFilter !== 'all'
              ? 'Try another data-flow filter or clear the search box.'
              : tab === 'installed'
                ? `Switch to Catalog and install plugins for ${selectedMeta.label}.`
                : 'Publish from Flex → Plugins, then refresh.'}
          </p>
        </div>
      ) : (
        <div className="plugin-list">
          {visible.map((plugin) => (
            <PluginRow
              key={plugin.pluginId}
              plugin={plugin}
              installed={installedSet.has(plugin.pluginId)}
              busy={busy}
              mode="install"
              onInstall={() => void install(plugin.pluginId)}
              onUninstall={() => void uninstall(plugin.pluginId)}
            />
          ))}
        </div>
      )}
    </PartnerShell>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router>
      <App />
    </Router>
  </React.StrictMode>
);
