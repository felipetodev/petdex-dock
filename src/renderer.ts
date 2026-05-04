import type { DockBounds, PetMode } from './types';

const ANIMATIONS: Record<string, { row: number; frames: number; name: string }> = {
  idle:      { row: 0, frames: 6, name: 'idle' },
  runRight:  { row: 1, frames: 8, name: 'runRight' },
  runLeft:   { row: 2, frames: 8, name: 'runLeft' },
  waving:    { row: 3, frames: 4, name: 'waving' },
  jumping:   { row: 4, frames: 5, name: 'jumping' },
  failed:    { row: 5, frames: 8, name: 'failed' },
  waiting:   { row: 6, frames: 6, name: 'waiting' },
  running:   { row: 7, frames: 6, name: 'running' },
  review:    { row: 8, frames: 6, name: 'review' }
};

const DEFAULT_FPS = 5;
const WIN_SIZE = 96;
const FRAME_SIZE = 64;
const MOVE_SPEED = 0.3;
const ANIMATION_DURATION = 3000;
const DOCK_MARGIN = 16;
const CURSOR_STILL_DELAY = 3000;

let currentAnimation = 'idle';
let currentFrame = 0;
let fps = DEFAULT_FPS;
let lastFrameTime = 0;

let petX = 0;
let petY = 0;
let targetX = 0;
let dockBounds: DockBounds | null = null;
let mouseX = 0;
let isMoving = false;
let animationTimer: ReturnType<typeof setTimeout> | null = null;
let isClickDisabled = false;
let petMode: PetMode = 'dock';
let roamTimer: ReturnType<typeof setInterval> | null = null;

let cursorTargetX: number | null = null;
let cursorStillTimer: ReturnType<typeof setTimeout> | null = null;

const sprite = document.getElementById('pet-sprite')!;
const contextMenu = document.getElementById('context-menu')!;

function setSpritesheet(path: string): void {
  sprite.style.backgroundImage = `url('file://${path}')`;
}

function playAnimation(animName: string, loop = true): void {
  if (!ANIMATIONS[animName]) {
    animName = 'idle';
  }
  if (currentAnimation === animName && loop) return;

  currentAnimation = animName;
  currentFrame = 0;
  updateSpriteFrame();
}

function updateSpriteFrame(): void {
  const anim = ANIMATIONS[currentAnimation];
  if (!anim) return;

  const row = anim.row;
  const frameIndex = currentFrame % anim.frames;

  const x = frameIndex * FRAME_SIZE;
  const y = row * FRAME_SIZE;

  sprite.style.backgroundPosition = `-${x}px -${y}px`;
}

function animate(timestamp: number): void {
  if (!lastFrameTime) lastFrameTime = timestamp;
  const elapsed = timestamp - lastFrameTime;
  const frameInterval = 1000 / fps;

  if (elapsed >= frameInterval) {
    const anim = ANIMATIONS[currentAnimation];
    if (anim) {
      currentFrame = (currentFrame + 1) % anim.frames;
      updateSpriteFrame();
    }
    lastFrameTime = timestamp;
  }

  requestAnimationFrame(animate);
}

function updatePetPosition(): void {
  if (Math.abs(petX - targetX) > MOVE_SPEED) {
    if (petX < targetX) {
      petX += MOVE_SPEED;
      playAnimation('runRight', true);
    } else {
      petX -= MOVE_SPEED;
      playAnimation('runLeft', true);
    }
    isMoving = true;
    isClickDisabled = false;
  } else {
    if (isMoving) {
      currentAnimation = 'idle';
      currentFrame = 0;
      updateSpriteFrame();
      isMoving = false;
    }
  }

  window.petdex.setPosition(petX, petY);
  requestAnimationFrame(updatePetPosition);
}

function showContextMenu(x: number, y: number): void {
  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;
  contextMenu.classList.remove('hidden');
}

function hideContextMenu(): void {
  contextMenu.classList.add('hidden');
}

function randomAnimation(): void {
  const animations = ['waving', 'waiting', 'review', 'failed'];
  const random = animations[Math.floor(Math.random() * animations.length)];
  playAnimation(random, false);

  if (animationTimer) clearTimeout(animationTimer);
  animationTimer = setTimeout(() => {
    playAnimation('idle', true);
  }, ANIMATION_DURATION);
}

function getRoamingBounds(): { minX: number; maxX: number } {
  if (!dockBounds) return { minX: 100, maxX: 1720 };

  const isLibre = petMode === 'libre';
  if (isLibre) {
    return {
      minX: DOCK_MARGIN,
      maxX: (window.screen.width || 1920) - WIN_SIZE - DOCK_MARGIN
    };
  }

  const minX = dockBounds.left + DOCK_MARGIN;
  const maxX = dockBounds.right - DOCK_MARGIN - WIN_SIZE;

  return {
    minX: Math.min(minX, maxX),
    maxX: Math.max(minX, maxX)
  };
}

function clampToDockBounds(x: number): number {
  const { minX, maxX } = getRoamingBounds();
  return Math.max(minX, Math.min(maxX, x));
}

function handleCursorMove(mX: number): void {
  const target = clampToDockBounds(mX - WIN_SIZE / 2);

  if (cursorTargetX !== target) {
    cursorTargetX = target;
    targetX = target;

    if (cursorStillTimer) clearTimeout(cursorStillTimer);
    cursorStillTimer = setTimeout(() => {
      if (cursorTargetX === target) {
        cursorTargetX = null;
        targetX = petX;
      }
    }, CURSOR_STILL_DELAY);
  }
}

function startRoaming(): void {
  if (roamTimer) clearInterval(roamTimer);
  roamTimer = setInterval(() => {
    if (isMoving || isClickDisabled || cursorTargetX !== null) return;

    const { minX, maxX } = getRoamingBounds();
    const randomTarget = minX + Math.random() * (maxX - minX);
    targetX = Math.floor(randomTarget);

    if (Math.abs(targetX - petX) > 5) {
      if (targetX < petX) {
        playAnimation('runLeft', true);
      } else {
        playAnimation('runRight', true);
      }
      isMoving = true;
    }
  }, 5000);
}

async function loadActivePet(): Promise<void> {
  try {
    const pet = await window.petdex.getActivePet();
    dockBounds = await window.petdex.getDockBounds();
    petMode = await window.petdex.getPetMode() || 'dock';
    document.documentElement.classList.toggle('libre', petMode === 'libre');

    if (pet && dockBounds) {
      setSpritesheet(pet.spritesheetPath);

      petX = dockBounds.x + dockBounds.width / 2 - WIN_SIZE / 2;
      petY = dockBounds.y - WIN_SIZE;
      targetX = petX;

      window.petdex.setPosition(petX, petY);

      playAnimation('idle', true);
      startRoaming();
    }
  } catch (error) {
    console.error('Failed to load pet:', error);
  }
}

async function toggleMode(): Promise<PetMode> {
  petMode = petMode === 'dock' ? 'libre' : 'dock';
  await window.petdex.setPetMode(petMode);
  document.documentElement.classList.toggle('libre', petMode === 'libre');
  document.getElementById('mode-indicator')!.textContent = petMode === 'libre' ? 'Libre' : 'Dock';
  return petMode;
}

setInterval(() => {
  if (!isMoving && dockBounds && !isClickDisabled) {
    if (Math.random() < 0.3) {
      randomAnimation();
    }
  }
}, 4000);

window.addEventListener('DOMContentLoaded', () => {
  loadActivePet();
  requestAnimationFrame(animate);
  requestAnimationFrame(updatePetPosition);

  window.petdex.onMousePositionChanged((newMouseX: number) => {
    mouseX = newMouseX;
    handleCursorMove(mouseX);
  });

  sprite.addEventListener('click', (e: MouseEvent) => {
    if (e.button === 0 && !isClickDisabled) {
      e.stopPropagation();
      playAnimation('jumping', false);

      setTimeout(() => {
        playAnimation('idle', true);
      }, 1500);
    }
  });

  window.petdex.onPetChanged((pet) => {
    setSpritesheet(pet.spritesheetPath);
    playAnimation('idle', true);
  });

  setInterval(async () => {
    dockBounds = await window.petdex.getDockBounds();
  }, 5000);
});
