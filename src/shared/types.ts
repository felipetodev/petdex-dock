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

export type CliEventSource = 'codex' | 'claude' | 'opencode' | 'manual';
export type CliEventState = 'running' | 'waiting' | 'failed' | 'review' | 'idle';

export type CliPetEvent = {
  source: CliEventSource;
  state: CliEventState;
  message?: string;
};

export type PetDexAPI = {
  getActivePet(): Promise<Pet | null>;
  setActivePet(petId: string): Promise<Pet | undefined>;
  getDockBounds(): Promise<DockBounds>;
  openPetdexGallery(): Promise<void>;
  setPosition(x: number, y: number): void;
  onPetChanged(callback: (pet: Pet) => void): void;
  onMousePositionChanged(callback: (x: number) => void): void;
  onCliEvent(callback: (event: CliPetEvent) => void): void;
};

declare global {
  interface Window {
    petdex: PetDexAPI;
  }
}
