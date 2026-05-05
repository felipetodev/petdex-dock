import { app, Menu, Tray } from 'electron';
import path from 'path';
import type { Pet } from '../shared/types';

type TrayDependencies = {
  getPets: () => Pet[];
  getActivePetId: () => string | null;
  selectPet: (petId: string) => void;
  openPetdexGallery: () => void;
  repositionPetWindow: () => void;
  quitApp: () => void;
};

let tray: Tray | null = null;
let dependencies: TrayDependencies | null = null;

const appRoot = path.resolve(__dirname, '..', '..');

export function createTray(trayDependencies: TrayDependencies): void {
  dependencies = trayDependencies;

  const iconPath = path.join(appRoot, 'assets', 'tray-icon.png');
  tray = new Tray(iconPath);
  tray.setToolTip('PetDex Dock');

  updateTrayMenu();

  tray.on('click', () => {
    dependencies?.repositionPetWindow();
  });
}

export function setupDockMenu(openPetdexGallery: () => void): void {
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

export function updateTrayMenu(): void {
  if (!tray || !dependencies) return;

  const activePetId = dependencies.getActivePetId();
  const petMenuItems = dependencies.getPets().map(pet => ({
    label: pet.displayName || pet.id,
    type: 'radio' as const,
    checked: pet.id === activePetId,
    click: () => {
      dependencies?.selectPet(pet.id);
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
        dependencies?.openPetdexGallery();
      }
    },
    {
      label: 'Quit',
      click: () => {
        dependencies?.quitApp();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
}

export function destroyTray(): void {
  tray?.destroy();
  tray = null;
  dependencies = null;
}
