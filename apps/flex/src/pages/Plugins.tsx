import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  CheckCircle2,
  PackageOpen,
  Search,
  Send,
  UploadCloud,
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Badge } from '../components/Badge';
import { useFlexPlugins } from '../hooks/useFlexPlugins';
import { useInstalledExtensions } from '../hooks/useInstalledExtensions';
import {
  partnerDisplayName,
  listPublishedPartnerPlugins,
  publishPartnerPlugin,
  setPublishedPartnerPluginEnabled,
  type PartnerMarketplaceAppId,
} from '../lib/partnerMarketplace';
import type { PluginCatalogEntry, PluginDataset } from '../plugins/types';

type PublishTarget = 'all' | PartnerMarketplaceAppId;

const MARKETPLACE_URL = 'http://localhost:5176/';

function directionLabel(direction: PluginDataset['direction']) {
  if (direction === 'inbound') return 'Accepts';
  if (direction === 'bidirectional') return 'Both ways';
  return 'Read';
}

function targetApps(target: PublishTarget): PartnerMarketplaceAppId[] {
  return target === 'all' ? ['eztrac', 'rpt'] : [target];
}

function targetLabel(target: PublishTarget): string {
  return target === 'all' ? 'EzTrac and dhub-rpt' : partnerDisplayName(target);
}

export function Plugins() {
  const { catalog } = useFlexPlugins();
  const extensions = useInstalledExtensions();
  const [target, setTarget] = useState<PublishTarget>('all');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [publishedByTarget, setPublishedByTarget] = useState<
    Record<PartnerMarketplaceAppId, Map<string, { enabled: boolean }>>
  >({ eztrac: new Map(), rpt: new Map() });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const marketplaceById = useMemo(
    () => new Map(extensions.marketplace.map((item) => [item.id, item])),
    [extensions.marketplace]
  );

  const publishablePlugins = useMemo(
    () =>
      [...catalog]
        .filter((plugin) => plugin.capabilities.consume || plugin.capabilities.produce)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [catalog]
  );

  const filtered = publishablePlugins.filter((plugin) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      plugin.name.toLowerCase().includes(q) ||
      plugin.description.toLowerCase().includes(q) ||
      plugin.id.toLowerCase().includes(q)
    );
  });

  const publishOne = async (plugin: PluginCatalogEntry) => {
    setBusyId(plugin.id);
    setMessage(null);
    setError(null);
    try {
      const listing = marketplaceById.get(plugin.id);
      for (const targetApp of targetApps(target)) {
        await publishPartnerPlugin({
          plugin,
          targetApp,
          icon: listing?.icon,
          permissions: listing?.permissions,
        });
      }
      await reloadPublished();
      setMessage(`${plugin.name} published to ${targetLabel(target)}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Publish failed');
    } finally {
      setBusyId(null);
    }
  };

  const reloadPublished = async () => {
    const [eztrac, rpt] = await Promise.all([
      listPublishedPartnerPlugins('eztrac', { includeDisabled: true }),
      listPublishedPartnerPlugins('dhub-rpt', { includeDisabled: true }),
    ]);
    const toMap = (rows: { pluginId: string; enabled?: boolean }[]) =>
      new Map(rows.map((r) => [r.pluginId, { enabled: r.enabled !== false }]));
    setPublishedByTarget({
      eztrac: toMap(eztrac),
      rpt: toMap(rpt),
    });
  };

  const toggleEnabled = async (plugin: PluginCatalogEntry, enabled: boolean) => {
    setBusyId(`${plugin.id}:toggle`);
    setMessage(null);
    setError(null);
    try {
      for (const targetApp of targetApps(target)) {
        await setPublishedPartnerPluginEnabled(targetApp, plugin.id, enabled);
      }
      await reloadPublished();
      setMessage(
        `${plugin.name} ${enabled ? 'enabled' : 'disabled'} for ${targetLabel(target)}.`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Toggle failed');
    } finally {
      setBusyId(null);
    }
  };

  const publishAll = async () => {
    setBusyId('all');
    setMessage(null);
    setError(null);
    try {
      for (const plugin of filtered) {
        const listing = marketplaceById.get(plugin.id);
        for (const targetApp of targetApps(target)) {
          await publishPartnerPlugin({
            plugin,
            targetApp,
            icon: listing?.icon,
            permissions: listing?.permissions,
          });
        }
      }
      await reloadPublished();
      setMessage(`${filtered.length} plugin(s) published to ${targetLabel(target)}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Publish all failed');
    } finally {
      setBusyId(null);
    }
  };

  useEffect(() => {
    void reloadPublished();
  }, []);

  return (
    <div className="page-shell max-w-4xl">
      <PageHeader
        title="Marketplace publisher"
        description="Publish plugin contracts to EzTrac and dhub-rpt. Partner apps install from the standalone marketplace."
        action={
          <a
            href={MARKETPLACE_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-flex-accent/15 text-flex-accent border border-flex-accent/40 text-sm font-medium"
          >
            Open marketplace
            <ArrowUpRight className="w-4 h-4" />
          </a>
        }
      />

      <div className="page-toolbar">
        <label className="flex flex-1 min-h-10 items-center gap-2 px-3 rounded-lg bg-flex-surface/60 border border-flex-border/40 sm:max-w-md">
          <Search className="w-4 h-4 text-flex-muted shrink-0" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search plugins…"
            className="w-full bg-transparent border-0 outline-none text-sm"
          />
        </label>
        <div className="filter-chips p-1 rounded-lg bg-flex-surface/40 border border-flex-border/30">
          {(
            [
              ['all', 'Both'],
              ['eztrac', 'EzTrac'],
              ['rpt', 'dhub-rpt'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTarget(id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                target === id
                  ? 'bg-flex-accent/20 text-flex-accent'
                  : 'text-flex-muted hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="page-toolbar mb-4">
        <p className="text-xs text-flex-muted">
          Target: <span className="text-slate-300">{targetLabel(target)}</span>
          <span className="mx-2 text-flex-border">·</span>
          {filtered.length} plugin{filtered.length === 1 ? '' : 's'}
        </p>
        <button
          type="button"
          disabled={busyId !== null || filtered.length === 0}
          onClick={() => void publishAll()}
          className="btn-outline-accent text-xs"
        >
          <UploadCloud className="w-3.5 h-3.5" />
          Publish all shown
        </button>
      </div>

      {message && (
        <div className="mb-4 px-3 py-2.5 rounded-lg border border-flex-success/40 bg-flex-success/10 text-sm text-flex-success flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {message}
        </div>
      )}
      {error && (
        <div className="mb-4 px-3 py-2.5 rounded-lg border border-flex-danger/40 bg-flex-danger/10 text-sm text-flex-danger">
          {error}. Start the API with <code className="text-xs">npm run api</code>.
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-xl p-10 border border-dashed border-flex-border/50 text-center">
          <PackageOpen className="w-8 h-8 mx-auto text-flex-muted mb-2" />
          <p className="text-sm font-medium">No matching plugins</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((plugin) => {
            const listing = marketplaceById.get(plugin.id);
            const targetAppsList = targetApps(target);
            const targetMeta = targetAppsList.map((appId) => publishedByTarget[appId].get(plugin.id));
            const isPublished = targetMeta.every(Boolean);
            const isEnabled = targetMeta.every((m) => (m?.enabled ?? false) === true);
            return (
              <li
                key={plugin.id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border border-flex-border/35 bg-flex-surface/25 hover:border-flex-accent/25 transition-colors"
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <span className="w-9 h-9 rounded-lg bg-flex-accent/10 border border-flex-accent/20 flex items-center justify-center text-lg shrink-0">
                    {listing?.icon ?? '◆'}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium text-sm">{plugin.name}</h3>
                      <Badge variant="neutral">v{plugin.version}</Badge>
                      {plugin.kind && (
                        <Badge variant={plugin.kind === 'extension' ? 'info' : 'neutral'}>
                          {plugin.kind}
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] font-mono text-flex-muted mt-0.5 truncate">{plugin.id}</p>
                    <p className="text-xs text-flex-muted mt-1 line-clamp-2">{plugin.description}</p>
                    {plugin.datasets.length > 0 && (
                      <p className="text-[10px] text-flex-muted mt-2">
                        {plugin.datasets.slice(0, 3).map((d) => (
                          <span key={d.name} className="mr-2">
                            {d.description || d.name}
                            <span className="text-flex-border mx-1">·</span>
                            {directionLabel(d.direction)}
                          </span>
                        ))}
                        {plugin.datasets.length > 3 && `+${plugin.datasets.length - 3} more`}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busyId !== null}
                  onClick={() => void publishOne(plugin)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-flex-accent/15 text-flex-accent border border-flex-accent/40 text-sm font-medium disabled:opacity-50 shrink-0"
                >
                  <Send className="w-4 h-4" />
                  {busyId === plugin.id ? 'Publishing…' : 'Publish'}
                </button>
                {isPublished && (
                  <button
                    type="button"
                    disabled={busyId !== null}
                    onClick={() => void toggleEnabled(plugin, !isEnabled)}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium disabled:opacity-50 shrink-0"
                  >
                    {busyId === `${plugin.id}:toggle`
                      ? 'Saving…'
                      : isEnabled
                        ? 'Disable'
                        : 'Enable'}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
