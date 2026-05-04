import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('petdex', {
  getPets: (): Promise<unknown> => ipcRenderer.invoke('get-pets'),
  getActivePet: (): Promise<unknown> => ipcRenderer.invoke('get-active-pet'),
  setActivePet: (petId: string): Promise<unknown> => ipcRenderer.invoke('set-active-pet', petId),
  getPetData: (petId: string): Promise<unknown> => ipcRenderer.invoke('get-pet-data', petId),
  savePosition: (x: number, y: number): Promise<void> => ipcRenderer.invoke('save-position', x, y),
  getWindowPosition: (): Promise<unknown> => ipcRenderer.invoke('get-window-position'),
  getDockBounds: (): Promise<unknown> => ipcRenderer.invoke('get-dock-bounds'),
  getPetMode: (): Promise<unknown> => ipcRenderer.invoke('get-pet-mode'),
  setPetMode: (mode: 'dock' | 'libre'): Promise<void> => ipcRenderer.invoke('set-pet-mode', mode),
  getMousePosition: (): Promise<unknown> => ipcRenderer.invoke('get-mouse-position'),
  openPetdexGallery: (): Promise<void> => ipcRenderer.invoke('open-petdex-gallery'),
  setPosition: (x: number, y: number): void => { ipcRenderer.send('set-position', x, y); },
  onPetChanged: (callback: (petData: unknown) => void): void => {
    ipcRenderer.on('pet-changed', (_event, petData) => callback(petData));
  },
  onMousePositionChanged: (callback: (mouseX: number) => void): void => {
    ipcRenderer.on('mouse-position-changed', (_event, mouseX) => callback(mouseX));
  },
  onPositionUpdate: (callback: (position: unknown) => void): void => {
    ipcRenderer.on('position-update', (_event, position) => callback(position));
  },
  onShowMenu: (callback: () => void): void => {
    ipcRenderer.on('show-menu', () => callback());
  }
});
