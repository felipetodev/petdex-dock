# PetDex Dock - Agent Instructions

## Project Type
Electron 33 + TypeScript app for macOS. Frameless, transparent, always-on-top overlay window that displays animated pets near the Dock.

Source is TypeScript (`src/**/*.ts`), compiled to `dist/` for production. Dev uses `tsx` to run `src/main/index.ts` directly.

## Key Commands
```bash
pnpm compile        # Compile TS → dist/ + copy html/css assets
pnpm start          # Compile + run (tsx src/main/index.ts)
pnpm dev            # Compile + run with --enable-logging
pnpm build          # Compile + build macOS .app (electron-builder --mac)
pnpm build:dir      # Build unpacked macOS app for quick testing
```

There is no test suite and no linting in this project. TypeScript provides type checking via `npx tsc --noEmit`.

## Build Pipeline
- **Dev**: `tsx src/main/index.ts` runs the main process directly after `pnpm compile` has produced renderer/preload assets in `dist/`.
- **Production**: `tsc` compiles `src/**/*.ts` → `dist/` (CJS). `esbuild` bundles `src/renderer/index.ts` → `dist/renderer.js` (IIFE). `electron-builder` packages from `dist/`.
- `package.json` `"main": "dist/main/index.js"` is used by electron-builder for production builds.

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

Animation constants are defined in `src/renderer/animations.ts` (single source of truth).

## Config Storage
`~/Library/Application Support/petdex-dock/config.json` via electron-store v8

Defaults: `{ activePet: null, position: null, fps: 12 }`

**Do not upgrade electron-store to v9** — v9 is ESM-only, this project uses CJS.

## Architecture
- `src/main/index.ts` — main process entrypoint and orchestration.
- `src/main/*.ts` — main process modules for window creation, tray, IPC handlers, mouse polling (every 50ms), dock position snap (`snapPetWindowToDockY` every 2s), pets, and store.
- `src/preload.ts` — `contextBridge.exposeInMainWorld('petdex', { ... })` — IPC invoke/send + event listeners. 9 API methods exposed.
- `src/renderer/index.ts` — renderer entrypoint. Compiled via esbuild to IIFE for browser loading.
- `src/renderer/*.ts` — renderer modules for sprite animation, mouse tracking, dock-constrained roaming, DOM wiring, and pet behavior control.
- `src/shared/types.ts` — shared type declarations for `Pet`, `DockBounds`, `PetDexAPI`, and `window.petdex`.
- `src/constants.ts` — shared timing, size, and app constants.
- `src/styles.css` — pixel-art rendering via `image-rendering: pixelated`
- `src/index.html` — CSP: `img-src 'self' file:` (spritesheets loaded as `file://` URLs). Context menu: "Change Pet" only. Loads `renderer.js` from same directory.
- `tsconfig.json` — compiles `src/**/*.ts` to `dist/` (CJS, Node resolution)

## Window Properties (critical for behavior)
- `frame: false`, `transparent: true` — frameless overlay
- `alwaysOnTop: true` — stays above all windows
- `focusable: false` — does not steal focus
- `skipTaskbar: true` — no Dock icon for this window
- `closable: false`, `resizable: false` — fixed chrome (quit only via tray menu)
- `hasShadow: false`, `sandbox: false` — sandbox disabled so preload can access Node APIs
- Window close event is prevented; quit only via `app.isQuitting = true` then `app.quit()`

## Behavior
The pet is always dock-constrained: it roams horizontally within the macOS Dock area. `snapToDockY()` runs every 2s in the main process to snap Y position to dock level.

## Interaction Model (renderer-side timings)
- Mouse X tracking: main process polls cursor every 50ms, sends X to renderer
- Pet follows cursor X (offset by WIN_SIZE/2), stops following after 3s of cursor stillness
- Roaming: picks random X target every 5s when not moving, not in AFK animation, and not following cursor (constrained to dock bounds)
- AFK animations: after `runLeft`/`runRight`, shows exactly one non-run animation (`idle` or waving/waiting/review/failed/jumping) for at least 3s before the next roam move. Cursor movement interrupts AFK immediately and switches to `runLeft`/`runRight`.
- Context menu shown on right-click (hidden by default, rendered in-window) — "Change Pet" only

## Known Issues / TODO
- [ ] FPS config value (default 12) is never read from store; renderer hardcodes DEFAULT_FPS = 5
- [ ] No fullscreen hide behavior
- [ ] Multi-monitor: dock bounds computed from `screen.getPrimaryDisplay()` only
- [ ] Pets loaded once at startup — no filesystem watch for new pets
