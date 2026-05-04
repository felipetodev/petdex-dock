# PetDex Dock

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
