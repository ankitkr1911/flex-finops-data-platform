import cors from 'cors';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { catalog, consume, produce } from './pluginApi.mjs';
import {
  getMarketplacePluginVersions,
  installMarketplacePlugin,
  listAppInstallations,
  searchMarketplacePlugins,
  uninstallMarketplacePlugin,
} from './marketplaceRegistry.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.FLEX_API_PORT ?? 3847);
const STATE_FILE = process.env.FLEX_STATE_FILE ?? path.join(__dirname, 'runtime-state.json');
const SEED_FILE = path.join(__dirname, 'seed-state.json');

let state = loadState();

const DATASET_DIRECTION_FIXES = {
  'flex.resources:allocation_matrix': 'bidirectional',
  'flex.workforce:squad_matrix': 'bidirectional',
  'flex.anomalies:anomaly_events': 'bidirectional',
  'flex.chargeback:team_showback': 'bidirectional',
};

const DEFAULT_INSTALLS = {
  eztrac: [
    'flex.partner.eztrac',
    'flex.governance',
    'flex.chargeback',
    'flex.anomalies',
    'flex.integrations',
  ],
  rpt: [
    'flex.partner.dhub-rpt',
    'flex.resources',
    'flex.workforce',
    'flex.anomalies',
    'flex.integrations',
    'flex.alignment',
  ],
};

function normalizePublishedPluginDatasets() {
  const published = publishedPlugins();
  let changed = false;
  for (const plugin of published) {
    if (!Array.isArray(plugin.datasets)) continue;
    for (const ds of plugin.datasets) {
      const key = `${plugin.pluginId}:${ds.name}`;
      const fixed = DATASET_DIRECTION_FIXES[key];
      if (fixed && ds.direction !== fixed) {
        ds.direction = fixed;
        changed = true;
      }
    }
  }
  if (changed) {
    state.partnerMarketplacePublished = published;
    saveState();
  }
}

function ensureDefaultInstalls() {
  let changed = false;
  for (const [app, plugins] of Object.entries(DEFAULT_INSTALLS)) {
    if (installedForApp(app).length === 0) {
      setInstalledForApp(app, plugins);
      changed = true;
    }
  }
  if (changed) saveState();
}

function bootstrapPartnerState() {
  normalizePublishedPluginDatasets();
  ensureDefaultInstalls();
}

let stateRevision = Number(state._stateRevision) || Date.now();

bootstrapPartnerState();

/** @type {Set<import('http').ServerResponse>} */
const stateEventClients = new Set();

function bumpStateRevision() {
  stateRevision = Date.now();
  state._stateRevision = stateRevision;
  const payload = `data: ${JSON.stringify({ revision: stateRevision })}\n\n`;
  for (const res of stateEventClients) {
    try {
      res.write(payload);
    } catch {
      stateEventClients.delete(res);
    }
  }
}

function normalizePartnerAppId(value) {
  const appId = String(value ?? '').trim();
  if (appId === 'eztrac') return 'eztrac';
  if (appId === 'rpt' || appId === 'dhub-rpt') return 'rpt';
  return '';
}

function publishedPlugins() {
  return Array.isArray(state.partnerMarketplacePublished) ? state.partnerMarketplacePublished : [];
}

function installedByApp() {
  return state.partnerInstalledByApp && typeof state.partnerInstalledByApp === 'object'
    ? state.partnerInstalledByApp
    : {};
}

function installedForApp(appId) {
  const byApp = installedByApp();
  const aliases = appId === 'rpt' ? ['rpt', 'dhub-rpt'] : [appId];
  return Array.from(
    new Set(aliases.flatMap((key) => (Array.isArray(byApp[key]) ? byApp[key] : [])))
  );
}

function setInstalledForApp(appId, pluginIds) {
  const byApp = installedByApp();
  byApp[appId] = Array.from(new Set(pluginIds));
  if (appId === 'rpt') delete byApp['dhub-rpt'];
  state.partnerInstalledByApp = byApp;
  return byApp[appId];
}

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch {
    /* ignore */
  }
  try {
    return JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveState() {
  state._stateRevision = stateRevision;
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function mergeConnectedApps(existing = [], incoming = []) {
  const map = new Map();
  for (const row of [...existing, ...incoming]) {
    if (!row?.id) continue;
    const prev = map.get(row.id);
    if (!prev) {
      map.set(row.id, row);
      continue;
    }
    const prevTs = new Date(prev.lastSync ?? 0).getTime();
    const nextTs = new Date(row.lastSync ?? 0).getTime();
    map.set(row.id, nextTs >= prevTs ? row : prev);
  }
  return [...map.values()];
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '4mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'flex-api', port: PORT });
});

app.get('/', (req, res) => {
  const wantsJson =
    req.accepts('json') && !req.accepts('html');
  const payload = {
    ok: true,
    service: 'flex-api',
    message: 'REST API for Flex plugins and the partner marketplace. Open the web apps below — not this URL in the browser for daily use.',
    health: '/health',
    apps: {
      flex: 'http://localhost:5173/',
      marketplace: 'http://localhost:5176/',
      eztrac: 'http://localhost:5174/',
      rpt: 'http://localhost:5175/',
    },
    endpoints: {
      catalog: 'GET /api/v1/catalog',
      partnerMarketplace: 'GET /api/v1/partner-marketplace?app=eztrac|rpt',
      consume: 'POST /api/v1/consume',
      produce: 'POST /api/v1/produce',
    },
  };

  if (wantsJson) {
    res.json(payload);
    return;
  }

  res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Flex API</title>
  <style>
    :root { font-family: system-ui, sans-serif; background: #0a0e17; color: #e2e8f0; }
    body { max-width: 42rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; }
    h1 { font-size: 1.35rem; margin-bottom: 0.25rem; }
    p { color: #94a3b8; font-size: 0.9rem; }
    .ok { color: #4ade80; font-weight: 600; }
    ul { padding-left: 1.2rem; }
    a { color: #22d3ee; }
    code { font-size: 0.85em; background: #1a2332; padding: 0.1em 0.35em; border-radius: 4px; }
    section { margin-top: 1.5rem; }
  </style>
</head>
<body>
  <h1>Flex API <span class="ok">running</span></h1>
  <p>Port ${PORT} — used by Marketplace, EzTrac, dhub-rpt, and the VS Code extension. Use the web UIs for browsing plugins.</p>
  <section>
    <h2>Web apps</h2>
    <ul>
      <li><a href="http://localhost:5173/">Flex</a></li>
      <li><a href="http://localhost:5176/">Marketplace</a></li>
      <li><a href="http://localhost:5174/">EzTrac</a></li>
      <li><a href="http://localhost:5175/">dhub-rpt</a></li>
    </ul>
  </section>
  <section>
    <h2>API checks</h2>
    <ul>
      <li><a href="/health">/health</a></li>
      <li><a href="/api/v1/catalog">/api/v1/catalog</a></li>
      <li><a href="/api/v1/partner-marketplace?app=eztrac">/api/v1/partner-marketplace?app=eztrac</a></li>
    </ul>
  </section>
</body>
</html>`);
});

app.get('/api/v1/state', (_req, res) => {
  res.json({ ...state, _stateRevision: stateRevision });
});

app.get('/api/v1/state/revision', (_req, res) => {
  res.json({ revision: stateRevision });
});

app.get('/api/v1/state/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();
  res.write(`data: ${JSON.stringify({ revision: stateRevision })}\n\n`);
  stateEventClients.add(res);
  req.on('close', () => stateEventClients.delete(res));
});

function rowTimestamp(row = {}) {
  for (const key of ['requestedAt', 'at', 'detectedAt', 'lastSync', 'updatedAt']) {
    if (row[key]) return new Date(row[key]).getTime();
  }
  return 0;
}

/** Merge rows by id — keep whichever side has the newer timestamp (partner-safe). */
function mergeById(existing = [], incoming = [], idKey = 'id') {
  const map = new Map();
  for (const row of [...existing, ...incoming]) {
    if (row?.[idKey] == null) continue;
    const prev = map.get(row[idKey]);
    if (!prev || rowTimestamp(row) >= rowTimestamp(prev)) map.set(row[idKey], row);
  }
  return [...map.values()];
}

app.post('/api/v1/sync', (req, res) => {
  if (!req.body || typeof req.body !== 'object') {
    res.status(400).json({ ok: false, error: 'Expected Flex state JSON' });
    return;
  }
  const integrationState = {
    partnerMarketplacePublished: state.partnerMarketplacePublished,
    partnerInstalledByApp: state.partnerInstalledByApp,
  };
  const incoming = req.body;
  const dataRequests = mergeById(state.dataRequests, incoming.dataRequests);
  const pendingApprovals = dataRequests.filter((r) => r.status === 'pending').length;
  const connectedApps = mergeConnectedApps(state.connectedApps, incoming.connectedApps);
  state = {
    ...incoming,
    ...integrationState,
    dataRequests,
    anomalies: mergeById(state.anomalies, incoming.anomalies),
    chargeback: mergeById(state.chargeback, incoming.chargeback),
    resourceAllocations: mergeById(state.resourceAllocations, incoming.resourceAllocations),
    workforce: mergeById(state.workforce, incoming.workforce),
    transferLog: mergeById(state.transferLog, incoming.transferLog).slice(0, 80),
    connectedApps,
    kpis: { ...(state.kpis ?? {}), ...(incoming.kpis ?? {}), pendingApprovals },
  };
  bumpStateRevision();
  saveState();
  res.json({ ok: true, message: 'State synced from Flex app', revision: stateRevision });
});

app.get('/api/v1/catalog', (_req, res) => {
  res.json(catalog(state));
});

app.get('/api/v1/plugins/search', (req, res) => {
  res.json(
    searchMarketplacePlugins({
      q: typeof req.query.q === 'string' ? req.query.q : '',
      category: typeof req.query.category === 'string' ? req.query.category : '',
    })
  );
});

app.get('/api/v1/plugins/:id/versions', (req, res) => {
  const versions = getMarketplacePluginVersions(req.params.id);
  if (!versions) {
    res.status(404).json({ ok: false, error: 'Plugin not found' });
    return;
  }
  res.json(versions);
});

app.get('/api/v1/apps/:appId/installations', (req, res) => {
  res.json(listAppInstallations(req.params.appId));
});

app.post('/api/v1/apps/:appId/installations', (req, res) => {
  const pluginId = String(req.body?.pluginId ?? '').trim();
  const version = req.body?.version == null ? undefined : String(req.body.version).trim();
  if (!pluginId) {
    res.status(400).json({ ok: false, error: 'pluginId is required' });
    return;
  }
  const result = installMarketplacePlugin(req.params.appId, pluginId, version);
  if (!result.ok) {
    res.status(result.status).json({ ok: false, error: result.error });
    return;
  }
  res.status(201).json(result.installation);
});

app.delete('/api/v1/apps/:appId/installations/:pluginId', (req, res) => {
  const result = uninstallMarketplacePlugin(req.params.appId, req.params.pluginId);
  if (!result.ok) {
    res.status(result.status).json({ ok: false, error: result.error });
    return;
  }
  res.status(204).send();
});

app.get('/api/v1/partner-marketplace', (req, res) => {
  const appId = normalizePartnerAppId(req.query.app);
  const includeDisabled = String(req.query.includeDisabled ?? '') === '1';
  if (!appId) {
    res.status(400).json({ ok: false, error: 'query param app is required' });
    return;
  }
  res.json(
    publishedPlugins().filter((row) => {
      if (normalizePartnerAppId(row.targetApp) !== appId) return false;
      if (includeDisabled) return true;
      return row.enabled !== false;
    })
  );
});

app.get('/api/v1/partner-marketplace/installed', (req, res) => {
  const appId = normalizePartnerAppId(req.query.app);
  if (!appId) {
    res.status(400).json({ ok: false, error: 'query param app is required' });
    return;
  }
  res.json(installedForApp(appId));
});

app.post('/api/v1/partner-marketplace/publish', (req, res) => {
  const body = req.body ?? {};
  const pluginId = String(body.pluginId ?? '').trim();
  const name = String(body.name ?? pluginId).trim();
  const targetApp = normalizePartnerAppId(body.targetApp);
  const version = String(body.version ?? '1.0.0').trim();
  const description = String(body.description ?? '').trim();
  const publisher = String(body.publisher ?? 'Flex').trim();
  const icon = typeof body.icon === 'string' ? body.icon : '';
  const category = typeof body.category === 'string' ? body.category : 'tools';
  const kind = body.kind === 'extension' ? 'extension' : 'core';
  const permissions = Array.isArray(body.permissions) ? body.permissions.map(String) : [];
  const datasets = Array.isArray(body.datasets) ? body.datasets : [];

  if (!pluginId || !targetApp) {
    res.status(400).json({ ok: false, error: 'pluginId and targetApp are required' });
    return;
  }

  const published = publishedPlugins();
  const nextPublished = published.filter(
    (row) => !(row.pluginId === pluginId && normalizePartnerAppId(row.targetApp) === targetApp)
  );
  const plugin = {
    pluginId,
    name,
    targetApp,
    version,
    description,
    publisher,
    icon,
    category,
    kind,
    permissions,
    datasets,
    enabled: body.enabled === false ? false : true,
    publishedAt: new Date().toISOString(),
  };
  nextPublished.push(plugin);
  state.partnerMarketplacePublished = nextPublished;

  bumpStateRevision();
  saveState();
  res.json({ ok: true, plugin, message: 'Plugin published to partner marketplace' });
});

app.post('/api/v1/partner-marketplace/toggle', (req, res) => {
  const appId = normalizePartnerAppId(req.body?.targetApp);
  const pluginId = String(req.body?.pluginId ?? '').trim();
  const enabled = Boolean(req.body?.enabled);
  if (!appId || !pluginId) {
    res.status(400).json({ ok: false, error: 'targetApp and pluginId are required' });
    return;
  }

  const published = publishedPlugins();
  const idx = published.findIndex(
    (row) => row.pluginId === pluginId && normalizePartnerAppId(row.targetApp) === appId
  );
  if (idx < 0) {
    res.status(404).json({ ok: false, error: 'Plugin is not published to this partner marketplace' });
    return;
  }

  const plugin = { ...published[idx], enabled };
  published[idx] = plugin;
  state.partnerMarketplacePublished = published;
  bumpStateRevision();
  saveState();
  res.json({ ok: true, plugin, message: enabled ? 'Plugin enabled' : 'Plugin disabled' });
});

app.post('/api/v1/partner-marketplace/install', (req, res) => {
  const appId = normalizePartnerAppId(req.body?.app);
  const pluginId = String(req.body?.pluginId ?? '').trim();
  if (!appId || !pluginId) {
    res.status(400).json({ ok: false, error: 'app and pluginId are required' });
    return;
  }
  const available = publishedPlugins().some(
    (row) => row.pluginId === pluginId && normalizePartnerAppId(row.targetApp) === appId
  );
  if (!available) {
    res.status(404).json({ ok: false, error: 'Plugin is not published to this partner marketplace' });
    return;
  }
  const installed = installedForApp(appId);
  const nextInstalled = installed.includes(pluginId) ? installed : [...installed, pluginId];
  setInstalledForApp(appId, nextInstalled);
  bumpStateRevision();
  saveState();
  res.json({ ok: true, app: appId, pluginId, installed: nextInstalled });
});

app.post('/api/v1/partner-marketplace/uninstall', (req, res) => {
  const appId = normalizePartnerAppId(req.body?.app);
  const pluginId = String(req.body?.pluginId ?? '').trim();
  if (!appId || !pluginId) {
    res.status(400).json({ ok: false, error: 'app and pluginId are required' });
    return;
  }
  const nextInstalled = installedForApp(appId).filter((id) => id !== pluginId);
  setInstalledForApp(appId, nextInstalled);
  bumpStateRevision();
  saveState();
  res.json({ ok: true, app: appId, pluginId, installed: nextInstalled });
});

app.post('/api/v1/consume', (req, res) => {
  const result = consume(state, req.body ?? {});
  if (result.ok === false) {
    res.status(400).json(result);
    return;
  }
  res.json(result);
});

app.post('/api/v1/produce', (req, res) => {
  const result = produce(state, req.body ?? {});
  if (result.ok !== false) bumpStateRevision();
  saveState();
  res.json({ ...result, revision: stateRevision });
});

app.listen(PORT, () => {
  console.log(`Flex API listening on http://localhost:${PORT}`);
  console.log(`  Health:  GET  /health`);
  console.log(`  Plugins: POST /api/v1/consume | /api/v1/produce`);
  console.log(`  Sync:    POST /api/v1/sync (from Flex web app)`);
});
