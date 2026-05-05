import Store from 'electron-store';

export interface StoreSchema {
  activePet: string | null;
  position: { x: number; y: number } | null;
  fps: number;
}

export const store = new Store<StoreSchema>({
  defaults: {
    activePet: null,
    position: null,
    fps: 12
  }
});
