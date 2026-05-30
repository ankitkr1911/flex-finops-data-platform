import * as React from 'react';
import type { ReactNode } from 'react';

export const FLEX_PLUGIN_CHANNEL = 'flex-plugin-api';
export const PLUGIN_API_VERSION = '1.0.0';

export interface PluginConsumeRequest {
  pluginId: string;
  dataset?: string;
  params?: Record<string, unknown>;
}

export interface PluginProduceRequest {
  pluginId: string;
  dataset: string;
  records: unknown[];
  sourceApp?: 'eztrac' | 'dhub-rpt';
  destinationApp?: 'flex';
  metadata?: Record<string, unknown>;
}

export interface FlexPluginClientOptions {
  /** Target window when using postMessage (e.g. Flex side panel). */
  target?: Window;
  /** Use BroadcastChannel to reach Flex in another tab (same origin). Default true when no target. */
  useBroadcast?: boolean;
  /** REST API (VS Code, Node) — default http://localhost:3847 */
  apiUrl?: string;
  timeoutMs?: number;
}

interface BridgeMessage {
  channel: typeof FLEX_PLUGIN_CHANNEL;
  id: string;
  method: 'catalog' | 'consume' | 'produce';
  payload?: PluginConsumeRequest | PluginProduceRequest;
}

interface BridgeResponse {
  channel: typeof FLEX_PLUGIN_CHANNEL;
  id: string;
  ok: boolean;
  result?: unknown;
  error?: string;
}

type FlexPluginsApi = {
  catalog: () => unknown;
  consume: (r: PluginConsumeRequest) => unknown;
  produce: (r: PluginProduceRequest) => unknown;
};

export type PartnerAppId = 'eztrac' | 'rpt';

export interface PartnerPluginDefinition {
  id: string;
  name: string;
  description: string;
  allowedApps: PartnerAppId[];
}

export interface PublishedPartnerPlugin {
  pluginId: string;
  name: string;
  version: string;
  description: string;
  targetApp: PartnerAppId;
  publisher?: string;
  icon?: string;
  category?: string;
  permissions?: string[];
  kind?: 'core' | 'extension';
  datasets?: unknown[];
  enabled?: boolean;
  publishedAt: string;
}

const PARTNER_PLUGIN_CATALOG: PartnerPluginDefinition[] = [
  {
    id: 'flex.chargeback',
    name: 'Chargeback',
    description: 'Team showback and cost views.',
    allowedApps: ['eztrac'],
  },
  {
    id: 'flex.resources',
    name: 'Resources',
    description: 'Allocation and capacity datasets.',
    allowedApps: ['rpt'],
  },
  {
    id: 'flex.partner.eztrac',
    name: 'EzTrac Contract',
    description: 'Partner contract for EzTrac requests to Flex.',
    allowedApps: ['eztrac'],
  },
  {
    id: 'flex.partner.dhub-rpt',
    name: 'RPT Contract',
    description: 'Partner contract for RPT requests to Flex.',
    allowedApps: ['rpt'],
  },
];

function getInstallKey(appId: PartnerAppId): string {
  return `flex_partner_installed_plugins_v1:${appId}`;
}

function readInstalled(appId: PartnerAppId): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(getInstallKey(appId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeInstalled(appId: PartnerAppId, pluginIds: string[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(getInstallKey(appId), JSON.stringify(Array.from(new Set(pluginIds))));
}

function mapSourceApp(appId: PartnerAppId): 'eztrac' | 'dhub-rpt' {
  return appId === 'eztrac' ? 'eztrac' : 'dhub-rpt';
}

/** True when REST mode is configured (`''` is valid — same-origin Vite proxy to flex-api). */
function hasConfiguredApiUrl(options: FlexPluginClientOptions): boolean {
  return typeof options.apiUrl === 'string';
}

function resolveApiUrl(options: FlexPluginClientOptions): string | undefined {
  if (typeof options.apiUrl === 'string') return options.apiUrl;
  const fromEnv =
    typeof process !== 'undefined' ? process.env.FLEX_API_URL : undefined;
  return typeof fromEnv === 'string' && fromEnv.trim() ? fromEnv : undefined;
}

function assertPluginAvailableForApp(appId: PartnerAppId, pluginId: string): void {
  const inCatalog = PARTNER_PLUGIN_CATALOG.find((p) => p.id === pluginId && p.allowedApps.includes(appId));
  if (!inCatalog) {
    throw new Error(`Plugin ${pluginId} is not available for app ${appId}`);
  }
  const installed = readInstalled(appId);
  if (!installed.includes(pluginId)) {
    throw new Error(`Plugin ${pluginId} is not installed in app ${appId}`);
  }
}

function broadcastRequest<T>(
  method: BridgeMessage['method'],
  payload: PluginConsumeRequest | PluginProduceRequest | undefined,
  timeoutMs: number
): Promise<T> {
  return new Promise((resolve, reject) => {
    const bc = new BroadcastChannel(FLEX_PLUGIN_CHANNEL);
    const id = `fpsdk-bc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const onMsg = (ev: MessageEvent) => {
      const data = ev.data as BridgeResponse | undefined;
      if (!data || data.channel !== FLEX_PLUGIN_CHANNEL || data.id !== id) return;
      bc.removeEventListener('message', onMsg);
      bc.close();
      if (data.ok) resolve(data.result as T);
      else reject(new Error(data.error ?? 'Flex plugin request failed'));
    };
    bc.addEventListener('message', onMsg);
    bc.postMessage({ channel: FLEX_PLUGIN_CHANNEL, id, method, payload } satisfies BridgeMessage);
    setTimeout(() => {
      bc.removeEventListener('message', onMsg);
      bc.close();
      reject(new Error('flex-plugin-sdk: Flex not reachable via BroadcastChannel — is Flex tab open?'));
    }, timeoutMs);
  });
}

async function restRequest<T>(
  method: BridgeMessage['method'],
  payload: PluginConsumeRequest | PluginProduceRequest | undefined,
  apiUrl: string
): Promise<T> {
  const path =
    method === 'catalog' ? '/api/v1/catalog' : method === 'consume' ? '/api/v1/consume' : '/api/v1/produce';
  const res = await fetch(`${apiUrl}${path}`, {
    method: method === 'catalog' ? 'GET' : 'POST',
    headers: method === 'catalog' ? undefined : { 'Content-Type': 'application/json' },
    body: method === 'catalog' ? undefined : JSON.stringify(payload),
  });
  const json = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `Flex API ${res.status}`);
  return json;
}

function request<T>(
  method: BridgeMessage['method'],
  payload: PluginConsumeRequest | PluginProduceRequest | undefined,
  options: FlexPluginClientOptions
): Promise<T> {
  const apiUrl = resolveApiUrl(options);
  if (apiUrl !== undefined) {
    return restRequest<T>(method, payload, apiUrl);
  }

  const caller =
    typeof window !== 'undefined' ? window : undefined;
  if (!caller) {
    return Promise.reject(
      new Error('flex-plugin-sdk: use apiUrl for Node/VS Code or open in browser with Flex tab')
    );
  }

  const target = options.target;
  const localApi = (caller as Window & { FlexPlugins?: FlexPluginsApi }).FlexPlugins;

  /** Same tab/window as Flex — call API directly */
  if (!target && localApi) {
    if (method === 'catalog') return Promise.resolve(localApi.catalog() as T);
    if (method === 'consume' && payload) {
      return Promise.resolve(localApi.consume(payload as PluginConsumeRequest) as T);
    }
    if (method === 'produce' && payload) {
      return Promise.resolve(localApi.produce(payload as PluginProduceRequest) as T);
    }
  }

  /** Another tab — BroadcastChannel (same origin, Flex tab open) */
  const useBroadcast = options.useBroadcast !== false;
  if (!target && useBroadcast && typeof BroadcastChannel !== 'undefined') {
    return broadcastRequest<T>(method, payload, options.timeoutMs ?? 10000);
  }

  if (!target) {
    return Promise.reject(
      new Error(
        'flex-plugin-sdk: Open Flex in another tab (same browser) or pass options.target = flexWindow.'
      )
    );
  }

  /** Same-origin: optional direct call on target without postMessage */
  try {
    const targetApi = (target as Window & { FlexPlugins?: FlexPluginsApi }).FlexPlugins;
    if (targetApi) {
      if (method === 'catalog') return Promise.resolve(targetApi.catalog() as T);
      if (method === 'consume' && payload) {
        return Promise.resolve(targetApi.consume(payload as PluginConsumeRequest) as T);
      }
      if (method === 'produce' && payload) {
        return Promise.resolve(targetApi.produce(payload as PluginProduceRequest) as T);
      }
    }
  } catch {
    /* cross-origin — fall through to postMessage */
  }

  return new Promise((resolve, reject) => {
    const id = `fpsdk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const timeout = options.timeoutMs ?? 10000;

    const handler = (event: MessageEvent) => {
      const data = event.data as BridgeResponse | undefined;
      if (!data || data.channel !== FLEX_PLUGIN_CHANNEL || data.id !== id) return;
      caller.removeEventListener('message', handler);
      if (data.ok) resolve(data.result as T);
      else reject(new Error(data.error ?? 'Flex plugin request failed'));
    };

    caller.addEventListener('message', handler);
    target.postMessage(
      { channel: FLEX_PLUGIN_CHANNEL, id, method, payload } satisfies BridgeMessage,
      '*'
    );

    setTimeout(() => {
      caller.removeEventListener('message', handler);
      reject(
        new Error(
          'flex-plugin-sdk: bridge timeout — is Flex open, same browser profile, and extensions enabled?'
        )
      );
    }, timeout);
  });
}

/** Client for Flex plugin API — use in partner apps, scripts, or extension pages */
export class FlexPluginClient {
  constructor(private options: FlexPluginClientOptions = {}) {}

  catalog() {
    return request<unknown[]>('catalog', undefined, this.options);
  }

  consume(req: PluginConsumeRequest) {
    return request<unknown>('consume', req, this.options);
  }

  produce(req: PluginProduceRequest) {
    return request<unknown>('produce', req, this.options);
  }
}

export class PartnerPluginClient {
  constructor(
    private appId: PartnerAppId,
    private base = new FlexPluginClient(),
    private options: FlexPluginClientOptions = {}
  ) {}

  pluginCatalog() {
    return PARTNER_PLUGIN_CATALOG.filter((p) => p.allowedApps.includes(this.appId));
  }

  catalog() {
    return this.base.catalog();
  }

  listInstalledPlugins() {
    return readInstalled(this.appId);
  }

  private getApiUrl(): string {
    if (!hasConfiguredApiUrl(this.options)) {
      throw new Error(
        'Partner marketplace actions require apiUrl — is flex-api running? (npm run api)'
      );
    }
    return this.options.apiUrl as string;
  }

  async listPublishedPlugins(): Promise<PublishedPartnerPlugin[]> {
    const apiUrl = this.getApiUrl();
    const res = await fetch(
      `${apiUrl}/api/v1/partner-marketplace?app=${this.appId}&includeDisabled=1`
    );
    if (!res.ok) throw new Error(`Marketplace fetch failed (${res.status})`);
    return (await res.json()) as PublishedPartnerPlugin[];
  }

  async listInstalledPluginsRemote(): Promise<string[]> {
    const apiUrl = this.getApiUrl();
    const res = await fetch(`${apiUrl}/api/v1/partner-marketplace/installed?app=${this.appId}`);
    if (!res.ok) throw new Error(`Installed plugins fetch failed (${res.status})`);
    return (await res.json()) as string[];
  }

  installPlugin(pluginId: string) {
    const allowed = this.pluginCatalog().some((p) => p.id === pluginId);
    if (!allowed) {
      throw new Error(`Plugin ${pluginId} cannot be installed in ${this.appId}`);
    }
    const next = Array.from(new Set([...readInstalled(this.appId), pluginId]));
    writeInstalled(this.appId, next);
    return next;
  }

  uninstallPlugin(pluginId: string) {
    const next = readInstalled(this.appId).filter((id) => id !== pluginId);
    writeInstalled(this.appId, next);
    return next;
  }

  async installPublishedPlugin(pluginId: string) {
    const apiUrl = this.getApiUrl();
    const res = await fetch(`${apiUrl}/api/v1/partner-marketplace/install`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app: this.appId, pluginId }),
    });
    const out = (await res.json()) as { ok?: boolean; error?: string; installed?: string[] };
    if (!res.ok || out.ok === false) throw new Error(out.error ?? 'Install failed');
    const installed = out.installed ?? (await this.listInstalledPluginsRemote());
    writeInstalled(this.appId, installed);
    return installed;
  }

  async uninstallPublishedPlugin(pluginId: string) {
    const apiUrl = this.getApiUrl();
    const res = await fetch(`${apiUrl}/api/v1/partner-marketplace/uninstall`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app: this.appId, pluginId }),
    });
    const out = (await res.json()) as { ok?: boolean; error?: string; installed?: string[] };
    if (!res.ok || out.ok === false) throw new Error(out.error ?? 'Uninstall failed');
    const installed = out.installed ?? (await this.listInstalledPluginsRemote());
    writeInstalled(this.appId, installed);
    return installed;
  }

  private async assertInstalled(pluginId: string) {
    if (hasConfiguredApiUrl(this.options)) {
      let installed = await this.listInstalledPluginsRemote();
      if (!installed.includes(pluginId)) {
        const published = await this.listPublishedPlugins();
        if (published.some((p) => p.pluginId === pluginId)) {
          installed = await this.installPublishedPlugin(pluginId);
        }
      }
      if (!installed.includes(pluginId)) {
        throw new Error(
          `Plugin ${pluginId} is not installed in ${this.appId}. Install it in the marketplace first.`
        );
      }
      writeInstalled(this.appId, installed);
      return;
    }
    assertPluginAvailableForApp(this.appId, pluginId);
  }

  private async assertPublishedOrBuiltIn(pluginId: string) {
    const builtIn = this.pluginCatalog().some((p) => p.id === pluginId);
    if (builtIn) return;
    if (hasConfiguredApiUrl(this.options)) {
      const published = await this.listPublishedPlugins();
      if (published.some((p) => p.pluginId === pluginId)) return;
    }
    throw new Error(`Plugin ${pluginId} is not available for app ${this.appId}`);
  }

  async consume(req: PluginConsumeRequest) {
    await this.assertPublishedOrBuiltIn(req.pluginId);
    await this.assertInstalled(req.pluginId);
    return this.base.consume(req);
  }

  async produce(req: PluginProduceRequest) {
    await this.assertPublishedOrBuiltIn(req.pluginId);
    await this.assertInstalled(req.pluginId);
    const destination = req.destinationApp ?? 'flex';
    if (destination !== 'flex') {
      throw new Error('Plugins may only send data to flex');
    }
    return this.base.produce({
      ...req,
      sourceApp: req.sourceApp ?? mapSourceApp(this.appId),
      destinationApp: 'flex',
    });
  }
}

export function createFlexPluginClient(options?: FlexPluginClientOptions) {
  return new FlexPluginClient(options);
}

export function createPartnerPluginClient(appId: PartnerAppId, options?: FlexPluginClientOptions) {
  return new PartnerPluginClient(appId, new FlexPluginClient(options), options ?? {});
}

/** Known plugin IDs */
export const FlexPluginIds = {
  dashboard: 'flex.dashboard',
  governance: 'flex.governance',
  settings: 'flex.settings',
  cloudUsage: 'flex.cloud-usage',
  optimization: 'flex.optimization',
  anomalies: 'flex.anomalies',
  chargeback: 'flex.chargeback',
  workforce: 'flex.workforce',
  resources: 'flex.resources',
  alignment: 'flex.alignment',
  integrations: 'flex.integrations',
  partnerEzTrac: 'flex.partner.eztrac',
  partnerDhubRpt: 'flex.partner.dhub-rpt',
  assistant: 'flex.assistant',
  extension: 'flex.extension',
  /** Installed from Extensions marketplace */
  pagerduty: 'flex.ext.pagerduty',
  teams: 'flex.ext.teams',
  snowflake: 'flex.ext.snowflake',
  jira: 'flex.ext.jira',
} as const;

export type PluginSandboxKind = 'iframe' | 'vm' | 'worker';
export type PluginLifecycleState =
  | 'available'
  | 'pending'
  | 'installed'
  | 'enabled'
  | 'disabled'
  | 'uninstalled';

export interface PluginManifest {
  manifestVersion: string;
  id: string;
  name: string;
  version: string;
  entry: string;
  description?: string;
  iconUrl?: string;
  category?: string;
  hostRequirements?: {
    minSdkVersion?: string;
  };
  ui?: {
    slots?: string[];
    width?: number;
    height?: number;
  };
  permissions?: string[];
  capabilities?: Record<string, unknown>;
}

export interface RegistryPluginVersion {
  id: string;
  pluginId: string;
  version: string;
  downloadUrl: string;
  checksum: string;
  manifest: PluginManifest;
  createdAt: string;
}

export interface RegistryPlugin {
  id: string;
  name: string;
  vendorId: string;
  latestVersion: string;
  description: string;
  iconUrl?: string;
  category?: string;
  versions: RegistryPluginVersion[];
}

export interface PluginInstallation {
  appId: string;
  pluginId: string;
  version: string;
  installedAt: string;
  enabled: boolean;
  settings: Record<string, unknown>;
  manifest: PluginManifest;
  state: Exclude<PluginLifecycleState, 'available' | 'pending'>;
}

export interface RegistrySearchParams {
  q?: string;
  category?: string;
}

export interface PluginRegistry {
  search(params?: RegistrySearchParams): Promise<RegistryPlugin[]>;
  versions(pluginId: string): Promise<RegistryPluginVersion[]>;
  install(appId: string, pluginId: string, version?: string): Promise<PluginInstallation>;
  uninstall(appId: string, pluginId: string): Promise<void>;
  installations(appId: string): Promise<PluginInstallation[]>;
}

export interface HostBridge {
  emit(event: string, payload: unknown): void;
  on(event: string, handler: (payload: unknown) => void): () => void;
  request(action: string, params?: unknown): Promise<unknown>;
  ui: {
    registerSlotComponent(slot: string, component: ReactNode): () => void;
    showModal(content: ReactNode): void;
    showToast(message: string): void;
  };
  storage: {
    get(key: string): Promise<unknown>;
    set(key: string, value: unknown): Promise<void>;
  };
  fetch(url: string, options?: RequestInit): Promise<Response>;
}

export interface PluginHostOptions {
  appId: string;
  registryUrl?: string;
  sandbox?: PluginSandboxKind;
  permissions?: string[];
  registry?: PluginRegistry;
  requestHandlers?: Record<string, (params: unknown, pluginId: string) => unknown | Promise<unknown>>;
  onModal?: (content: ReactNode, pluginId: string) => void;
  onToast?: (message: string, pluginId: string) => void;
  fetchProxy?: (url: string, options: RequestInit | undefined, pluginId: string) => Promise<Response>;
}

interface SlotRegistration {
  id: string;
  pluginId: string;
  component: ReactNode;
}

type EventHandler = (payload: unknown) => void;

function permissionRoot(permission: string): string {
  return permission.split(':', 1)[0];
}

function hasPermission(permissions: readonly string[] | undefined, permission: string): boolean {
  if (!permissions?.length) return true;
  const root = permissionRoot(permission);
  return permissions.some(
    (candidate) =>
      candidate === permission ||
      candidate === root ||
      candidate === `${root}:*` ||
      permission.startsWith(`${candidate}:`)
  );
}

function stableId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function compareSemver(a: string, b: string): number {
  const aa = a.split('.').map((part) => Number(part) || 0);
  const bb = b.split('.').map((part) => Number(part) || 0);
  for (let i = 0; i < Math.max(aa.length, bb.length); i += 1) {
    const diff = (aa[i] ?? 0) - (bb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export class MemoryPluginRegistry implements PluginRegistry {
  private plugins = new Map<string, RegistryPlugin>();
  private installsByApp = new Map<string, Map<string, PluginInstallation>>();

  constructor(seedPlugins: Array<PluginManifest & { vendorId?: string; downloadUrl?: string; checksum?: string }> = []) {
    seedPlugins.forEach((manifest) => {
      this.publish(manifest, {
        vendorId: manifest.vendorId,
        downloadUrl: manifest.downloadUrl,
        checksum: manifest.checksum,
      });
    });
  }

  publish(
    manifest: PluginManifest,
    meta: { vendorId?: string; downloadUrl?: string; checksum?: string } = {}
  ): RegistryPluginVersion {
    const version: RegistryPluginVersion = {
      id: `${manifest.id}@${manifest.version}`,
      pluginId: manifest.id,
      version: manifest.version,
      downloadUrl: meta.downloadUrl ?? `memory://${manifest.id}/${manifest.version}.zip`,
      checksum: meta.checksum ?? `memory-sha256-${manifest.id}-${manifest.version}`,
      manifest,
      createdAt: new Date().toISOString(),
    };
    const existing = this.plugins.get(manifest.id);
    const versions = [...(existing?.versions ?? []).filter((v) => v.version !== manifest.version), version].sort(
      (a, b) => compareSemver(a.version, b.version)
    );
    const latest = versions[versions.length - 1];
    this.plugins.set(manifest.id, {
      id: manifest.id,
      name: manifest.name,
      vendorId: meta.vendorId ?? existing?.vendorId ?? 'local',
      latestVersion: latest.version,
      description: manifest.description ?? existing?.description ?? '',
      iconUrl: manifest.iconUrl ?? existing?.iconUrl,
      category: manifest.category ?? existing?.category,
      versions,
    });
    return version;
  }

  async search(params: RegistrySearchParams = {}): Promise<RegistryPlugin[]> {
    const q = params.q?.trim().toLowerCase();
    return [...this.plugins.values()].filter((plugin) => {
      const matchesQuery =
        !q ||
        plugin.name.toLowerCase().includes(q) ||
        plugin.description.toLowerCase().includes(q) ||
        plugin.id.toLowerCase().includes(q);
      const matchesCategory = !params.category || plugin.category === params.category;
      return matchesQuery && matchesCategory;
    });
  }

  async versions(pluginId: string): Promise<RegistryPluginVersion[]> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) throw new Error(`Unknown plugin: ${pluginId}`);
    return [...plugin.versions];
  }

  async install(appId: string, pluginId: string, version?: string): Promise<PluginInstallation> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) throw new Error(`Unknown plugin: ${pluginId}`);
    const release =
      plugin.versions.find((candidate) => candidate.version === (version ?? plugin.latestVersion)) ??
      plugin.versions[plugin.versions.length - 1];
    if (!release) throw new Error(`Plugin ${pluginId} has no versions`);

    const byPlugin = this.installsByApp.get(appId) ?? new Map<string, PluginInstallation>();
    const installation: PluginInstallation = {
      appId,
      pluginId,
      version: release.version,
      installedAt: new Date().toISOString(),
      enabled: false,
      settings: {},
      manifest: release.manifest,
      state: 'installed',
    };
    byPlugin.set(pluginId, installation);
    this.installsByApp.set(appId, byPlugin);
    return installation;
  }

  async uninstall(appId: string, pluginId: string): Promise<void> {
    this.installsByApp.get(appId)?.delete(pluginId);
  }

  async installations(appId: string): Promise<PluginInstallation[]> {
    return [...(this.installsByApp.get(appId)?.values() ?? [])];
  }
}

export class PluginHost {
  readonly appId: string;
  readonly registryUrl?: string;
  readonly sandbox: PluginSandboxKind;

  private registry: PluginRegistry;
  private requestHandlers = new Map<string, (params: unknown, pluginId: string) => unknown | Promise<unknown>>();
  private installationsByPlugin = new Map<string, PluginInstallation>();
  private slots = new Map<string, SlotRegistration[]>();
  private events = new Map<string, Set<EventHandler>>();
  private eventSubscriptionsByPlugin = new Map<string, Array<{ event: string; handler: EventHandler }>>();
  private storageByPlugin = new Map<string, Map<string, unknown>>();
  private subscribers = new Set<() => void>();

  constructor(private options: PluginHostOptions) {
    this.appId = options.appId;
    this.registryUrl = options.registryUrl;
    this.sandbox = options.sandbox ?? 'iframe';
    this.registry = options.registry ?? new MemoryPluginRegistry();
    Object.entries(options.requestHandlers ?? {}).forEach(([action, handler]) => {
      this.registerRequestHandler(action, handler);
    });
  }

  subscribe(listener: () => void): () => void {
    this.subscribers.add(listener);
    return () => this.subscribers.delete(listener);
  }

  getSnapshot(): PluginInstallation[] {
    return [...this.installationsByPlugin.values()];
  }

  async searchMarketplace(params?: RegistrySearchParams): Promise<RegistryPlugin[]> {
    return this.registry.search(params);
  }

  async getVersions(pluginId: string): Promise<RegistryPluginVersion[]> {
    return this.registry.versions(pluginId);
  }

  async syncInstallations(): Promise<PluginInstallation[]> {
    const rows = await this.registry.installations(this.appId);
    this.installationsByPlugin = new Map(rows.map((row) => [row.pluginId, row]));
    this.notify();
    return rows;
  }

  async install(pluginId: string, version?: string): Promise<PluginInstallation> {
    const installation = await this.registry.install(this.appId, pluginId, version);
    this.validateManifest(installation.manifest);
    this.installationsByPlugin.set(pluginId, installation);
    this.notify();
    return installation;
  }

  async enable(pluginId: string): Promise<PluginInstallation> {
    const installation = this.requireInstallation(pluginId);
    const enabled: PluginInstallation = { ...installation, enabled: true, state: 'enabled' };
    this.installationsByPlugin.set(pluginId, enabled);
    this.notify();
    return enabled;
  }

  async disable(pluginId: string): Promise<PluginInstallation> {
    const installation = this.requireInstallation(pluginId);
    this.unregisterPluginSlots(pluginId);
    this.unsubscribePluginEvents(pluginId);
    const disabled: PluginInstallation = { ...installation, enabled: false, state: 'disabled' };
    this.installationsByPlugin.set(pluginId, disabled);
    this.notify();
    return disabled;
  }

  async uninstall(pluginId: string): Promise<void> {
    if (this.installationsByPlugin.has(pluginId)) {
      await this.disable(pluginId);
    }
    this.storageByPlugin.delete(pluginId);
    this.installationsByPlugin.delete(pluginId);
    await this.registry.uninstall(this.appId, pluginId);
    this.notify();
  }

  getInstallation(pluginId: string): PluginInstallation | undefined {
    return this.installationsByPlugin.get(pluginId);
  }

  registerRequestHandler(
    action: string,
    handler: (params: unknown, pluginId: string) => unknown | Promise<unknown>
  ): () => void {
    this.requestHandlers.set(action, handler);
    return () => this.requestHandlers.delete(action);
  }

  registerSlot(slot: string, component: ReactNode, pluginId = 'host'): () => void {
    if (pluginId !== 'host') this.assertPluginPermission(pluginId, 'ui:render');
    const current = this.slots.get(slot) ?? [];
    const registration = { id: stableId(`slot-${slot}`), pluginId, component };
    this.slots.set(slot, [...current, registration]);
    this.notify();
    return () => {
      this.slots.set(
        slot,
        (this.slots.get(slot) ?? []).filter((row) => row.id !== registration.id)
      );
      this.notify();
    };
  }

  getSlotComponents(slot: string): SlotRegistration[] {
    return [...(this.slots.get(slot) ?? [])];
  }

  getBridge(pluginId: string): HostBridge {
    return {
      emit: (event, payload) => this.emit(pluginId, event, payload),
      on: (event, handler) => this.on(pluginId, event, handler),
      request: (action, params) => this.request(pluginId, action, params),
      ui: {
        registerSlotComponent: (slot, component) => this.registerSlot(slot, component, pluginId),
        showModal: (content) => {
          this.assertPluginPermission(pluginId, 'ui:render');
          this.options.onModal?.(content, pluginId);
        },
        showToast: (message) => {
          this.assertPluginPermission(pluginId, 'ui:render');
          this.options.onToast?.(message, pluginId);
        },
      },
      storage: {
        get: async (key) => {
          this.assertPluginPermission(pluginId, 'storage:read');
          return this.storageByPlugin.get(pluginId)?.get(key);
        },
        set: async (key, value) => {
          this.assertPluginPermission(pluginId, 'storage:write');
          const storage = this.storageByPlugin.get(pluginId) ?? new Map<string, unknown>();
          storage.set(key, value);
          this.storageByPlugin.set(pluginId, storage);
        },
      },
      fetch: (url, options) => {
        this.assertPluginPermission(pluginId, 'network:fetch');
        return this.options.fetchProxy ? this.options.fetchProxy(url, options, pluginId) : fetch(url, options);
      },
    };
  }

  emit(pluginId: string, event: string, payload: unknown): void {
    if (pluginId !== 'host') this.assertPluginPermission(pluginId, 'event:emit');
    this.events.get(event)?.forEach((handler) => handler(payload));
  }

  on(pluginId: string, event: string, handler: EventHandler): () => void {
    if (pluginId !== 'host') this.assertPluginPermission(pluginId, 'event:listen');
    const handlers = this.events.get(event) ?? new Set<EventHandler>();
    handlers.add(handler);
    this.events.set(event, handlers);
    const pluginSubscriptions = this.eventSubscriptionsByPlugin.get(pluginId) ?? [];
    pluginSubscriptions.push({ event, handler });
    this.eventSubscriptionsByPlugin.set(pluginId, pluginSubscriptions);
    return () => {
      handlers.delete(handler);
      this.eventSubscriptionsByPlugin.set(
        pluginId,
        (this.eventSubscriptionsByPlugin.get(pluginId) ?? []).filter((row) => row.handler !== handler)
      );
    };
  }

  async request(pluginId: string, action: string, params?: unknown): Promise<unknown> {
    if (pluginId !== 'host') this.assertPluginPermission(pluginId, action);
    const handler = this.requestHandlers.get(action);
    if (!handler) throw new Error(`Host action not registered: ${action}`);
    return handler(params, pluginId);
  }

  private validateManifest(manifest: PluginManifest): void {
    if (manifest.hostRequirements?.minSdkVersion) {
      const needed = manifest.hostRequirements.minSdkVersion;
      if (compareSemver(PLUGIN_API_VERSION, needed) < 0) {
        throw new Error(`${manifest.id} requires plugin SDK ${needed}+`);
      }
    }

    for (const permission of manifest.permissions ?? []) {
      if (!hasPermission(this.options.permissions, permission)) {
        throw new Error(`${manifest.id} requested unsupported permission: ${permission}`);
      }
    }
  }

  private requireInstallation(pluginId: string): PluginInstallation {
    const installation = this.installationsByPlugin.get(pluginId);
    if (!installation || installation.state === 'uninstalled') {
      throw new Error(`Plugin is not installed: ${pluginId}`);
    }
    return installation;
  }

  private assertPluginPermission(pluginId: string, permission: string): void {
    const installation = this.requireInstallation(pluginId);
    if (!installation.enabled && installation.state !== 'enabled') {
      throw new Error(`Plugin is not enabled: ${pluginId}`);
    }
    if (!hasPermission(installation.manifest.permissions, permission)) {
      throw new Error(`${pluginId} is missing permission: ${permission}`);
    }
  }

  private unregisterPluginSlots(pluginId: string): void {
    for (const [slot, registrations] of this.slots.entries()) {
      this.slots.set(
        slot,
        registrations.filter((row) => row.pluginId !== pluginId)
      );
    }
  }

  private unsubscribePluginEvents(pluginId: string): void {
    for (const { event, handler } of this.eventSubscriptionsByPlugin.get(pluginId) ?? []) {
      this.events.get(event)?.delete(handler);
    }
    this.eventSubscriptionsByPlugin.delete(pluginId);
  }

  private notify(): void {
    this.subscribers.forEach((listener) => listener());
  }
}

const PluginHostContext = React.createContext<PluginHost | null>(null);

export function PluginProvider({
  host,
  config,
  children,
}: {
  host?: PluginHost;
  config?: PluginHostOptions;
  children: ReactNode;
}) {
  const ref = React.useRef<PluginHost | null>(host ?? null);
  if (!ref.current) {
    if (!config) throw new Error('PluginProvider requires host or config');
    ref.current = new PluginHost(config);
  }
  return React.createElement(PluginHostContext.Provider, { value: ref.current }, children);
}

export function usePluginHost(): PluginHost {
  const host = React.useContext(PluginHostContext);
  if (!host) throw new Error('usePluginHost must be used inside PluginProvider');
  return host;
}

export function usePluginManager(): PluginHost {
  return usePluginHost();
}

class SlotErrorBoundary extends React.Component<{ children?: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function Slot({ name, fallback = null }: { name: string; fallback?: ReactNode }) {
  const host = usePluginHost();
  const subscribe = React.useCallback((listener: () => void) => host.subscribe(listener), [host]);
  const getSnapshot = React.useCallback(() => host.getSlotComponents(name), [host, name]);
  const registrations = React.useSyncExternalStore(subscribe, getSnapshot, () => []);

  if (registrations.length === 0) return React.createElement(React.Fragment, null, fallback);

  return React.createElement(
    React.Fragment,
    null,
    registrations.map((registration) =>
      React.createElement(
        SlotErrorBoundary,
        { key: registration.id },
        registration.component
      )
    )
  );
}

export function createPluginHost(options: PluginHostOptions): PluginHost {
  return new PluginHost(options);
}
