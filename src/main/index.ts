import { app, screen } from 'electron';
import type { Pet } from '../shared/types';
import { startCliEventBridge, stopCliEventBridge } from './cli-event-bridge';
import { setupIPC } from './ipc';
import { ensurePetsDir, getAllPets, getPetsDir } from './pets';
import { store } from './store';
import { startDockSnap, startMouseTracking, stopIntervals } from './timers';
import { createTray, destroyTray, setupDockMenu, updateTrayMenu } from './tray';
import {
  createPetWindow,
  getDockBounds,
  getPetWindow,
  openPetdexGallery,
  repositionPetWindow,
  snapPetWindowToDockY
} from './windows';

let pets: Pet[] = [];
let isQuitting = false;

function getActivePetId(): string | null {
  return store.get('activePet');
}

function selectPet(petId: string): Pet | undefined {
  store.set('activePet', petId);
  const pet = pets.find(currentPet => currentPet.id === petId);

  if (pet) {
    getPetWindow()?.webContents.send('pet-changed', pet);
    updateTrayMenu();
  }

  return pet;
}

function quitApp(): void {
  isQuitting = true;
  stopIntervals();
  stopCliEventBridge();
  destroyTray();
  app.quit();
}

app.on('before-quit', () => {
  isQuitting = true;
  stopIntervals();
  stopCliEventBridge();
});

app.whenReady().then(() => {
  const petsDir = getPetsDir(app.getPath('home'));
  ensurePetsDir(petsDir);

  pets = getAllPets(petsDir);

  if (pets.length === 0) {
    console.warn('No pets found in ~/.codex/pets. Install one with: npx petdex install <pet-name>');
  }

  createPetWindow({
    savedPosition: store.get('position'),
    isQuitting: () => isQuitting,
    onMoved: (position) => {
      store.set('position', position);
    }
  });

  createTray({
    getPets: () => pets,
    getActivePetId,
    selectPet,
    openPetdexGallery,
    repositionPetWindow,
    quitApp
  });

  setupDockMenu(openPetdexGallery);

  setupIPC({
    getPets: () => pets,
    getActivePetId,
    selectPet,
    getPetWindow,
    getDockBounds,
    openPetdexGallery
  });

  startMouseTracking(getPetWindow);
  startDockSnap(snapPetWindowToDockY);
  startCliEventBridge({ getPetWindow });

  screen.on('display-metrics-changed', (_event, _display, changedMetrics) => {
    if (changedMetrics.includes('workArea')) {
      repositionPetWindow();
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
