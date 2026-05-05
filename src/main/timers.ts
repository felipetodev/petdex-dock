import { screen, type BrowserWindow } from 'electron';
import { DOCK_SNAP_INTERVAL, MOUSE_POLL_INTERVAL } from '../constants';

let mouseTrackingInterval: ReturnType<typeof setInterval> | null = null;
let snapInterval: ReturnType<typeof setInterval> | null = null;
let lastMouseX = 0;

export function startMouseTracking(getWindow: () => BrowserWindow | null): void {
  stopMouseTracking();

  mouseTrackingInterval = setInterval(() => {
    const cursor = screen.getCursorScreenPoint();
    const currentMouseX = cursor.x;

    if (currentMouseX !== lastMouseX) {
      lastMouseX = currentMouseX;
      const window = getWindow();

      if (window && !window.isDestroyed()) {
        window.webContents.send('mouse-position-changed', currentMouseX);
      }
    }
  }, MOUSE_POLL_INTERVAL);
}

export function startDockSnap(snapToDock: () => void): void {
  if (snapInterval) clearInterval(snapInterval);
  snapInterval = setInterval(snapToDock, DOCK_SNAP_INTERVAL);
}

export function stopIntervals(): void {
  stopMouseTracking();

  if (snapInterval) {
    clearInterval(snapInterval);
    snapInterval = null;
  }
}

function stopMouseTracking(): void {
  if (mouseTrackingInterval) {
    clearInterval(mouseTrackingInterval);
    mouseTrackingInterval = null;
  }
}
