# Flex Data Platform

Complete data engineering layer for the Flex FinOps application.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              Frontend — React + Vite (port 8080)              │
│         React Query hooks → api-client.ts → fetch            │
└───────────────────────────┬─────────────────────────────────┘
                            │ REST API (CORS enabled)
┌───────────────────────────▼─────────────────────────────────┐
│                  NestJS Backend (port 3001)                   │
│  ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌──────────────────┐ │
│  │ Auth    │ │ Modules  │ │ Events  │ │ Scheduled Tasks  │ │
│  │(AzureAD)│ │(KPI,CB..)│ │(Emitter)│ │(Cache refresh)   │ │
│  └────┬────┘ └────┬─────┘ └────┬────┘ └────────┬─────────┘ │
└───────┼───────────┼────────────┼────────────────┼───────────┘
        │           │            │                │
   ┌────▼───┐  ┌───▼────┐  ┌───▼───┐      ┌────▼────┐
   │Azure AD│  │PostgreSQL│  │Redis  │      │Cron Jobs│
   │ (JWT)  │  │TimescaleDB│ │Cache  │      │         │
   └────────┘  └───▲────┘  └───────┘      └─────────┘
                    │
        ┌───────────┴───────────────┐
        │   PySpark ETL Notebooks   │
        │  (Databricks-portable)    │
        ├───────────────────────────┤
        │ 01_ingest_cur.ipynb       │
        │ 02_transform_aggregate    │
        │ 03_load_to_postgres       │
        │ 04_anomaly_detection      │
        └───────────┬───────────────┘
                    │
              ┌─────▼─────┐
              │  S3 (CUR)  │
              │ LocalStack │
              └────────────┘
```

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Python 3.11+ with pip3
- Node.js 18+
- Java 17+ (for PySpark) — `brew install openjdk@17` on macOS

### 1. Start Infrastructure

```bash
cd data-platform
docker compose up -d
```

This starts:
- PostgreSQL 16 + TimescaleDB (port 5432)
- Redis 7 (port 6379)
- LocalStack S3 (port 4566)

### 2. Generate Synthetic CUR Data

```bash
cd etl
pip3 install -r requirements.txt
python3 synthetic_cur_generator.py
```

Generates 3 months of AWS CUR data for 4 business units (~54K records/month).

### 3. Run ETL Pipeline

Run notebooks in order:
```bash
# Option A: Jupyter
jupyter notebook

# Option B: Command line (papermill)
pip3 install papermill ipykernel
python3 -m ipykernel install --user --name python3

# Ensure JAVA_HOME is set (required for PySpark)
export JAVA_HOME=$(/usr/libexec/java_home 2>/dev/null || echo /opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home)
export PATH="$JAVA_HOME/bin:$PATH"

python3 -m papermill 01_ingest_cur.ipynb output/01_out.ipynb -k python3
python3 -m papermill 02_transform_aggregate.ipynb output/02_out.ipynb -k python3
python3 -m papermill 03_load_to_postgres.ipynb output/03_out.ipynb -k python3
python3 -m papermill 04_anomaly_detection.ipynb output/04_out.ipynb -k python3
```

### 4. Start Backend API

```bash
# From repo root (Flex/)
cd /Users/ankitkumar/Library/CloudStorage/OneDrive-Bayer/Mac_OneDrive/myproject/Flex/data-platform/backend

npm install
npm i --save-dev @types/pg @nestjs/cli
npx nest build

# Start (must run from the backend/ directory so .env is found)
node dist/main.js
```

Or in watch mode (from `data-platform/backend/`):
```bash
npx nest start --watch
```

> **Note:** Always `cd` into `data-platform/backend/` using the full path before running commands.
> Relative paths like `cd data-platform/backend` only work from the repo root (`Flex/`).

API available at: http://localhost:3001/api/v1

### 5. Start Frontend

```bash
# IMPORTANT: Run from the repo root (Flex/), NOT from data-platform/backend/
cd /Users/ankitkumar/Library/CloudStorage/OneDrive-Bayer/Mac_OneDrive/myproject/Flex
npx vite --port 8080
```

Frontend available at: http://localhost:8080

The React app uses React Query hooks (`src/lib/hooks.ts`) that call the
API client (`src/lib/api-client.ts`) targeting `http://localhost:3001`.
If the API is unreachable, the UI gracefully falls back to mock data.

### 6. Test API

```bash
# Health check / endpoint index
curl http://localhost:3001/api/v1

# Get KPIs (uses mock auth in dev — defaults to BU 0001 if no header)
curl http://localhost:3001/api/v1/kpis

# Get KPIs for a specific business unit
curl http://localhost:3001/api/v1/kpis \
  -H "x-business-unit-id: a1b2c3d4-0001-4000-8000-000000000001"

# Get anomalies
curl http://localhost:3001/api/v1/anomalies

# Get savings
curl http://localhost:3001/api/v1/savings

# Get chargeback
curl http://localhost:3001/api/v1/chargeback
```

> **Tip:** In dev mode, the `x-business-unit-id` header is optional — it defaults
> to `a1b2c3d4-0001-4000-8000-000000000001` (Platform Engineering).

## Multi-Tenant Security

Every table has `business_unit_id` + Row-Level Security (RLS) policies.
In dev mode, pass `x-business-unit-id` header. In production, extracted from Azure AD JWT claims.

## Business Units (Tenants)

| ID | Name | Cost Center |
|---|---|---|
| `...0001` | Platform Engineering | CC-1001 |
| `...0002` | Data & Analytics | CC-1002 |
| `...0003` | Product Engineering | CC-1003 |
| `...0004` | Finance Operations | CC-1004 |

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/` | Health check + endpoint index |
| GET | `/kpis` | Dashboard KPIs |
| GET | `/kpis/trend` | KPI historical trend |
| GET | `/chargeback` | Team chargeback data |
| GET | `/chargeback/summary` | Aggregated summary |
| GET | `/anomalies` | All anomalies |
| GET | `/anomalies/open` | Open anomalies only |
| PATCH | `/anomalies/:id/status` | Update anomaly status |
| GET | `/savings` | Savings opportunities |
| PATCH | `/savings/:id/stage` | Update savings stage |
| GET | `/workforce/squads` | Squad workforce data |
| GET | `/governance/datasets` | Published datasets |
| GET | `/governance/requests` | Data access requests |
| POST | `/governance/requests` | Create new request |
| PATCH | `/governance/requests/:id/approve` | Approve request |
| GET | `/governance/tag-rules` | Tag compliance rules |
| GET | `/audit` | Audit log |
| GET | `/audit/bundle` | Hash-chain verification |

## Frontend Integration

The React frontend (`src/`) is wired to consume the backend API via:

| File | Purpose |
|---|---|
| `src/lib/api-client.ts` | Typed fetch wrappers for all `/api/v1/*` endpoints |
| `src/lib/hooks.ts` | React Query hooks with auto-refetch & mock fallback |
| `src/routes/index.tsx` | Dashboard — `useKpis()`, `useKpiTrend()`, `useAnomalies()`, `useSavings()` |
| `src/routes/anomalies.tsx` | Anomalies — `useAnomalies()` |
| `src/routes/optimization.tsx` | Savings — `useSavings()` |
| `src/routes/chargeback.tsx` | Chargeback — `useChargeback()` |
| `src/routes/workforce.tsx` | Workforce — `useWorkforce()` |

Env variable: `VITE_DATA_API_URL` (defaults to `http://localhost:3001`).

## Deploying to Production

| Local | Production |
|---|---|
| Docker PostgreSQL | AWS RDS (PostgreSQL 16) |
| Docker Redis | AWS ElastiCache |
| LocalStack S3 | AWS S3 |
| PySpark local | Databricks Jobs |
| NestJS cron | EventBridge Scheduled Rules |
| Event emitter | EventBridge + Lambda |
| Mock auth | Azure AD B2C |
