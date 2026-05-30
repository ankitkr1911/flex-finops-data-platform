import { getFlexApiUrl } from './flexApiSync';
import type { PluginCatalogEntry, PluginDataset } from '../plugins/types';
import type { AppId } from '../types';

export type PartnerId = Exclude<AppId, 'flex'>;
export type PartnerMarketplaceAppId = 'eztrac' | 'rpt';

export interface PublishedPartnerPlugin {
  pluginId: string;
  name: string;
  version: string;
  description: string;
  targetApp: PartnerMarketplaceAppId;
  publisher?: string;
  icon?: string;
  category?: string;
  permissions?: string[];
  kind?: 'core' | 'extension';
  datasets?: PluginDataset[];
  enabled?: boolean;
  publishedAt: string;
}

export interface PartnerMarketplacePublishInput {
  plugin: PluginCatalogEntry;
  targetApp: PartnerMarketplaceAppId;
  icon?: string;
  permissions?: string[];
}

export function partnerToMarketplaceApp(partner: PartnerId): PartnerMarketplaceAppId {
  return partner === 'eztrac' ? 'eztrac' : 'rpt';
}

export function marketplaceAppToPartner(app: PartnerMarketplaceAppId): PartnerId {
  return app === 'eztrac' ? 'eztrac' : 'dhub-rpt';
}

export function partnerDisplayName(partner: PartnerId | PartnerMarketplaceAppId): string {
  return partner === 'eztrac' ? 'EzTrac' : 'dhub-rpt';
}

async function readJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getFlexApiUrl()}${path}`, init);
  const json = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `Flex API ${res.status}`);
  return json;
}

export function listPublishedPartnerPlugins(
  partner: PartnerId,
  options?: { includeDisabled?: boolean }
): Promise<PublishedPartnerPlugin[]> {
  const app = partnerToMarketplaceApp(partner);
  const includeDisabled = options?.includeDisabled ? '&includeDisabled=1' : '';
  return readJson<PublishedPartnerPlugin[]>(
    `/api/v1/partner-marketplace?app=${encodeURIComponent(app)}${includeDisabled}`
  );
}

export function listInstalledPartnerPlugins(partner: PartnerId): Promise<string[]> {
  const app = partnerToMarketplaceApp(partner);
  return readJson<string[]>(
    `/api/v1/partner-marketplace/installed?app=${encodeURIComponent(app)}`
  );
}

export async function publishPartnerPlugin(input: PartnerMarketplacePublishInput): Promise<PublishedPartnerPlugin> {
  const result = await readJson<{ ok: boolean; plugin: PublishedPartnerPlugin }>(
    '/api/v1/partner-marketplace/publish',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pluginId: input.plugin.id,
        name: input.plugin.name,
        version: input.plugin.version,
        targetApp: input.targetApp,
        description: input.plugin.description,
        publisher: input.plugin.publisher ?? 'Flex',
        icon: input.icon,
        category: input.plugin.category,
        permissions: input.permissions ?? input.plugin.permissions ?? [],
        kind: input.plugin.kind,
        datasets: input.plugin.datasets,
      }),
    }
  );
  return result.plugin;
}

export async function setPublishedPartnerPluginEnabled(
  targetApp: PartnerMarketplaceAppId,
  pluginId: string,
  enabled: boolean
): Promise<PublishedPartnerPlugin> {
  const result = await readJson<{ ok: boolean; plugin: PublishedPartnerPlugin }>(
    '/api/v1/partner-marketplace/toggle',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetApp, pluginId, enabled }),
    }
  );
  return result.plugin;
}

export async function installPartnerPlugin(partner: PartnerId, pluginId: string): Promise<string[]> {
  const result = await readJson<{ ok: boolean; installed: string[] }>(
    '/api/v1/partner-marketplace/install',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app: partnerToMarketplaceApp(partner),
        pluginId,
      }),
    }
  );
  return result.installed;
}

export async function uninstallPartnerPlugin(partner: PartnerId, pluginId: string): Promise<string[]> {
  const result = await readJson<{ ok: boolean; installed: string[] }>(
    '/api/v1/partner-marketplace/uninstall',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app: partnerToMarketplaceApp(partner),
        pluginId,
      }),
    }
  );
  return result.installed;
}

export async function installAllPublishedPartnerPlugins(
  partner: PartnerId,
  pluginIds: string[]
): Promise<string[]> {
  let installed: string[] = [];
  for (const pluginId of pluginIds) {
    installed = await installPartnerPlugin(partner, pluginId);
  }
  return installed;
}
