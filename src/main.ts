import { app, BrowserWindow, screen, Tray, Menu, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import Store from 'electron-store';
import type { Pet, DockBounds } from './types';

interface StoreSchema {
  activePet: string | null;
  position: { x: number; y: number } | null;
  fps: number;
}

const store = new Store<StoreSchema>({
  defaults: {
    activePet: null,
    position: null,
    fps: 12
  }
});

let window: BrowserWindow | null = null;
let petdexWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let pets: Pet[] = [];
let mouseX = 0;
let isQuitting = false;

const PETS_DIR = path.join(app.getPath('home'), '.codex', 'pets');

function getAllPets(): Pet[] {
  const petDirs = fs.readdirSync(PETS_DIR).filter(name => {
    const petPath = path.join(PETS_DIR, name);
    return fs.statSync(petPath).isDirectory();
  });

  return petDirs.map(petId => {
    const petJsonPath = path.join(PETS_DIR, petId, 'pet.json');
    const spritesheetPath = path.join(PETS_DIR, petId, 'spritesheet.webp');

    if (!fs.existsSync(petJsonPath) || !fs.existsSync(spritesheetPath)) {
      return null;
    }

    const petData = JSON.parse(fs.readFileSync(petJsonPath, 'utf8'));
    return {
      id: petId,
      ...petData,
      spritesheetPath
    } as Pet;
  }).filter((p): p is Pet => p !== null);
}

function getWorkArea(): Electron.Rectangle {
  return screen.getPrimaryDisplay().workArea;
}

function repositionWindow(): void {
  if (!window) return;
  const workArea = getWorkArea();
  const [winWidth, winHeight] = window.getSize();
  window.setPosition(
    workArea.x + Math.round((workArea.width - winWidth) / 2),
    workArea.y + workArea.height - winHeight
  );
}

function createWindow(): void {
  const PET_WINDOW_SIZE = 96;
  const workArea = getWorkArea();
  const winWidth = PET_WINDOW_SIZE;
  const winHeight = PET_WINDOW_SIZE;

  const savedPosition = store.get('position');

  let x: number, y: number;
  if (savedPosition) {
    x = savedPosition.x;
    y = savedPosition.y;
  } else {
    x = workArea.x + Math.round((workArea.width - winWidth) / 2);
    y = workArea.y + workArea.height - winHeight;
  }

  window = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: false
    }
  });

  window.loadFile(path.join(__dirname, 'index.html'));

  window.on('moved', () => {
    if (!window || window.isDestroyed()) return;
    const [newX, newY] = window.getPosition();
    store.set('position', { x: newX, y: newY });
  });

  window.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
    }
  });

  window.on('closed', () => {
    window = null;
  });

  startMouseTracking();
}

function snapToDockY(): void {
  if (!window) return;
  const workArea = getWorkArea();
  const [currentX, currentY] = window.getPosition();
  const [, winHeight] = window.getSize();
  const correctY = workArea.y + workArea.height - winHeight;
  if (Math.abs(currentY - correctY) > 2) {
    window.setPosition(currentX, correctY);
  }
}

let mouseTrackingInterval: ReturnType<typeof setInterval> | null = null;
let snapInterval: ReturnType<typeof setInterval> | null = null;
let lastMouseX = 0;

function startMouseTracking(): void {
  mouseTrackingInterval = setInterval(() => {
    const cursor = screen.getCursorScreenPoint();
    const currentMouseX = cursor.x;
    if (currentMouseX !== lastMouseX) {
      lastMouseX = currentMouseX;
      mouseX = currentMouseX;
      if (window && !window.isDestroyed()) {
        window.webContents.send('mouse-position-changed', currentMouseX);
      }
    }
  }, 50);
}

app.on('before-quit', () => {
  isQuitting = true;
  stopIntervals();
});

function stopIntervals(): void {
  if (mouseTrackingInterval) {
    clearInterval(mouseTrackingInterval);
    mouseTrackingInterval = null;
  }

  if (snapInterval) {
    clearInterval(snapInterval);
    snapInterval = null;
  }
}

function quitApp(): void {
  isQuitting = true;
  stopIntervals();
  tray?.destroy();
  tray = null;
  app.quit();
}

function openPetdexGallery(): void {
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

  petdexWindow.loadURL('https://petdex.crafter.run');

  petdexWindow.on('closed', () => {
    petdexWindow = null;
  });
}

function setupDockMenu(): void {
  if (process.platform !== 'darwin' || !app.dock) return;

  const dockMenu = Menu.buildFromTemplate([
    {
      label: 'Change Pet',
      click: () => {
        openPetdexGallery();
      }
    }
  ]);

  app.dock.setMenu(dockMenu);
}

function createTray(): void {
  const iconPath = path.join(__dirname, '..', 'assets', 'tray-icon.png');
  tray = new Tray(iconPath);
  tray.setToolTip('PetDex Dock');

  updateTrayMenu();

  tray.on('click', () => {
    repositionWindow();
  });
}

function updateTrayMenu(): void {
  if (!tray) return;
  const activePetId = store.get('activePet');

  const petMenuItems = pets.map(pet => ({
    label: pet.displayName || pet.id,
    type: 'radio' as const,
    checked: pet.id === activePetId,
    click: () => {
      store.set('activePet', pet.id);
      window?.webContents.send('pet-changed', pet);
      updateTrayMenu();
    }
  }));

  const contextMenu = Menu.buildFromTemplate([
    { label: 'PetDex', enabled: false },
    { type: 'separator' },
    ...petMenuItems,
    { type: 'separator' },
    {
      label: 'Change Pet',
      click: () => {
        openPetdexGallery();
      }
    },

    {
      label: 'Quit',
      click: () => {
        quitApp();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
}

function setupIPC(): void {
  ipcMain.handle('get-active-pet', () => {
    const activePetId = store.get('activePet');
    return pets.find(p => p.id === activePetId) || pets[0] || null;
  });

  ipcMain.handle('set-active-pet', (_event, petId: string) => {
    store.set('activePet', petId);
    const pet = pets.find(p => p.id === petId);
    if (pet) {
      window?.webContents.send('pet-changed', pet);
      updateTrayMenu();
    }
    return pet;
  });

  ipcMain.handle('get-dock-bounds', (): DockBounds => {
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
  });

  ipcMain.on('set-position', (_event, x: number, y: number) => {
    if (window) {
      window.setPosition(Math.floor(x), Math.floor(y));
    }
  });

  ipcMain.handle('open-petdex-gallery', () => {
    openPetdexGallery();
  });
}

app.whenReady().then(() => {
  if (!fs.existsSync(PETS_DIR)) {
    fs.mkdirSync(PETS_DIR, { recursive: true });
  }

  pets = getAllPets();

  if (pets.length === 0) {
    console.warn('No pets found in ~/.codex/pets. Install one with: npx petdex install <pet-name>');
  }

  createWindow();
  createTray();
  setupDockMenu();
  setupIPC();
  snapInterval = setInterval(snapToDockY, 2000);

  screen.on('display-metrics-changed', (_, _display, changedMetrics) => {
    if (changedMetrics.includes('workArea')) {
      repositionWindow();
    }
  });

  if (pets.length > 0 && !store.get('activePet')) {
    store.set('activePet', pets[0].id);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
