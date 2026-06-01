# Flex Access Hub

Flex Access Hub is a demo FinOps platform for cloud spend, resource allocation, anomaly tracking, governed data exchange, and partner integrations with EzTrac and dhub-rpt. The repo contains the main web app, partner demo apps, a local REST API, a Chrome extension, a VS Code extension, and shared plugin packages.

## Requirements

- Node.js `^20.19.0` or `>=22.12.0`
- npm, included with Node.js
- Git, for cloning and normal source control workflows
- Chrome or Edge, only if you want to load the browser extension
- PowerShell, only for the optional Windows port helper scripts
- Bash, only for the optional VSIX packaging script

Use npm for this repo. `package-lock.json` is the checked-in lockfile.

## Install

From the repository root:

```bash
npm install
```

If you are already in this checkout:

```bash
cd /mnt/c/Users/razza/Downloads/flex-access-hub
npm install
```

## Run The App

### Main Flex app

```bash
npm run dev:main
```

Open:

```text
http://localhost:5173
```

### Full local demo

Run the API, main app, standalone Flex host, marketplace, EzTrac, and dhub-rpt together:

```bash
npm run dev:all
```

Local URLs:

| Service | URL | Command |
|---|---|---|
| Flex main app | `http://localhost:5173` | `npm run dev:main` |
| Flex API | `http://localhost:3847` | `npm run dev:api` |
| EzTrac partner app | `http://localhost:5174` | `npm run dev:eztrac` |
| dhub-rpt partner app | `http://localhost:5175` | `npm run dev:rpt` |
| Marketplace app | `http://localhost:5176` | `npm run dev:marketplace` |
| Standalone Flex host | `http://localhost:5177` | `npm run dev:flex` |

The partner apps use the Flex API on port `3847`, so start `npm run dev:api` when testing cross-app plugin calls.

## Useful Commands

```bash
npm run dev:main              # Start the main app on port 5173
npm run dev:api               # Start the local Flex REST API on port 3847
npm run dev:all               # Start all local demo services
npm run build                 # Build the root web app
npm run build:flex            # Build apps/flex
npm run build:extension       # Build apps/flex and copy it into the Chrome extension
npm run lint                  # Run ESLint
npm run format                # Format the repo with Prettier
npm run sync:extension-catalog # Regenerate shared extension catalog data
npm run package:vsix          # Package the VS Code extension
```

On Windows, these helper scripts show or stop common dev ports:

```bash
npm run ports
npm run stop:ports
```

## Chrome Extension

Build the extension bundle:

```bash
npm run build:extension
```

Then load it in Chrome or Edge:

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select `extensions/chrome/`.

If extension icons are missing, run:

```bash
node scripts/generate-icons.js
```

## VS Code Extension

Package a local `.vsix`:

```bash
npm run package:vsix
```

The packaged file is written under `extensions/vscode/`. The VS Code extension expects the Flex API at `http://localhost:3847` by default, so run `npm run dev:api` before using its commands.

## Project Structure

```text
src/                         Root Flex web app routes and shared UI
apps/flex/                   Standalone Flex host app used by the Chrome extension
apps/eztrac/                 EzTrac partner demo app
apps/rpt/                    dhub-rpt partner demo app
apps/marketplace/            Partner marketplace demo app
services/flex-api/           Local REST API for plugin and partner demos
extensions/chrome/           Chrome MV3 extension source
extensions/vscode/           VS Code extension source
extensions/shared/           Generated shared extension catalog
packages/flex-plugin-sdk/    Shared SDK for plugin consume/produce APIs
packages/plugin-manifests/   Sample installable `.flexext.json` manifests
packages/partner-ui/         Shared partner app UI package
docs/                        HLD, LLD, plugin docs, demo scripts, and extension docs
```

## Configuration And State

- `FLEX_API_PORT` changes the local API port. Default: `3847`.
- `FLEX_STATE_FILE` changes where the API stores runtime state. Default: `services/flex-api/runtime-state.json`.
- Browser demo state is stored in local storage, mainly under `flex_state_v2`.
- All cloud, partner, and marketplace data is mock/demo data.

To reset API state, stop the API server and delete `services/flex-api/runtime-state.json`. To reset browser state, clear local storage for the local app URL.

## Documentation

- [High-Level Design](docs/HLD.md)
- [Low-Level Design](docs/LLD.md)
- [Plugin API](docs/PLUGINS.md)
- [Repository Organization](docs/REPO_ORGANIZATION.md)
- [VS Code Extension](docs/VSCODE_EXTENSION.md)
- [30-Minute Demo Runbook](docs/DEMO_30_MIN.md)

## Troubleshooting

- If a dev server says the port is already in use, stop the existing process or run `npm run stop:ports` on Windows.
- If partner app API calls fail, confirm `npm run dev:api` is running and `http://localhost:3847/health` returns JSON.
- If local packages look stale, run `npm install` again from the repository root.
- If Chrome extension UI changes are not visible, rerun `npm run build:extension` and reload the unpacked extension.
