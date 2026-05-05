import { ipcMain, type BrowserWindow } from 'electron';
import type { DockBounds, Pet } from '../shared/types';

type IpcDependencies = {
  getPets: () => Pet[];
  getActivePetId: () => string | null;
  selectPet: (petId: string) => Pet | undefined;
  getPetWindow: () => BrowserWindow | null;
  getDockBounds: () => DockBounds;
  openPetdexGallery: () => void;
};

export function setupIPC(dependencies: IpcDependencies): void {
  ipcMain.handle('get-active-pet', () => {
    const activePetId = dependencies.getActivePetId();
    return dependencies.getPets().find(pet => pet.id === activePetId) || dependencies.getPets()[0] || null;
  });

  ipcMain.handle('set-active-pet', (_event, petId: string) => {
    return dependencies.selectPet(petId);
  });

  ipcMain.handle('get-dock-bounds', () => {
    return dependencies.getDockBounds();
  });

  ipcMain.on('set-position', (_event, x: number, y: number) => {
    const window = dependencies.getPetWindow();

    if (window) {
      window.setPosition(Math.floor(x), Math.floor(y));
    }
  });

  ipcMain.handle('open-petdex-gallery', () => {
    dependencies.openPetdexGallery();
  });
}
