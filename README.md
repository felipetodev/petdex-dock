# PetDex Dock

https://github.com/user-attachments/assets/7d02a17e-1b13-41db-9523-8b75c7d59021

Virtual pet companion for macOS that lives in your Dock.

## Overview

PetDex Dock brings Codex/animated pixel pets to your desktop. It creates a frameless, always-on-top window that displays your pet near the macOS Dock. The pet follows the mouse, animates in various states.

Uses the [PetDex public gallery](https://petdex.crafter.run/) for Codex-compatible animated pets.

## macOS Install Notice

PetDex Dock is distributed directly through GitHub Releases. It is not registered with Apple, not published on the Mac App Store, and current release builds are not signed/notarized with an Apple Developer ID.

Because of that, macOS Gatekeeper may show a warning such as:

> "PetDex Dock" is damaged and can't be opened. You should move it to the Trash.

This does not necessarily mean the downloaded app is corrupted. It is a common macOS protection shown for apps downloaded from the internet when Apple cannot verify a Developer ID signature and notarization ticket.

How to bypass the warning and open PetDex Dock:

1. Download the `.dmg` from GitHub Releases.
2. Open the `.dmg` and drag `PetDex Dock.app` into `/Applications`.
3. Remove the macOS quarantine flag:

```bash
xattr -dr com.apple.quarantine "/Applications/PetDex Dock.app"
```

4. Open `PetDex Dock.app` from `/Applications`.

## Pets Directory

Pets are installed to `~/.codex/pets/{petId}/` and must contain:

```
~/.codex/pets/{petId}/
├── pet.json          # { id, displayName, description }
└── spritesheet.webp  # 512x576px (8 cols x 9 rows of 64x64 frames)
```

### Install a Pet

```bash
# check available pets on https://petdex.crafter.run
npx petdex install [pet] # e.g. npx petdex install clippy
```

## Animation System

All pets share the same animation states (rows in spritesheet):

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

## CLI Event Bridge

PetDex Dock listens for local CLI events at:

```bash
http://127.0.0.1:17321/event
```

Send a pet state with:

```bash
curl -X POST http://127.0.0.1:17321/event \
  -H 'content-type: application/json' \
  -d '{"source":"manual","state":"running"}'
```

Supported payload:

```json
{
  "source": "codex|claude|opencode|manual",
  "state": "running|waiting|failed|review|idle",
  "message": "optional"
}
```

External CLI events override the normal roaming animation while the CLI state is active. Mouse movement is ignored while a CLI override is active; the override ends when another CLI event arrives or when the CLI sends `idle`.

### Claude Code Example

Claude Code HTTP hooks can post directly to the local bridge. Add this shape to your Claude settings if you want a project-local test:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "http",
            "url": "http://127.0.0.1:17321/event",
            "body": { "source": "claude", "state": "running" }
          }
        ]
      }
    ],
    "Notification": [
      {
        "hooks": [
          {
            "type": "http",
            "url": "http://127.0.0.1:17321/event",
            "body": { "source": "claude", "state": "waiting" }
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "http",
            "url": "http://127.0.0.1:17321/event",
            "body": { "source": "claude", "state": "review" }
          }
        ]
      }
    ]
  }
}
```

### OpenCode Example

Create a global OpenCode plugin at `~/.config/opencode/plugins/petdex.js`, or a project-local plugin at `.opencode/plugins/petdex.js`:

```js
const endpoint = 'http://127.0.0.1:17321/event';

async function send(state, message) {
  const payload = { source: 'opencode', state, ...(message ? { message } : {}) };

  await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(() => {});
}

function mapEventToState(type) {
  if (type === 'permission.asked') return 'waiting';
  if (type === 'session.error') return 'failed';
  if (type === 'session.idle') return 'idle';
  if (type === 'session.status') return 'running';
  if (type === 'tool.execute.before') return 'running';
  if (type === 'tool.execute.after') return 'review';
  return null;
}

export const PetDexPlugin = async ({ client }) => {
  await client.app.log({
    body: {
      service: 'petdex',
      level: 'info',
      message: 'PetDex OpenCode plugin loaded'
    }
  });

  return {
    event: async ({ event }) => {
      const state = mapEventToState(event.type);

      await client.app.log({
        body: {
          service: 'petdex',
          level: 'info',
          message: `OpenCode event: ${event.type}`,
          extra: { event }
        }
      });

      if (state) {
        await send(state, event.type);
      }
    }
  };
};
```

### Codex Example

Enable Codex hooks in `~/.codex/config.toml`:

```toml
[features]
codex_hooks = true
```

Create `~/.codex/hooks/petdex.cjs`:

```js
const http = require('http');

const EVENT_STATES = {
  SessionStart: 'running',
  UserPromptSubmit: 'running',
  PreToolUse: 'running',
  PermissionRequest: 'waiting',
  PostToolUse: 'review',
  Stop: 'idle'
};

function readStdin() {
  return new Promise((resolve) => {
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { input += chunk; });
    process.stdin.on('end', () => resolve(input));
  });
}

function postEvent(event) {
  return new Promise((resolve) => {
    const payload = JSON.stringify(event);
    const request = http.request({
      hostname: '127.0.0.1',
      port: 17321,
      path: '/event',
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload)
      },
      timeout: 1000
    }, response => {
      response.resume();
      response.on('end', resolve);
    });

    request.on('error', resolve);
    request.on('timeout', () => {
      request.destroy();
      resolve();
    });
    request.end(payload);
  });
}

(async () => {
  const rawInput = await readStdin();
  let input = {};

  try {
    input = rawInput ? JSON.parse(rawInput) : {};
  } catch {
    input = {};
  }

  const hookName = typeof input.hook_event_name === 'string' ? input.hook_event_name : 'Unknown';
  const state = EVENT_STATES[hookName] || 'review';
  const toolName = typeof input.tool_name === 'string' ? input.tool_name : '';
  const message = toolName ? `${hookName}:${toolName}` : hookName;

  await postEvent({ source: 'codex', state, message });

  if (hookName === 'Stop') {
    process.stdout.write(JSON.stringify({ continue: true }));
  }
})();
```

Create `~/.codex/hooks.json`:

```json
{
  "hooks": {
    "SessionStart": [{ "matcher": "startup|resume|clear", "hooks": [{ "type": "command", "command": "node ~/.codex/hooks/petdex.cjs" }] }],
    "UserPromptSubmit": [{ "hooks": [{ "type": "command", "command": "node ~/.codex/hooks/petdex.cjs" }] }],
    "PreToolUse": [{ "matcher": "*", "hooks": [{ "type": "command", "command": "node ~/.codex/hooks/petdex.cjs" }] }],
    "PermissionRequest": [{ "matcher": "*", "hooks": [{ "type": "command", "command": "node ~/.codex/hooks/petdex.cjs" }] }],
    "PostToolUse": [{ "matcher": "*", "hooks": [{ "type": "command", "command": "node ~/.codex/hooks/petdex.cjs" }] }],
    "Stop": [{ "hooks": [{ "type": "command", "command": "node ~/.codex/hooks/petdex.cjs", "timeout": 5 }] }]
  }
}
```

Restart Codex after changing hook configuration.

## Configuration

Stored in `~/Library/Application Support/petdex-dock/config.json`:

```json
{
  "activePet": "gutsy",
  "position": { "x": 100, "y": 200 },
  "fps": 12,
  "petMode": "dock"
}
```
