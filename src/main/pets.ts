import fs from 'fs';
import path from 'path';
import type { Pet } from '../shared/types';

type PetMetadata = {
  displayName: string;
  description: string;
};

export function getPetsDir(homeDir: string): string {
  return path.join(homeDir, '.codex', 'pets');
}

export function ensurePetsDir(petsDir: string): void {
  if (!fs.existsSync(petsDir)) {
    fs.mkdirSync(petsDir, { recursive: true });
  }
}

export function getAllPets(petsDir: string): Pet[] {
  const petDirs = fs.readdirSync(petsDir).filter(name => {
    const petPath = path.join(petsDir, name);
    return fs.statSync(petPath).isDirectory();
  });

  return petDirs
    .map(petId => loadPet(petsDir, petId))
    .filter((pet): pet is Pet => pet !== null);
}

function loadPet(petsDir: string, petId: string): Pet | null {
  const petJsonPath = path.join(petsDir, petId, 'pet.json');
  const spritesheetPath = path.join(petsDir, petId, 'spritesheet.webp');

  if (!fs.existsSync(petJsonPath) || !fs.existsSync(spritesheetPath)) {
    return null;
  }

  try {
    const petData = JSON.parse(fs.readFileSync(petJsonPath, 'utf8')) as unknown;
    if (!isPetMetadata(petData)) return null;

    return {
      id: petId,
      displayName: petData.displayName,
      description: petData.description,
      spritesheetPath
    };
  } catch (error) {
    console.warn(`Failed to load pet "${petId}":`, error);
    return null;
  }
}

function isPetMetadata(value: unknown): value is PetMetadata {
  if (!value || typeof value !== 'object') return false;

  const petData = value as Partial<PetMetadata>;
  return typeof petData.displayName === 'string' && typeof petData.description === 'string';
}
