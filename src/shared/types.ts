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

export type PetDexAPI = {
  getActivePet(): Promise<Pet | null>;
  setActivePet(petId: string): Promise<Pet | undefined>;
  getDockBounds(): Promise<DockBounds>;
  openPetdexGallery(): Promise<void>;
  setPosition(x: number, y: number): void;
  onPetChanged(callback: (pet: Pet) => void): void;
  onMousePositionChanged(callback: (x: number) => void): void;
};

declare global {
  interface Window {
    petdex: PetDexAPI;
  }
}
