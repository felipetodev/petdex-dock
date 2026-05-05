import { app, BrowserWindow, screen } from 'electron';
import path from 'path';
import { DOCK_SNAP_TOLERANCE, PETDEX_GALLERY_URL, WIN_SIZE } from '../constants';
import type { DockBounds } from '../shared/types';

type CreatePetWindowOptions = {
  savedPosition: { x: number; y: number } | null;
  isQuitting: () => boolean;
  onMoved: (position: { x: number; y: number }) => void;
};

let petWindow: BrowserWindow | null = null;
let petdexWindow: BrowserWindow | null = null;

const rendererRoot = app.isPackaged
  ? path.resolve(__dirname, '..')
  : path.resolve(__dirname, '..', '..', 'dist');

export function getPetWindow(): BrowserWindow | null {
  return petWindow;
}

export function createPetWindow(options: CreatePetWindowOptions): BrowserWindow {
  const workArea = getWorkArea();
  const winWidth = WIN_SIZE;
  const winHeight = WIN_SIZE;

  const initialPosition = options.savedPosition ?? {
    x: workArea.x + Math.round((workArea.width - winWidth) / 2),
    y: workArea.y + workArea.height - winHeight
  };

  petWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x: initialPosition.x,
    y: initialPosition.y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(rendererRoot, 'preload.js'),
      contextIsolation: true,
      sandbox: false
    }
  });

  petWindow.loadFile(path.join(rendererRoot, 'index.html'));

  petWindow.on('moved', () => {
    if (!petWindow || petWindow.isDestroyed()) return;
    const [x, y] = petWindow.getPosition();
    options.onMoved({ x, y });
  });

  petWindow.on('close', (event) => {
    if (!options.isQuitting()) {
      event.preventDefault();
    }
  });

  petWindow.on('closed', () => {
    petWindow = null;
  });

  return petWindow;
}

export function repositionPetWindow(): void {
  if (!petWindow) return;

  const workArea = getWorkArea();
  const [winWidth, winHeight] = petWindow.getSize();
  petWindow.setPosition(
    workArea.x + Math.round((workArea.width - winWidth) / 2),
    workArea.y + workArea.height - winHeight
  );
}

export function snapPetWindowToDockY(): void {
  if (!petWindow) return;

  const workArea = getWorkArea();
  const [currentX, currentY] = petWindow.getPosition();
  const [, winHeight] = petWindow.getSize();
  const correctY = workArea.y + workArea.height - winHeight;

  if (Math.abs(currentY - correctY) > DOCK_SNAP_TOLERANCE) {
    petWindow.setPosition(currentX, correctY);
  }
}

export function openPetdexGallery(): void {
  if (petdexWindow && !petdexWindow.isDestroyed()) {
    petdexWindow.show();
    petdexWindow.focus();
    return;
  }

  petdexWindow = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 820,
    minHeight: 560,
    title: 'Change Pet',
    backgroundColor: '#101010',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  petdexWindow.loadURL(PETDEX_GALLERY_URL);

  petdexWindow.on('closed', () => {
    petdexWindow = null;
  });
}

export function getDockBounds(): DockBounds {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { bounds, workArea } = primaryDisplay;
  const dockHeight = bounds.height - workArea.y - workArea.height;

  return {
    x: bounds.x,
    y: workArea.y + workArea.height,
    width: bounds.width,
    height: dockHeight,
    left: bounds.x,
    right: bounds.x + bounds.width
  };
}

function getWorkArea(): Electron.Rectangle {
  return screen.getPrimaryDisplay().workArea;
}
