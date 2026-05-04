export type Pet = {
  id: string;
  displayName: string;
  description: string;
  spritesheetPath: string;
};

export type DockBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
  left: number;
  right: number;
};

export type PetMode = 'dock' | 'libre';

export type PetDexAPI = {
  getPets(): Promise<Pet[]>;
  getActivePet(): Promise<Pet | null>;
  setActivePet(petId: string): Promise<Pet | undefined>;
  getPetData(petId: string): Promise<Pet | null>;
  savePosition(x: number, y: number): Promise<void>;
  getWindowPosition(): Promise<[number, number] | null>;
  getDockBounds(): Promise<DockBounds>;
  getPetMode(): Promise<PetMode>;
  setPetMode(mode: PetMode): Promise<void>;
  getMousePosition(): Promise<number>;
  setPosition(x: number, y: number): void;
  onPetChanged(callback: (pet: Pet) => void): void;
  onMousePositionChanged(callback: (x: number) => void): void;
  onPositionUpdate(callback: (position: unknown) => void): void;
  onShowMenu(callback: () => void): void;
};

declare global {
  interface Window {
    petdex: PetDexAPI;
  }
}
