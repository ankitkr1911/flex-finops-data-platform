-- Flex FinOps Database Initialization
-- Enables TimescaleDB and sets up multi-tenant schema

CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create schema
CREATE SCHEMA IF NOT EXISTS flex;

-- Business Units table (tenants)
CREATE TABLE flex.business_units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    cost_center VARCHAR(50),
    owner_email VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users table (linked to Azure AD)
CREATE TABLE flex.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    azure_ad_oid VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'viewer', -- admin, bu_owner, data_steward, viewer
    business_unit_id UUID NOT NULL REFERENCES flex.business_units(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

-- Cloud Usage (time-series - will become hypertable)
CREATE TABLE flex.cloud_usage (
    time TIMESTAMPTZ NOT NULL,
    business_unit_id UUID NOT NULL REFERENCES flex.business_units(id),
    service VARCHAR(100) NOT NULL, -- EC2, S3, RDS, Lambda, etc.
    region VARCHAR(50) NOT NULL,
    account_id VARCHAR(20),
    usage_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
    blended_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
    unblended_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
    usage_type VARCHAR(255),
    resource_id VARCHAR(255),
    tags JSONB DEFAULT '{}'::jsonb
);

-- Convert to TimescaleDB hypertable
SELECT create_hypertable('flex.cloud_usage', 'time', chunk_time_interval => INTERVAL '1 month');

-- Forecast data (time-series)
CREATE TABLE flex.forecast (
    time TIMESTAMPTZ NOT NULL,
    business_unit_id UUID NOT NULL REFERENCES flex.business_units(id),
    actual DOUBLE PRECISION,
    forecast DOUBLE PRECISION NOT NULL,
    budget DOUBLE PRECISION NOT NULL,
    model_version VARCHAR(50) DEFAULT 'v1'
);

SELECT create_hypertable('flex.forecast', 'time', chunk_time_interval => INTERVAL '3 months');

-- KPIs (materialized/cached)
CREATE TABLE flex.kpis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_unit_id UUID NOT NULL REFERENCES flex.business_units(id),
    period DATE NOT NULL,
    total_spend DOUBLE PRECISION NOT NULL DEFAULT 0,
    spend_change_pct DOUBLE PRECISION DEFAULT 0,
    utilization_pct DOUBLE PRECISION DEFAULT 0,
    active_resources INTEGER DEFAULT 0,
    open_anomalies INTEGER DEFAULT 0,
    pending_approvals INTEGER DEFAULT 0,
    monthly_savings_identified DOUBLE PRECISION DEFAULT 0,
    monthly_savings_realized DOUBLE PRECISION DEFAULT 0,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(business_unit_id, period)
);

-- Chargeback / Showback
CREATE TABLE flex.chargeback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_unit_id UUID NOT NULL REFERENCES flex.business_units(id),
    team VARCHAR(255) NOT NULL,
    cost_center VARCHAR(50),
    initiative VARCHAR(255),
    owner VARCHAR(255),
    monthly_spend DOUBLE PRECISION NOT NULL DEFAULT 0,
    budget DOUBLE PRECISION DEFAULT 0,
    forecast DOUBLE PRECISION DEFAULT 0,
    headcount INTEGER DEFAULT 0,
    cost_per_engineer DOUBLE PRECISION DEFAULT 0,
    tag_compliance_pct DOUBLE PRECISION DEFAULT 0,
    trend VARCHAR(20) DEFAULT 'stable', -- up, down, stable
    period DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Anomalies
CREATE TABLE flex.anomalies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_unit_id UUID NOT NULL REFERENCES flex.business_units(id),
    title VARCHAR(500) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    service VARCHAR(100) NOT NULL,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    impact VARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved')),
    delta_percent DOUBLE PRECISION DEFAULT 0,
    details JSONB DEFAULT '{}'::jsonb
);

-- Resource Allocations
CREATE TABLE flex.resource_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_unit_id UUID NOT NULL REFERENCES flex.business_units(id),
    name VARCHAR(255) NOT NULL,
    team VARCHAR(255),
    allocated DOUBLE PRECISION NOT NULL,
    used DOUBLE PRECISION NOT NULL,
    unit VARCHAR(50) NOT NULL,
    trend VARCHAR(20) DEFAULT 'stable',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Savings Opportunities
CREATE TABLE flex.savings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_unit_id UUID NOT NULL REFERENCES flex.business_units(id),
    title VARCHAR(500) NOT NULL,
    category VARCHAR(100),
    monthly_savings DOUBLE PRECISION NOT NULL DEFAULT 0,
    effort VARCHAR(50), -- low, medium, high
    confidence DOUBLE PRECISION DEFAULT 0,
    action VARCHAR(500),
    stage VARCHAR(50) NOT NULL DEFAULT 'identified' CHECK (stage IN ('identified', 'approved', 'implementing', 'realized')),
    owner VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Workforce / Squad Matrix
CREATE TABLE flex.workforce (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_unit_id UUID NOT NULL REFERENCES flex.business_units(id),
    squad VARCHAR(255) NOT NULL,
    platform_lead VARCHAR(255),
    headcount INTEGER NOT NULL DEFAULT 0,
    capacity_used_pct DOUBLE PRECISION DEFAULT 0,
    cloud_cost_monthly DOUBLE PRECISION DEFAULT 0,
    cost_per_head DOUBLE PRECISION DEFAULT 0,
    dhub_capacity_units DOUBLE PRECISION DEFAULT 0,
    flex_allocated_vcpu DOUBLE PRECISION DEFAULT 0,
    signal VARCHAR(50) DEFAULT 'stable' CHECK (signal IN ('hire', 'reallocate', 'stable', 'optimize')),
    signal_reason VARCHAR(500),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Data Governance: Published Datasets
CREATE TABLE flex.published_datasets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_unit_id UUID NOT NULL REFERENCES flex.business_units(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    schema_definition JSONB NOT NULL DEFAULT '[]'::jsonb,
    consumers TEXT[] DEFAULT '{}',
    last_published TIMESTAMPTZ,
    status VARCHAR(50) DEFAULT 'active',
    record_count INTEGER DEFAULT 0,
    owner_id UUID REFERENCES flex.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Data Governance: Data Requests (approval workflow)
CREATE TABLE flex.data_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_unit_id UUID NOT NULL REFERENCES flex.business_units(id),
    from_app VARCHAR(255) NOT NULL,
    dataset VARCHAR(255) NOT NULL,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_at TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    record_count INTEGER DEFAULT 0,
    purpose TEXT,
    requested_by UUID REFERENCES flex.users(id),
    decided_by UUID REFERENCES flex.users(id),
    change_summary TEXT,
    change_payload JSONB
);

-- Tag Rules (governance)
CREATE TABLE flex.tag_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_unit_id UUID NOT NULL REFERENCES flex.business_units(id),
    tag_key VARCHAR(255) NOT NULL,
    required BOOLEAN DEFAULT true,
    allowed_values TEXT[],
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Alignment (cross-functional)
CREATE TABLE flex.alignment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_unit_id UUID NOT NULL REFERENCES flex.business_units(id),
    initiative VARCHAR(255) NOT NULL,
    squad VARCHAR(255),
    finance VARCHAR(255),
    planning VARCHAR(255),
    spend_delta_pct DOUBLE PRECISION DEFAULT 0,
    capacity_delta_pct DOUBLE PRECISION DEFAULT 0,
    note TEXT,
    resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Connected Apps / Integrations
CREATE TABLE flex.connected_apps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_unit_id UUID NOT NULL REFERENCES flex.business_units(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'active',
    last_sync TIMESTAMPTZ,
    direction VARCHAR(20) DEFAULT 'inbound', -- inbound, outbound, bidirectional
    config JSONB DEFAULT '{}'::jsonb
);

-- Audit Log (append-only with hash chain)
CREATE TABLE flex.audit_log (
    id BIGSERIAL PRIMARY KEY,
    business_unit_id UUID NOT NULL REFERENCES flex.business_units(id),
    actor_id UUID REFERENCES flex.users(id),
    action VARCHAR(255) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(255),
    payload JSONB DEFAULT '{}'::jsonb,
    prev_hash VARCHAR(64),
    hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Events table (for event sourcing / replay)
CREATE TABLE flex.events (
    id BIGSERIAL PRIMARY KEY,
    business_unit_id UUID NOT NULL REFERENCES flex.business_units(id),
    event_type VARCHAR(255) NOT NULL, -- anomaly.detected, exchange.approved, etc.
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    emitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed BOOLEAN DEFAULT false
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_cloud_usage_bu ON flex.cloud_usage(business_unit_id, time DESC);
CREATE INDEX idx_cloud_usage_service ON flex.cloud_usage(service, time DESC);
CREATE INDEX idx_anomalies_bu_status ON flex.anomalies(business_unit_id, status);
CREATE INDEX idx_chargeback_bu_period ON flex.chargeback(business_unit_id, period);
CREATE INDEX idx_savings_bu_stage ON flex.savings(business_unit_id, stage);
CREATE INDEX idx_data_requests_bu_status ON flex.data_requests(business_unit_id, status);
CREATE INDEX idx_audit_log_bu ON flex.audit_log(business_unit_id, created_at DESC);
CREATE INDEX idx_events_type ON flex.events(event_type, emitted_at DESC);
CREATE INDEX idx_events_unprocessed ON flex.events(processed) WHERE processed = false;

-- ============================================
-- ROW LEVEL SECURITY (Multi-tenant isolation)
-- ============================================

ALTER TABLE flex.cloud_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE flex.anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE flex.chargeback ENABLE ROW LEVEL SECURITY;
ALTER TABLE flex.resource_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE flex.savings ENABLE ROW LEVEL SECURITY;
ALTER TABLE flex.workforce ENABLE ROW LEVEL SECURITY;
ALTER TABLE flex.published_datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE flex.data_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE flex.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE flex.kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE flex.alignment ENABLE ROW LEVEL SECURITY;
ALTER TABLE flex.tag_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE flex.connected_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE flex.forecast ENABLE ROW LEVEL SECURITY;

-- Create app role for API connections
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'flex_app') THEN
        CREATE ROLE flex_app LOGIN PASSWORD 'flex_app_2026';
    END IF;
END
$$;

GRANT USAGE ON SCHEMA flex TO flex_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA flex TO flex_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA flex TO flex_app;

-- RLS policies: user sees only their BU's data
CREATE POLICY bu_isolation ON flex.cloud_usage
    FOR ALL TO flex_app
    USING (business_unit_id = current_setting('app.current_business_unit_id')::uuid);

CREATE POLICY bu_isolation ON flex.anomalies
    FOR ALL TO flex_app
    USING (business_unit_id = current_setting('app.current_business_unit_id')::uuid);

CREATE POLICY bu_isolation ON flex.chargeback
    FOR ALL TO flex_app
    USING (business_unit_id = current_setting('app.current_business_unit_id')::uuid);

CREATE POLICY bu_isolation ON flex.resource_allocations
    FOR ALL TO flex_app
    USING (business_unit_id = current_setting('app.current_business_unit_id')::uuid);

CREATE POLICY bu_isolation ON flex.savings
    FOR ALL TO flex_app
    USING (business_unit_id = current_setting('app.current_business_unit_id')::uuid);

CREATE POLICY bu_isolation ON flex.workforce
    FOR ALL TO flex_app
    USING (business_unit_id = current_setting('app.current_business_unit_id')::uuid);

CREATE POLICY bu_isolation ON flex.published_datasets
    FOR ALL TO flex_app
    USING (business_unit_id = current_setting('app.current_business_unit_id')::uuid);

CREATE POLICY bu_isolation ON flex.data_requests
    FOR ALL TO flex_app
    USING (business_unit_id = current_setting('app.current_business_unit_id')::uuid);

CREATE POLICY bu_isolation ON flex.audit_log
    FOR ALL TO flex_app
    USING (business_unit_id = current_setting('app.current_business_unit_id')::uuid);

CREATE POLICY bu_isolation ON flex.kpis
    FOR ALL TO flex_app
    USING (business_unit_id = current_setting('app.current_business_unit_id')::uuid);

CREATE POLICY bu_isolation ON flex.alignment
    FOR ALL TO flex_app
    USING (business_unit_id = current_setting('app.current_business_unit_id')::uuid);

CREATE POLICY bu_isolation ON flex.tag_rules
    FOR ALL TO flex_app
    USING (business_unit_id = current_setting('app.current_business_unit_id')::uuid);

CREATE POLICY bu_isolation ON flex.connected_apps
    FOR ALL TO flex_app
    USING (business_unit_id = current_setting('app.current_business_unit_id')::uuid);

CREATE POLICY bu_isolation ON flex.forecast
    FOR ALL TO flex_app
    USING (business_unit_id = current_setting('app.current_business_unit_id')::uuid);

-- ============================================
-- SEED: Business Units
-- ============================================

INSERT INTO flex.business_units (id, name, cost_center, owner_email) VALUES
    ('a1b2c3d4-0001-4000-8000-000000000001', 'Platform Engineering', 'CC-1001', 'platform-lead@bayer.com'),
    ('a1b2c3d4-0002-4000-8000-000000000002', 'Data & Analytics', 'CC-1002', 'data-lead@bayer.com'),
    ('a1b2c3d4-0003-4000-8000-000000000003', 'Product Engineering', 'CC-1003', 'product-lead@bayer.com'),
    ('a1b2c3d4-0004-4000-8000-000000000004', 'Finance Operations', 'CC-1004', 'finance-lead@bayer.com');
