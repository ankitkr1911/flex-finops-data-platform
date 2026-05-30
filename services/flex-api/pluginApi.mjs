/** Plugin consume/produce against shared FlexState JSON (demo). */

const DEMO_CLOUD_USAGE = [
  { date: 'Jan', compute: 42, storage: 18, network: 12, database: 28 },
  { date: 'Feb', compute: 45, storage: 19, network: 11, database: 30 },
  { date: 'Mar', compute: 48, storage: 20, network: 13, database: 29 },
  { date: 'Apr', compute: 52, storage: 22, network: 14, database: 32 },
  { date: 'May', compute: 49, storage: 21, network: 12, database: 31 },
  { date: 'Jun', compute: 55, storage: 24, network: 15, database: 34 },
];

const DEMO_RESOURCE_ALLOCATIONS = [
  { id: 'r1', name: 'EKS Production', team: 'Platform', allocated: 120, used: 98, unit: 'vCPU', trend: 'up' },
  { id: 'r2', name: 'RDS Analytics', team: 'Data', allocated: 64, used: 61, unit: 'vCPU', trend: 'stable' },
  { id: 'r3', name: 'S3 Data Lake', team: 'Data', allocated: 50, used: 42, unit: 'TB', trend: 'up' },
];

function meta(dataset, records) {
  return {
    exportedAt: new Date().toISOString(),
    recordCount: records.length,
    schema: records[0] ? Object.keys(records[0]) : [],
  };
}

function okConsume(pluginId, dataset, records) {
  return { ok: true, pluginId, dataset, records, meta: meta(dataset, records) };
}

function normalizePartnerId(value) {
  const v = String(value ?? '').trim();
  if (v === 'rpt' || v === 'dhub-rpt') return 'dhub-rpt';
  if (v === 'eztrac') return 'eztrac';
  return v;
}

function defaultDatasetForPartner(partner) {
  return partner === 'eztrac' ? 'forecast_variance' : 'capacity_forecast';
}

function publishedPlugins(state) {
  return Array.isArray(state.partnerMarketplacePublished) ? state.partnerMarketplacePublished : [];
}

export function catalog(state = {}) {
  const fromPublished = new Map();
  for (const row of publishedPlugins(state)) {
    if (!fromPublished.has(row.pluginId)) {
      const datasets = Array.isArray(row.datasets) ? row.datasets.map((d) => d.name) : [];
      fromPublished.set(row.pluginId, {
        id: row.pluginId,
        name: row.name ?? row.pluginId,
        datasets,
        datasetCount: datasets.length,
      });
    }
  }

  const core = [
    'flex.dashboard',
    'flex.governance',
    'flex.integrations',
    'flex.chargeback',
    'flex.anomalies',
    'flex.cloud-usage',
    'flex.optimization',
    'flex.alignment',
    'flex.workforce',
    'flex.resources',
    'flex.assistant',
    'flex.settings',
    'flex.extension',
    'flex.partner.eztrac',
    'flex.partner.dhub-rpt',
    'flex.ext.snowflake',
    'flex.ext.pagerduty',
    'flex.ext.jira',
    'flex.ext.teams',
  ];

  for (const id of core) {
    if (!fromPublished.has(id)) {
      fromPublished.set(id, { id, name: id, datasets: [], datasetCount: 0 });
    }
  }

  return [...fromPublished.values()];
}

function partnerConsumptionRows(state, partner) {
  const normalized = normalizePartnerId(partner);
  return (state.publishedDatasets ?? [])
    .filter((d) => d.status === 'published' || d.status === 'active')
    .filter((d) => (d.consumers ?? []).includes(normalized))
    .map((d) => ({
      datasetName: d.name,
      purpose: d.description,
      recordCount: d.recordCount,
      status: 'consuming',
      lastConsumedAt: d.lastPublished ?? null,
      schema: d.schema ?? [],
    }));
}

function openAnomalies(state) {
  return (state.anomalies ?? []).filter((a) => a.status !== 'resolved');
}

function makeTransferLog(entry) {
  return {
    id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    ...entry,
  };
}

/** Partner inbound requests land in the Flex approval queue as pending. */
function receivePartnerInbound(state, row) {
  const fromApp = normalizePartnerId(row.fromApp);
  const dataset = row.dataset ?? defaultDatasetForPartner(fromApp);
  const recordCount = Number(row.recordCount) || 0;
  const appLabel = fromApp === 'eztrac' ? 'EzTrac' : 'dhub-rpt';
  const created = {
    id: `dr-${Date.now()}`,
    fromApp,
    dataset,
    requestedAt: new Date().toISOString(),
    status: 'pending',
    recordCount,
    purpose: row.purpose ?? `Inbound from ${appLabel}`,
    changeSummary:
      typeof row.changeSummary === 'string'
        ? row.changeSummary
        : `${recordCount} record(s)`,
    changePayload:
      row.changePayload ??
      row.change ??
      row.details ??
      (Array.isArray(row.records) ? row.records : undefined),
  };
  state.dataRequests = [created, ...(state.dataRequests ?? [])];
  const pending = (state.dataRequests ?? []).filter((r) => r.status === 'pending').length;
  state.kpis = { ...(state.kpis ?? {}), pendingApprovals: pending };

  const requestedLog = makeTransferLog({
    direction: 'inbound',
    from: fromApp,
    to: 'flex',
    dataset,
    recordCount,
    status: 'requested',
    message: `${appLabel} → Flex (${dataset}) awaiting approval`,
  });
  state.transferLog = [requestedLog, ...(state.transferLog ?? [])].slice(0, 80);

  if (Array.isArray(state.connectedApps)) {
    const now = new Date().toISOString();
    state.connectedApps = state.connectedApps.map((ca) =>
      ca.id === fromApp ? { ...ca, lastSync: now, status: 'connected' } : ca
    );
  }

  return created;
}

function cloudUsage(state) {
  return state.cloudUsageHistory ?? state.usageHistory ?? DEMO_CLOUD_USAGE;
}

function resourceRows(state) {
  return state.resourceAllocations ?? DEMO_RESOURCE_ALLOCATIONS;
}

function touchPartnerSync(state, partner, message, dataset = 'partner_update') {
  const fromApp = normalizePartnerId(partner);
  if (fromApp !== 'eztrac' && fromApp !== 'dhub-rpt') return;
  const appLabel = fromApp === 'eztrac' ? 'EzTrac' : 'dhub-rpt';
  const now = new Date().toISOString();
  if (Array.isArray(state.connectedApps)) {
    state.connectedApps = state.connectedApps.map((ca) =>
      ca.id === fromApp ? { ...ca, lastSync: now, status: 'connected' } : ca
    );
  }
  state.transferLog = [
    makeTransferLog({
      direction: 'inbound',
      from: fromApp,
      to: 'flex',
      dataset,
      recordCount: 1,
      status: 'delivered',
      message: message.startsWith(appLabel) ? message : `${appLabel}: ${message}`,
    }),
    ...(state.transferLog ?? []),
  ].slice(0, 80);
}

function queuePartnerRequest(state, sourceApp, dataset, recordCount, purpose) {
  const partner = normalizePartnerId(sourceApp);
  if (partner !== 'eztrac' && partner !== 'dhub-rpt') return;
  receivePartnerInbound(state, {
    fromApp: partner,
    dataset,
    recordCount,
    purpose,
  });
}

function applyAllocationMatrix(state, rows) {
  const byId = new Map(resourceRows(state).map((r) => [r.id, r]));
  let updated = 0;
  for (const raw of rows) {
    const id = String(raw.id ?? '').trim();
    if (!id) continue;
    const prev = byId.get(id) ?? {
      id,
      name: String(raw.name ?? id),
      team: String(raw.team ?? ''),
      allocated: 0,
      used: 0,
      unit: String(raw.unit ?? 'vCPU'),
      trend: 'stable',
    };
    byId.set(id, {
      ...prev,
      name: raw.name != null ? String(raw.name) : prev.name,
      team: raw.team != null ? String(raw.team) : prev.team,
      allocated: raw.allocated != null ? Number(raw.allocated) : prev.allocated,
      used: raw.used != null ? Number(raw.used) : prev.used,
      unit: raw.unit != null ? String(raw.unit) : prev.unit,
      trend: raw.trend === 'up' || raw.trend === 'down' || raw.trend === 'stable' ? raw.trend : prev.trend,
    });
    updated += 1;
  }
  state.resourceAllocations = [...byId.values()];
  return updated;
}

function applySquadMatrix(state, rows) {
  const byId = new Map((state.workforce ?? []).map((w) => [w.id, w]));
  let updated = 0;
  for (const raw of rows) {
    const id = String(raw.id ?? '').trim();
    if (!id || !byId.has(id)) continue;
    const prev = byId.get(id);
    byId.set(id, {
      ...prev,
      squad: raw.squad != null ? String(raw.squad) : prev.squad,
      headcount: raw.headcount != null ? Number(raw.headcount) : prev.headcount,
      capacityUsedPct:
        raw.capacityUsedPct != null ? Number(raw.capacityUsedPct) : prev.capacityUsedPct,
      cloudCostMonthly:
        raw.cloudCostMonthly != null
          ? Number(raw.cloudCostMonthly)
          : raw.monthlyCloudCost != null
            ? Number(raw.monthlyCloudCost)
            : prev.cloudCostMonthly,
      flexAllocatedVcpu:
        raw.flexAllocatedVcpu != null ? Number(raw.flexAllocatedVcpu) : prev.flexAllocatedVcpu,
      dhubCapacityUnits:
        raw.dhubCapacityUnits != null ? Number(raw.dhubCapacityUnits) : prev.dhubCapacityUnits,
      signal: raw.signal ?? prev.signal,
      signalReason: raw.signalReason != null ? String(raw.signalReason) : prev.signalReason,
    });
    updated += 1;
  }
  state.workforce = [...byId.values()];
  return updated;
}

function consumePlugin(state, pluginId, dataset, params) {
  const s = state;
  const ds = dataset;

  switch (pluginId) {
    case 'flex.dashboard':
      if (ds === 'kpi_snapshot' || !ds) {
        const records = [
          {
            ...(s.kpis ?? {}),
            pendingApprovals: (s.dataRequests ?? []).filter((r) => r.status === 'pending').length,
          },
        ];
        return okConsume(pluginId, 'kpi_snapshot', records);
      }
      if (ds === 'usage_trend') return okConsume(pluginId, ds, cloudUsage(s));
      break;

    case 'flex.governance':
      if (ds === 'data_requests' || !ds) return okConsume(pluginId, 'data_requests', s.dataRequests ?? []);
      if (ds === 'published_datasets') return okConsume(pluginId, ds, s.publishedDatasets ?? []);
      if (ds === 'transfer_log') return okConsume(pluginId, ds, s.transferLog ?? []);
      break;

    case 'flex.chargeback':
      if (ds === 'team_showback' || !ds) return okConsume(pluginId, 'team_showback', s.chargeback ?? []);
      if (ds === 'tag_compliance') return okConsume(pluginId, ds, s.tagCompliance ?? []);
      break;

    case 'flex.anomalies':
      if (ds === 'anomaly_events' || !ds) return okConsume(pluginId, ds || 'anomaly_events', s.anomalies ?? []);
      if (ds === 'anomaly_feed') {
        return okConsume(
          pluginId,
          ds,
          openAnomalies(s).map(({ id, severity, service, impact }) => ({ id, severity, service, impact }))
        );
      }
      break;

    case 'flex.cloud-usage':
      if (ds === 'usage_history' || !ds) return okConsume(pluginId, 'usage_history', cloudUsage(s));
      break;

    case 'flex.optimization':
      if (ds === 'savings_opportunities' || !ds) return okConsume(pluginId, 'savings_opportunities', s.savings ?? []);
      break;

    case 'flex.alignment':
      if (ds === 'alignment_rows' || !ds) return okConsume(pluginId, 'alignment_rows', s.alignmentRows ?? []);
      if (ds === 'alignment_score') {
        const rows = s.alignmentRows ?? [];
        const resolved = new Set(s.resolvedAlignmentIds ?? []);
        const conflicts = rows.filter((r) => r.status === 'conflict' && !resolved.has(r.id)).length;
        return okConsume(pluginId, ds, [
          { score: s.alignmentScore ?? 0, resolvedCount: resolved.size, totalCount: rows.length, conflicts },
        ]);
      }
      break;

    case 'flex.workforce':
      if (ds === 'squad_matrix' || !ds) return okConsume(pluginId, 'squad_matrix', s.workforce ?? []);
      break;

    case 'flex.resources':
      if (ds === 'allocation_matrix' || !ds) return okConsume(pluginId, 'allocation_matrix', resourceRows(s));
      break;

    case 'flex.integrations':
      if (ds === 'connected_apps') return okConsume(pluginId, ds, s.connectedApps ?? []);
      if (ds === 'partner_consumption') {
        const partner = normalizePartnerId(params?.partner);
        if (!partner) return { ok: false, error: 'params.partner required (eztrac | dhub-rpt)' };
        return okConsume(pluginId, ds, partnerConsumptionRows(s, partner));
      }
      break;

    case 'flex.assistant':
      if (ds === 'knowledge_context' || !ds) {
        const pending = (s.dataRequests ?? []).filter((r) => r.status === 'pending').length;
        const conflicts = (s.alignmentRows ?? []).filter(
          (r) => r.status === 'conflict' && !(s.resolvedAlignmentIds ?? []).includes(r.id)
        ).length;
        return okConsume(pluginId, 'knowledge_context', [
          {
            kpis: s.kpis,
            pendingApprovals: pending,
            openAnomalies: openAnomalies(s).length,
            savingsCount: (s.savings ?? []).length,
            alignmentConflicts: conflicts,
          },
        ]);
      }
      break;

    case 'flex.settings':
      if (ds === 'preferences' || !ds) return okConsume(pluginId, 'preferences', [s.settings ?? {}]);
      break;

    case 'flex.extension':
      if (ds === 'extension_snapshot' || !ds) {
        const pending = (s.dataRequests ?? []).filter((r) => r.status === 'pending').length;
        return okConsume(pluginId, 'extension_snapshot', [
          {
            pendingCount: pending,
            openAnomalies: s.kpis?.openAnomalies ?? openAnomalies(s).length,
            totalSpend: s.kpis?.totalSpend,
            spendChange: s.kpis?.spendChange,
            utilization: s.kpis?.utilization,
          },
        ]);
      }
      break;

    case 'flex.partner.eztrac':
      if (ds === 'consumption_status' || !ds) {
        return okConsume(pluginId, 'consumption_status', partnerConsumptionRows(s, 'eztrac'));
      }
      break;

    case 'flex.partner.dhub-rpt':
      if (ds === 'consumption_status' || !ds) {
        return okConsume(pluginId, 'consumption_status', partnerConsumptionRows(s, 'dhub-rpt'));
      }
      break;

    case 'flex.ext.snowflake':
      if (ds === 'chargeback_rows') {
        return okConsume(
          pluginId,
          ds,
          (s.chargeback ?? []).map(({ team, monthlySpend, budget, owner }) => ({
            team,
            monthlySpend,
            budget,
            owner,
          }))
        );
      }
      if (ds === 'usage_trend') return okConsume(pluginId, ds, cloudUsage(s));
      if (ds === 'export_manifest' || !ds) {
        return okConsume(pluginId, 'export_manifest', [
          {
            table: 'FINOPS.CHARGEBACK',
            rowCount: (s.chargeback ?? []).length,
            lastExportedAt: new Date().toISOString(),
          },
          {
            table: 'FINOPS.USAGE_TREND',
            rowCount: cloudUsage(s).length,
            lastExportedAt: new Date().toISOString(),
          },
        ]);
      }
      break;

    case 'flex.ext.pagerduty':
    case 'flex.ext.jira':
      if (ds === 'open_incidents' || ds === 'ticket_candidates' || !ds) {
        return okConsume(
          pluginId,
          ds || 'open_incidents',
          openAnomalies(s)
            .filter((a) => a.severity === 'critical' || a.severity === 'high')
            .map(({ id, title, severity, impact, service }) => ({ id, title, severity, impact, service }))
        );
      }
      break;

    case 'flex.ext.teams':
      if (ds === 'channel_config' || !ds) {
        return okConsume(pluginId, ds || 'channel_config', [
          { channel: '#finops-alerts', webhookUrl: 'https://outlook.office.com/webhook/demo', enabled: true },
          { channel: '#platform-cost', webhookUrl: 'https://outlook.office.com/webhook/demo-2', enabled: true },
        ]);
      }
      break;

    default:
      break;
  }

  return null;
}

export function consume(state, { pluginId, dataset, params }) {
  const result = consumePlugin(state, pluginId, dataset, params);
  if (result) return result;
  return { ok: false, error: `Unknown consume: ${pluginId}/${dataset ?? ''}` };
}

function produceInboundSync(state, pluginId, dataset, sourceApp) {
  const partner = normalizePartnerId(sourceApp);
  if (partner !== 'eztrac' && partner !== 'dhub-rpt') {
    return { ok: false, error: 'sourceApp must be eztrac or dhub-rpt' };
  }
  const created = receivePartnerInbound(state, {
    fromApp: partner,
    dataset: defaultDatasetForPartner(partner),
    recordCount: Math.floor(Math.random() * 500) + 100,
    purpose: `Sync from ${partner === 'eztrac' ? 'EzTrac' : 'dhub-rpt'}`,
  });
  return {
    ok: true,
    pluginId,
    dataset,
    message: `Delivered ${created.dataset} from ${partner} (${created.recordCount} rows)`,
    affectedIds: [created.id],
  };
}

export function produce(state, req) {
  const { pluginId, dataset, records, sourceApp } = req;
  const rows = Array.isArray(records) ? records : [];
  const row = rows[0] ?? {};

  if (pluginId === 'flex.governance' && dataset === 'inbound_request') {
    const created = receivePartnerInbound(state, { ...row, records: rows });
    return {
      ok: true,
      pluginId,
      dataset,
      message: `Delivered ${created.dataset} from ${created.fromApp} (${created.recordCount} rows)`,
      affectedIds: [created.id],
    };
  }

  if (pluginId === 'flex.integrations' && dataset === 'simulate_inbound_sync') {
    return produceInboundSync(state, pluginId, dataset, normalizePartnerId(row.partner ?? sourceApp));
  }

  if (
    (pluginId === 'flex.partner.eztrac' || pluginId === 'flex.partner.dhub-rpt') &&
    dataset === 'request_sync'
  ) {
    const partner = pluginId === 'flex.partner.eztrac' ? 'eztrac' : 'dhub-rpt';
    return produceInboundSync(state, pluginId, dataset, partner);
  }

  if (
    (pluginId === 'flex.partner.eztrac' || pluginId === 'flex.partner.dhub-rpt') &&
    dataset === 'inbound_request'
  ) {
    const partner = pluginId === 'flex.partner.eztrac' ? 'eztrac' : 'dhub-rpt';
    const created = receivePartnerInbound(state, {
      ...row,
      records: rows,
      fromApp: normalizePartnerId(row.fromApp ?? sourceApp ?? partner),
    });
    return {
      ok: true,
      pluginId,
      dataset,
      message: `Delivered ${created.dataset} from ${partner} (${created.recordCount} rows)`,
      affectedIds: [created.id],
    };
  }

  if (
    (pluginId === 'flex.partner.eztrac' || pluginId === 'flex.partner.dhub-rpt') &&
    dataset === 'pull_published'
  ) {
    const partner = pluginId === 'flex.partner.eztrac' ? 'eztrac' : 'dhub-rpt';
    const pulled = partnerConsumptionRows(state, partner);
    return {
      ok: true,
      pluginId,
      dataset,
      message: `Found ${pulled.length} published dataset(s) for ${partner}`,
      records: pulled,
    };
  }

  if (pluginId === 'flex.resources' && dataset === 'allocation_matrix') {
    const n = applyAllocationMatrix(state, rows);
    if (n === 0) return { ok: false, error: 'No allocation rows with id to update' };
    const partner = normalizePartnerId(sourceApp ?? row.fromApp ?? 'dhub-rpt');
    const appLabel = partner === 'eztrac' ? 'EzTrac' : 'dhub-rpt';
    receivePartnerInbound(state, {
      fromApp: partner,
      dataset: 'allocation_matrix',
      recordCount: n,
      purpose: `${appLabel} updated ${n} allocation row(s) in Flex`,
    });
    return {
      ok: true,
      pluginId,
      dataset,
      message: `Updated ${n} allocation row(s) in Flex`,
      affectedIds: rows.map((r) => String(r.id ?? '')).filter(Boolean),
    };
  }

  if (pluginId === 'flex.workforce' && dataset === 'squad_matrix') {
    const n = applySquadMatrix(state, rows);
    if (n === 0) return { ok: false, error: 'No matching squad rows to update (check ids)' };
    const partner = normalizePartnerId(sourceApp ?? row.fromApp ?? 'dhub-rpt');
    const appLabel = partner === 'eztrac' ? 'EzTrac' : 'dhub-rpt';
    receivePartnerInbound(state, {
      fromApp: partner,
      dataset: 'squad_matrix',
      recordCount: n,
      purpose: `${appLabel} updated ${n} squad row(s) in Flex`,
    });
    return {
      ok: true,
      pluginId,
      dataset,
      message: `Updated ${n} squad row(s) in Flex`,
      affectedIds: rows.map((r) => String(r.id ?? '')).filter(Boolean),
    };
  }

  if (pluginId === 'flex.anomalies' && dataset === 'create_anomaly') {
    const input = rows[0] ?? {};
    const created = {
      id: `a-${Date.now()}`,
      title: input.title ?? 'Partner-reported anomaly',
      severity: input.severity ?? 'medium',
      service: input.service ?? 'Unknown',
      detectedAt: new Date().toISOString(),
      impact: input.impact ?? 'Pending review',
      status: 'open',
      deltaPercent: Number(input.deltaPercent) || 0,
    };
    state.anomalies = [created, ...(state.anomalies ?? [])];
    touchPartnerSync(
      state,
      sourceApp ?? 'eztrac',
      `created anomaly ${created.id}`,
      'anomaly_events'
    );
    queuePartnerRequest(
      state,
      sourceApp ?? 'eztrac',
      'anomaly_events',
      1,
      `Partner submitted anomaly ${created.id} to Flex`
    );
    return {
      ok: true,
      pluginId,
      dataset,
      message: `Anomaly ${created.id} created`,
      affectedIds: [created.id],
    };
  }

  if (pluginId === 'flex.anomalies' && dataset === 'resolve_anomaly') {
    const id = row.id;
    if (!id) return { ok: false, error: 'records[0].id required' };
    state.anomalies = (state.anomalies ?? []).map((a) =>
      a.id === id ? { ...a, status: 'resolved' } : a
    );
    touchPartnerSync(state, sourceApp ?? 'eztrac', `resolved anomaly ${id}`, 'anomaly_events');
    queuePartnerRequest(
      state,
      sourceApp ?? 'eztrac',
      'anomaly_events',
      1,
      `Partner requested resolve for anomaly ${id}`
    );
    return { ok: true, pluginId, dataset, message: `Anomaly ${id} resolved`, affectedIds: [id] };
  }

  if (pluginId === 'flex.anomalies' && dataset === 'update_anomaly') {
    const id = row.id;
    if (!id) return { ok: false, error: 'records[0].id required' };
    const existing = (state.anomalies ?? []).find((a) => a.id === id);
    if (!existing) return { ok: false, error: `Anomaly ${id} not found in Flex` };
    const updated = {
      ...existing,
      title: row.title ?? existing.title,
      severity: row.severity ?? existing.severity,
      service: row.service ?? existing.service,
      impact: row.impact ?? existing.impact,
      deltaPercent: row.deltaPercent != null ? Number(row.deltaPercent) : existing.deltaPercent,
      status: row.status ?? existing.status,
    };
    state.anomalies = (state.anomalies ?? []).map((a) => (a.id === id ? updated : a));
    touchPartnerSync(state, sourceApp ?? 'eztrac', `updated anomaly ${id}`, 'anomaly_events');
    queuePartnerRequest(
      state,
      sourceApp ?? 'eztrac',
      'anomaly_events',
      1,
      `Partner updated anomaly ${id}`
    );
    return { ok: true, pluginId, dataset, message: `Anomaly ${id} updated`, affectedIds: [id] };
  }

  if (pluginId === 'flex.chargeback' && dataset === 'update_budget') {
    const id = String(row.id ?? '').trim();
    if (!id) return { ok: false, error: 'records[0].id required' };
    const found = (state.chargeback ?? []).some((c) => c.id === id || c.team === id);
    if (!found && !(state.chargeback ?? []).length) {
      return { ok: false, error: `Chargeback row ${id} not found` };
    }
    state.chargeback = (state.chargeback ?? []).map((c) =>
      c.id === id || c.team === id
        ? {
            ...c,
            budget: row.budget != null ? Number(row.budget) : c.budget,
            owner: row.owner != null ? String(row.owner) : c.owner,
            monthlySpend: row.monthlySpend != null ? Number(row.monthlySpend) : c.monthlySpend,
          }
        : c
    );
    touchPartnerSync(state, sourceApp ?? 'eztrac', `updated chargeback budget ${id}`, 'team_showback');
    queuePartnerRequest(
      state,
      sourceApp ?? 'eztrac',
      'team_showback',
      1,
      `Partner updated chargeback budget for ${id}`
    );
    return {
      ok: true,
      pluginId,
      dataset,
      message: `Budget updated for ${id}`,
      affectedIds: [id],
    };
  }

  if (pluginId === 'flex.ext.pagerduty' && dataset === 'trigger_page') {
    const { anomalyId, urgency } = row;
    return {
      ok: true,
      pluginId,
      dataset,
      message: `PagerDuty incident queued for ${anomalyId} (${urgency ?? 'high'})`,
      affectedIds: anomalyId ? [String(anomalyId)] : [],
    };
  }

  if (pluginId === 'flex.ext.jira' && dataset === 'create_ticket') {
    const { anomalyId, projectKey } = row;
    return {
      ok: true,
      pluginId,
      dataset,
      message: `Jira issue created for ${anomalyId} in ${projectKey ?? 'FINOPS'}`,
      affectedIds: anomalyId ? [String(anomalyId)] : [],
    };
  }

  if (pluginId === 'flex.ext.teams' && dataset === 'post_message') {
    return {
      ok: true,
      pluginId,
      dataset,
      message: `Message posted to ${row.channel ?? 'Teams channel'}`,
    };
  }

  if (pluginId === 'flex.optimization' && dataset === 'advance_stage') {
    queuePartnerRequest(
      state,
      sourceApp ?? 'eztrac',
      'savings_opportunities',
      1,
      `Partner advanced optimization stage for ${row.id ?? 'opportunity'}`
    );
    return {
      ok: true,
      pluginId,
      dataset,
      message: `Stage advance queued for ${row.id ?? 'opportunity'}`,
      affectedIds: row.id ? [String(row.id)] : [],
    };
  }

  if (pluginId === 'flex.alignment' && dataset === 'resolve_conflict') {
    const id = row.id;
    if (!id) return { ok: false, error: 'records[0].id required' };
    if (!state.resolvedAlignmentIds) state.resolvedAlignmentIds = [];
    if (!state.resolvedAlignmentIds.includes(id)) state.resolvedAlignmentIds.push(id);
    queuePartnerRequest(
      state,
      sourceApp ?? 'dhub-rpt',
      'alignment_rows',
      1,
      `Partner resolved alignment conflict ${id}`
    );
    return { ok: true, pluginId, dataset, message: `Alignment row ${id} resolved`, affectedIds: [id] };
  }

  if (pluginId === 'flex.workforce' && dataset === 'acknowledge_signal') {
    queuePartnerRequest(
      state,
      sourceApp ?? 'dhub-rpt',
      'squad_matrix',
      1,
      `Partner acknowledged workforce signal ${row.id ?? ''}`.trim()
    );
    return {
      ok: true,
      pluginId,
      dataset,
      message: `Workforce signal ${row.id ?? ''} acknowledged`,
      affectedIds: row.id ? [String(row.id)] : [],
    };
  }

  if (pluginId === 'flex.assistant' && dataset === 'chat_intent') {
    return {
      ok: true,
      pluginId,
      dataset,
      message: `Intent routed to Flex AI: ${row.query ?? 'query'}`,
    };
  }

  if (pluginId === 'flex.extension' && dataset === 'page_context') {
    return {
      ok: true,
      pluginId,
      dataset,
      message: 'Page context received — open the suggested route in Flex',
    };
  }

  if (dataset === 'inbound_request') {
    const created = receivePartnerInbound(state, {
      ...row,
      fromApp: normalizePartnerId(row.fromApp ?? sourceApp),
    });
    return {
      ok: true,
      pluginId,
      dataset,
      message: `Delivered ${created.dataset} from ${created.fromApp} (${created.recordCount} rows)`,
      affectedIds: [created.id],
    };
  }

  if (['request_sync', 'pull_published', 'simulate_inbound_sync', 'pull_outbound'].includes(dataset)) {
    return produceInboundSync(state, pluginId, dataset, normalizePartnerId(row.partner ?? sourceApp));
  }

  return {
    ok: false,
    error: `Produce not supported for ${pluginId}/${dataset}. Use a send dataset (inbound_request, request_sync, create_anomaly, …).`,
  };
}
