import { DEFAULT_FPS, FRAME_SIZE } from '../constants';

type AnimationDefinition = {
  row: number;
  frames: number;
  name: string;
};

export const ANIMATIONS = {
  idle:      { row: 0, frames: 6, name: 'idle' },
  runRight:  { row: 1, frames: 8, name: 'runRight' },
  runLeft:   { row: 2, frames: 8, name: 'runLeft' },
  waving:    { row: 3, frames: 4, name: 'waving' },
  jumping:   { row: 4, frames: 5, name: 'jumping' },
  failed:    { row: 5, frames: 8, name: 'failed' },
  waiting:   { row: 6, frames: 6, name: 'waiting' },
  running:   { row: 7, frames: 6, name: 'running' },
  review:    { row: 8, frames: 6, name: 'review' }
} as const satisfies Record<string, AnimationDefinition>;

export const AFK_SPECIAL_ANIMATIONS = ['waving', 'waiting', 'review', 'failed', 'jumping'] as const;

const IDLE_AFK_WEIGHT = 2;
const SPECIAL_AFK_WEIGHT = 3;

export type AnimationName = keyof typeof ANIMATIONS;
export type AfkSpecialAnimation = typeof AFK_SPECIAL_ANIMATIONS[number];
export type AfkAnimation = AfkSpecialAnimation | 'idle';

export function getFramePosition(animationName: AnimationName, frame: number): { x: number; y: number } {
  const animation = ANIMATIONS[animationName];
  const frameIndex = frame % animation.frames;

  return {
    x: frameIndex * FRAME_SIZE,
    y: animation.row * FRAME_SIZE
  };
}

export class SpriteAnimator {
  private currentAnimation: AnimationName = 'idle';
  private currentFrame = 0;
  private lastFrameTime = 0;

  constructor(
    private readonly sprite: HTMLElement,
    private readonly fps = DEFAULT_FPS
  ) {}

  play(animationName: AnimationName, loop = true): void {
    if (this.currentAnimation === animationName && loop) return;

    this.currentAnimation = animationName;
    this.currentFrame = 0;
    this.updateSpriteFrame();
  }

  tick(timestamp: number): void {
    if (!this.lastFrameTime) this.lastFrameTime = timestamp;

    const elapsed = timestamp - this.lastFrameTime;
    const frameInterval = 1000 / this.fps;

    if (elapsed >= frameInterval) {
      const animation = ANIMATIONS[this.currentAnimation];
      this.currentFrame = (this.currentFrame + 1) % animation.frames;
      this.updateSpriteFrame();
      this.lastFrameTime = timestamp;
    }
  }

  resetFrame(): void {
    this.currentFrame = 0;
    this.updateSpriteFrame();
  }

  private updateSpriteFrame(): void {
    const { x, y } = getFramePosition(this.currentAnimation, this.currentFrame);
    this.sprite.style.backgroundPosition = `-${x}px -${y}px`;
  }
}

export class AfkAnimationPicker {
  private lastSpecialAnimation: AfkSpecialAnimation | null = null;
  private specialQueue: AfkSpecialAnimation[] = [];

  pick(forceSpecial = false): AfkAnimation {
    if (forceSpecial) return this.pickSpecial();

    const totalWeight = IDLE_AFK_WEIGHT + SPECIAL_AFK_WEIGHT;
    const idleThreshold = IDLE_AFK_WEIGHT / totalWeight;

    if (Math.random() < idleThreshold) {
      return 'idle';
    }

    return this.pickSpecial();
  }

  remember(animation: AfkAnimation): void {
    if (animation !== 'idle') {
      this.lastSpecialAnimation = animation;
    }
  }

  private pickSpecial(): AfkSpecialAnimation {
    if (this.specialQueue.length === 0) {
      this.specialQueue = this.shuffleSpecialAnimations();
    }

    return this.specialQueue.shift() ?? 'waving';
  }

  private shuffleSpecialAnimations(): AfkSpecialAnimation[] {
    const animations = [...AFK_SPECIAL_ANIMATIONS];

    for (let index = animations.length - 1; index > 0; index--) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [animations[index], animations[randomIndex]] = [animations[randomIndex], animations[index]];
    }

    if (animations[0] === this.lastSpecialAnimation && animations.length > 1) {
      [animations[0], animations[1]] = [animations[1], animations[0]];
    }

    return animations;
  }
}
