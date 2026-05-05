import {
  ANIMATION_DURATION,
  CURSOR_STILL_DELAY,
  MOVE_SPEED,
  ROAM_INTERVAL,
  WIN_SIZE
} from '../constants';
import type { DockBounds, Pet, PetDexAPI } from '../shared/types';
import { AfkAnimationPicker, SpriteAnimator } from './animations';
import type { AnimationName, MovementSource } from './types';
import { clampToDockBounds, pickRoamingTarget } from './movement';
import { setSpritesheet } from './dom';

export type PetControllerState = {
  petX: number;
  petY: number;
  targetX: number;
  dockBounds: DockBounds | null;
  isMoving: boolean;
  canPlayAfkAnimation: boolean;
  movementSource: MovementSource | null;
  cursorTargetX: number | null;
};

export class PetController {
  private readonly animator: SpriteAnimator;
  private readonly afkAnimationPicker = new AfkAnimationPicker();

  private petX = 0;
  private petY = 0;
  private targetX = 0;
  private dockBounds: DockBounds | null = null;
  private isMoving = false;
  private canPlayAfkAnimation = false;
  private movementSource: MovementSource | null = null;
  private cursorTargetX: number | null = null;

  private animationTimer: ReturnType<typeof setTimeout> | null = null;
  private roamTimer: ReturnType<typeof setInterval> | null = null;
  private cursorStillTimer: ReturnType<typeof setTimeout> | null = null;
  private dockBoundsTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly api: PetDexAPI,
    private readonly sprite: HTMLElement
  ) {
    this.animator = new SpriteAnimator(sprite);
  }

  async loadActivePet(): Promise<void> {
    try {
      const pet = await this.api.getActivePet();
      this.dockBounds = await this.api.getDockBounds();

      if (pet && this.dockBounds) {
        setSpritesheet(this.sprite, pet.spritesheetPath);

        this.petX = this.dockBounds.x + this.dockBounds.width / 2 - WIN_SIZE / 2;
        this.petY = this.dockBounds.y - WIN_SIZE;
        this.targetX = this.petX;

        this.api.setPosition(this.petX, this.petY);
        this.playAnimation('idle', true);
        this.startRoaming();
      }
    } catch (error) {
      console.error('Failed to load pet:', error);
    }
  }

  start(): void {
    requestAnimationFrame(this.animate);
    requestAnimationFrame(this.updatePetPosition);

    this.dockBoundsTimer = setInterval(() => {
      void this.refreshDockBounds();
    }, ROAM_INTERVAL);
  }

  handleMousePosition(mouseX: number): void {
    const target = clampToDockBounds(mouseX - WIN_SIZE / 2, this.dockBounds);

    if (this.cursorTargetX !== target) {
      this.cursorTargetX = target;
      this.targetX = target;
      this.movementSource = 'cursor';
      this.interruptAfkAnimationForMove(target);

      if (this.cursorStillTimer) clearTimeout(this.cursorStillTimer);
      this.cursorStillTimer = setTimeout(() => {
        if (this.cursorTargetX === target) {
          this.clearCursorTarget();
          this.playAfkAnimation();
        }
      }, CURSOR_STILL_DELAY);
    }
  }

  handlePetChanged(pet: Pet): void {
    setSpritesheet(this.sprite, pet.spritesheetPath);
    this.playAnimation('idle', true);
  }

  getState(): PetControllerState {
    return {
      petX: this.petX,
      petY: this.petY,
      targetX: this.targetX,
      dockBounds: this.dockBounds,
      isMoving: this.isMoving,
      canPlayAfkAnimation: this.canPlayAfkAnimation,
      movementSource: this.movementSource,
      cursorTargetX: this.cursorTargetX
    };
  }

  private readonly animate = (timestamp: number): void => {
    this.animator.tick(timestamp);
    requestAnimationFrame(this.animate);
  };

  private readonly updatePetPosition = (): void => {
    if (this.animationTimer) {
      this.api.setPosition(this.petX, this.petY);
      requestAnimationFrame(this.updatePetPosition);
      return;
    }

    if (Math.abs(this.petX - this.targetX) > MOVE_SPEED) {
      if (this.petX < this.targetX) {
        this.petX += MOVE_SPEED;
        this.playAnimation('runRight', true);
      } else {
        this.petX -= MOVE_SPEED;
        this.playAnimation('runLeft', true);
      }
      this.isMoving = true;
      this.canPlayAfkAnimation = true;
    } else if (this.isMoving) {
      this.isMoving = false;
      const completedMovementSource = this.movementSource;
      this.movementSource = null;

      if (this.cursorTargetX !== null) {
        this.clearCursorTarget();
      }

      if (!this.playAfkAnimation(completedMovementSource === 'cursor')) {
        this.playAnimation('idle', true);
      }
    }

    this.api.setPosition(this.petX, this.petY);
    requestAnimationFrame(this.updatePetPosition);
  };

  private playAfkAnimation(forceSpecial = false): boolean {
    if (
      this.isMoving ||
      !this.dockBounds ||
      this.animationTimer ||
      !this.canPlayAfkAnimation ||
      this.cursorTargetX !== null
    ) {
      return false;
    }

    const nextAnimation = this.afkAnimationPicker.pick(forceSpecial);
    this.canPlayAfkAnimation = false;
    this.afkAnimationPicker.remember(nextAnimation);

    this.playAnimation(nextAnimation, nextAnimation === 'idle');

    if (this.animationTimer) clearTimeout(this.animationTimer);
    this.animationTimer = setTimeout(() => {
      this.animationTimer = null;
      if (!this.isMoving && !this.startRoamingMove()) {
        this.playAnimation('idle', true);
      }
    }, ANIMATION_DURATION);

    return true;
  }

  private interruptAfkAnimationForMove(nextTargetX: number): void {
    if (!this.animationTimer || Math.abs(this.petX - nextTargetX) <= MOVE_SPEED) return;

    clearTimeout(this.animationTimer);
    this.animationTimer = null;
    this.isMoving = true;
    this.movementSource = 'cursor';
    this.canPlayAfkAnimation = true;
    this.playAnimation(nextTargetX < this.petX ? 'runLeft' : 'runRight', true);
  }

  private clearCursorTarget(): void {
    if (this.cursorStillTimer) {
      clearTimeout(this.cursorStillTimer);
      this.cursorStillTimer = null;
    }

    this.cursorTargetX = null;
    this.targetX = this.petX;
  }

  private startRoaming(): void {
    if (this.roamTimer) clearInterval(this.roamTimer);
    this.roamTimer = setInterval(() => {
      this.startRoamingMove();
    }, ROAM_INTERVAL);
  }

  private startRoamingMove(): boolean {
    if (!this.dockBounds || this.isMoving || this.animationTimer || this.cursorTargetX !== null) {
      return false;
    }

    const nextTarget = pickRoamingTarget(this.petX, this.dockBounds);
    if (nextTarget === null) return false;

    this.targetX = nextTarget;
    this.playAnimation(this.targetX < this.petX ? 'runLeft' : 'runRight', true);
    this.isMoving = true;
    this.movementSource = 'roam';
    this.canPlayAfkAnimation = true;

    return true;
  }

  private async refreshDockBounds(): Promise<void> {
    this.dockBounds = await this.api.getDockBounds();
  }

  private playAnimation(animation: AnimationName, loop: boolean): void {
    this.animator.play(animation, loop);
  }
}
