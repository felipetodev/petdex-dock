import { DOCK_MARGIN, WIN_SIZE } from '../constants';
import type { DockBounds } from '../shared/types';

export type RoamingBounds = {
  minX: number;
  maxX: number;
};

export function getRoamingBounds(dockBounds: DockBounds | null): RoamingBounds {
  if (!dockBounds) return { minX: 100, maxX: 1720 };

  const minX = dockBounds.left + DOCK_MARGIN;
  const maxX = dockBounds.right - DOCK_MARGIN - WIN_SIZE;

  return {
    minX: Math.min(minX, maxX),
    maxX: Math.max(minX, maxX)
  };
}

export function clampToDockBounds(x: number, dockBounds: DockBounds | null): number {
  const { minX, maxX } = getRoamingBounds(dockBounds);
  return Math.max(minX, Math.min(maxX, x));
}

export function pickRoamingTarget(petX: number, dockBounds: DockBounds | null): number | null {
  if (!dockBounds) return null;

  const { minX, maxX } = getRoamingBounds(dockBounds);
  if (maxX - minX <= 5) return null;

  let nextTarget = petX;
  for (let attempt = 0; attempt < 8; attempt++) {
    nextTarget = Math.floor(minX + Math.random() * (maxX - minX));
    if (Math.abs(nextTarget - petX) > 5) break;
  }

  if (Math.abs(nextTarget - petX) <= 5) {
    nextTarget = petX < (minX + maxX) / 2 ? Math.floor(maxX) : Math.ceil(minX);
  }

  return Math.abs(nextTarget - petX) > 5 ? nextTarget : null;
}
