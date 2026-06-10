# Omniverse WebRTC Viewer

Direct web and Electron viewer for Omniverse Kit WebRTC livestream targets.

This project is based on NVIDIA's Omniverse web viewer sample and is focused on direct local-network streaming. It does not launch Omniverse apps, create cloud sessions, or manage GFN/OKAS sessions.

## Setup

```powershell
npm install
```

Create a local env file from one of the examples and set your Omniverse Kit host:

```powershell
Copy-Item .env.target190.example .env.target190
```

Then edit:

```env
VITE_STREAM_LOCAL_SERVER=YOUR_KIT_HOST_OR_IP
VITE_STREAM_SIGNALING_PORT=49100
```

Local `.env.*` files are ignored by git. Keep machine-specific targets out of commits.

## Commands

```powershell
npm run dev
```

Alias for `npm run web:190`. Starts only the web viewer dev server.

```powershell
npm run web:190
npm run web:195
```

Start web viewer modes. By default:

- `web:190` serves on `http://localhost:5176/`
- `web:195` serves on `http://localhost:5175/`

```powershell
npm run app:190
npm run app:195
```

Start the matching Vite server and then launch Electron.

```powershell
npm test
npm run build
```

Run tests and production build checks.

## Basic Use

1. Start an Omniverse Kit app with WebRTC livestreaming enabled.
2. Start this viewer with `npm run web:190`, `npm run web:195`, or one of the Electron app commands.
3. Open the localhost URL printed by Vite.
4. Choose a stream resolution: `FHD`, `QHD`, or `UHD`.
5. Choose `30` or `60` FPS.
6. Click `Connect`.

After connection, the stream fills the browser or app window without cropping. The floating control overlay can be moved, collapsed to a single expand button, or expanded again.

Recommended defaults:

- `QHD / 60 FPS` for a balance of detail and UI readability.
- `FHD / 60 FPS` when remote UI text should stay larger.
- `UHD / 60 FPS` mainly for large 4K displays. UHD renders the remote Omniverse UI at 3840x2160, so text can appear smaller when the stream is scaled down to fit the local screen.

## Advanced Options

The `Advanced` section exposes server and port overrides for development and troubleshooting.

The layout editor is disabled by default:

```env
VITE_ENABLE_LAYOUT_EDITOR=false
```

Set it to `true` only for development/debugging. The default experience is the full-fit stream viewer.

## Public Repository Notes

Before publishing a fork, verify that no local env files, private IPs, screenshots, logs, or organization-specific assets are committed.

Keep NVIDIA license and attribution files with redistributed copies:

- `LICENSE`
- `PRODUCT_TERMS_OMNIVERSE`
- NVIDIA copyright and SPDX notices in upstream-derived source files

Development and redistribution involving Omniverse components may be subject to NVIDIA terms.
