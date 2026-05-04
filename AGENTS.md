# PetDex Dock - Agent Instructions

## Project Type
Electron 33 + TypeScript app for macOS. Frameless, transparent, always-on-top overlay window that displays animated pets near the Dock.

Source is TypeScript (`src/*.ts`), compiled to `dist/` for production. Dev uses `tsx` to run `main.ts` directly.

## Key Commands
```bash
pnpm compile        # Compile TS → dist/ + copy html/css assets
pnpm start          # Compile + run (tsx src/main.ts)
pnpm dev            # Compile + run with --enable-logging
pnpm build          # Compile + build macOS .app (electron-builder --mac)
pnpm build:dir      # Build unpacked macOS app for quick testing
```

There is no test suite and no linting in this project. TypeScript provides type checking via `npx tsc --noEmit`.

## Build Pipeline
- **Dev**: `tsx src/main.ts` runs TypeScript directly (no compile needed for main). Preload and renderer are compiled to `dist/` via `tsc` and `esbuild` respectively. `src/index.html` and `src/styles.css` are copied to `dist/`.
- **Production**: `tsc` compiles `main.ts` + `preload.ts` → `dist/` (CJS). `esbuild` bundles `renderer.ts` → `dist/renderer.js` (IIFE). `electron-builder` packages from `dist/`.
- `package.json` `"main": "dist/main.js"` is used by electron-builder for production builds only.

## Pets Location
`~/.codex/pets/{petId}/` - must contain:
- `pet.json` - `{ id, displayName, description }`
- `spritesheet.webp` - 512x576px (8 cols × 9 rows of 64×64 frames)

Install a pet: `npx petdex install gutsy`
Pets are scanned once at startup (synchronous). Newly installed pets require an app restart.

## Spritesheet Convention
All pets share identical animation row layout:

| Row | Animation | Frames |
|-----|-----------|--------|
| 0   | idle      | 6      |
| 1   | runRight  | 8      |
| 2   | runLeft   | 8      |
| 3   | waving    | 4      |
| 4   | jumping   | 5      |
| 5   | failed    | 8      |
| 6   | waiting   | 6      |
| 7   | running   | 6      |
| 8   | review    | 6      |

Animation constants are defined in `src/renderer.ts` (single source of truth).

## Pet Modes (dock / libre)
- **dock** (default): Pet is constrained to the macOS Dock area. `enforceDockY()` runs every 2s in main process, forces Y position to dock level.
- **libre**: Pet roams the full screen width, window becomes draggable. Toggled via context menu ("Modo: Dock/Libre"). Stored in config as `petMode`.

## Config Storage
`~/Library/Application Support/petdex-dock/config.json` via electron-store v8

Defaults: `{ activePet: null, position: null, fps: 12, petMode: 'dock' }`

**Do not upgrade electron-store to v9** — v9 is ESM-only, this project uses CJS.

## Architecture
- `src/main.ts` — main process: window creation, tray, IPC handlers, mouse polling (every 50ms), dock position enforcement. Typed with `Pet`, `DockBounds`, `StoreSchema` interfaces.
- `src/preload.ts` — `contextBridge.exposeInMainWorld('petdex', { ... })` — all IPC is invoke/send + event listeners
- `src/renderer.ts` — sprite animation, mouse tracking, click handlers, roaming logic. Compiled via esbuild to IIFE for browser loading. Types from `src/types/preload.d.ts` provide `window.petdex` API types.
- `src/types/preload.d.ts` — global type declarations for `window.petdex` API (`Pet`, `DockBounds`, `PetDexAPI` interfaces)
- `src/styles.css` — pixel-art rendering via `image-rendering: pixelated`
- `src/index.html` — CSP: `img-src 'self' file:` (spritesheets loaded as `file://` URLs). Loads `renderer.js` from same directory.
- `tsconfig.json` — compiles `src/main.ts` + `src/preload.ts` to `dist/` (CJS, Node16 resolution)

## Window Properties (critical for behavior)
- `frame: false`, `transparent: true` — frameless overlay
- `alwaysOnTop: true` — stays above all windows
- `focusable: false` — does not steal focus
- `skipTaskbar: true` — no Dock icon for this window
- `closable: false`, `resizable: false` — fixed chrome (quit only via tray menu)
- `hasShadow: false`, `sandbox: false` — sandbox disabled so preload can access Node APIs
- Window close event is prevented; quit only via `app.isQuitting = true` then `app.quit()`

## Interaction Model (renderer-side timings)
- Left click on pet → plays `jumping` animation (loops=false), reverts to `idle` after 1500ms
- Mouse X tracking: main process polls cursor every 50ms, sends X to renderer
- Pet follows cursor X (offset by WIN_SIZE/2), stops following after 3s of cursor stillness
- Roaming: picks random X target every 5s when idle
- Random animations: 30% chance every 4s when not moving (plays waving/waiting/review/failed for 3s)
- Context menu shown on right-click (hidden by default, rendered in-window)

## Known Issues / TODO
- [ ] Drag to reposition not fully implemented (uses `-webkit-app-region: drag` in libre mode only)
- [ ] `enforceDockY` runs regardless of petMode, can interfere with libre mode Y positioning
- [ ] FPS config value (default 12) is never read from store; renderer hardcodes DEFAULT_FPS = 5
- [ ] No fullscreen hide behavior
- [ ] Multi-monitor: dock bounds computed from `screen.getPrimaryDisplay()` only
- [ ] Pets loaded once at startup — no filesystem watch for new pets
