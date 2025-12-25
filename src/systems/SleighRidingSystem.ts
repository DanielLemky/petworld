import Phaser from 'phaser';
import { TILE_SIZE, SLEIGH_RIDE_SPEED, SLEIGH_GALLOP_MULTIPLIER, REQUIRED_REINDEER_FOR_SLEIGH, isChristmasSeason } from '../utils/constants';
import { PLAYER_CONFIG } from './PlayerConfig';
import { PetManager } from './PetManager';

// Sleigh riding configuration - direction-specific scales
const SLEIGH_SCALES = {
  UP: 0.08,      // Smaller for up
  DOWN: 0.125,   // Original 2.5x
  LEFT: 0.2,    // Bigger for left/right
  RIGHT: 0.2,   // Bigger for left/right
};

// Collision body configuration for sleigh - very small so it can "fly" around easily
const SLEIGH_BODY_WIDTH = 32;
const SLEIGH_BODY_HEIGHT = 32;
const SLEIGH_BODY_OFFSET_X = 750;
const SLEIGH_BODY_OFFSET_Y = 1400;

// Sprite keys for sleigh riding (4 directions)
const SLEIGH_SPRITES = {
  UP: 'santa_sleigh_up',
  DOWN: 'santa_sleigh_down',
  LEFT: 'santa_sleigh_left',
  RIGHT: 'santa_sleigh_right',
};

interface DismountedSleigh {
  sceneKey: string;
  position: { x: number; y: number };
}

export class SleighRidingSystem {
  private scene: Phaser.Scene;
  private player: Phaser.Physics.Arcade.Sprite | null = null;
  private isRiding: boolean = false;
  private currentDirection: string = 'down';

  // Track dismounted sleigh across scenes (static to persist between scene instances)
  private static dismountedSleigh: DismountedSleigh | null = null;

  // Track riding state across scenes (static to persist between scene instances)
  private static currentlyRidingSleigh: boolean = false;

  // Local sprite reference for dismounted sleigh in current scene
  private dismountedSleighSprite: Phaser.GameObjects.Sprite | null = null;

  // Store original collision body values for restoration when dismounting
  private originalBodySize: { width: number; height: number } | null = null;
  private originalBodyOffset: { x: number; y: number } | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  // Initialize with player reference
  init(player: Phaser.Physics.Arcade.Sprite): void {
    this.player = player;

    // Store original collision body values
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    if (body) {
      this.originalBodySize = { width: body.width, height: body.height };
      this.originalBodyOffset = { x: body.offset.x, y: body.offset.y };
    }

    // Restore riding state if player was riding when transitioning scenes
    if (SleighRidingSystem.currentlyRidingSleigh) {
      this.isRiding = true;
      this.updateRidingSprite(this.currentDirection); // This sets texture and scale

      // Apply riding collision body
      this.player.setSize(SLEIGH_BODY_WIDTH, SLEIGH_BODY_HEIGHT);
      this.player.setOffset(SLEIGH_BODY_OFFSET_X, SLEIGH_BODY_OFFSET_Y);
    }

    // Check for dismounted sleigh in this scene
    this.restoreDismountedSleigh();
  }

  // Check if player can mount the sleigh
  canMount(): { canMount: boolean; reason?: string } {
    if (this.isRiding) {
      return { canMount: false, reason: 'Already riding' };
    }

    if (!isChristmasSeason()) {
      return { canMount: false, reason: "Santa's sleigh only works during Christmas!" };
    }

    const reindeerCount = PetManager.getReindeerCount();
    if (reindeerCount < REQUIRED_REINDEER_FOR_SLEIGH) {
      return { canMount: false, reason: `Need ${REQUIRED_REINDEER_FOR_SLEIGH} reindeer to ride! (Have ${reindeerCount})` };
    }

    return { canMount: true };
  }

  // Mount the sleigh
  mount(sleighSprite?: Phaser.GameObjects.Sprite): boolean {
    if (!this.player) return false;

    const check = this.canMount();
    if (!check.canMount) return false;

    this.isRiding = true;

    // Update static state for scene transition persistence
    SleighRidingSystem.currentlyRidingSleigh = true;

    // Hide the sleigh sprite if one was provided
    if (sleighSprite) {
      sleighSprite.setVisible(false);
      sleighSprite.setActive(false);
    }

    // Hide dismounted sleigh if it exists
    if (this.dismountedSleighSprite) {
      this.dismountedSleighSprite.setVisible(false);
      this.dismountedSleighSprite.setActive(false);
    }

    // Clear dismounted sleigh data
    SleighRidingSystem.dismountedSleigh = null;

    // Switch player to sleigh sprite (this sets texture and scale)
    this.updateRidingSprite(this.currentDirection);

    // Apply sleigh collision body
    this.player.setSize(SLEIGH_BODY_WIDTH, SLEIGH_BODY_HEIGHT);
    this.player.setOffset(SLEIGH_BODY_OFFSET_X, SLEIGH_BODY_OFFSET_Y);

    return true;
  }

  // Dismount the sleigh
  dismount(): Phaser.GameObjects.Sprite | null {
    if (!this.player || !this.isRiding) return null;

    const dismountX = this.player.x;
    const dismountY = this.player.y + 20;

    // Create dismounted sleigh sprite at player position
    const sleighSprite = this.createDismountedSleighSprite(dismountX, dismountY);

    // Store dismounted sleigh location
    const sceneKey = this.scene.scene.key;
    SleighRidingSystem.dismountedSleigh = {
      sceneKey: sceneKey,
      position: { x: dismountX, y: dismountY },
    };

    this.dismountedSleighSprite = sleighSprite;

    // Reset riding state
    this.isRiding = false;

    // Clear static state
    SleighRidingSystem.currentlyRidingSleigh = false;

    // Restore player normal sprite and scale
    this.restorePlayerSprite();

    return sleighSprite;
  }

  // Create a sleigh sprite for dismounted state
  private createDismountedSleighSprite(x: number, y: number): Phaser.GameObjects.Sprite {
    const sprite = this.scene.add.sprite(x, y, 'santa_in_sleigh');
    sprite.setScale(0.08); // Scale for static sleigh
    sprite.setDepth(y + TILE_SIZE / 2);
    sprite.setData('isDismountedSleigh', true);
    return sprite;
  }

  // Restore dismounted sleigh if one exists in this scene
  private restoreDismountedSleigh(): void {
    const sceneKey = this.scene.scene.key;

    if (SleighRidingSystem.dismountedSleigh && SleighRidingSystem.dismountedSleigh.sceneKey === sceneKey) {
      // Create sprite at saved position
      this.dismountedSleighSprite = this.createDismountedSleighSprite(
        SleighRidingSystem.dismountedSleigh.position.x,
        SleighRidingSystem.dismountedSleigh.position.y
      );
    }
  }

  // Update riding sprite based on direction
  private updateRidingSprite(direction: string): void {
    if (!this.player || !this.isRiding) return;

    let textureKey: string;
    let scale: number;
    switch (direction) {
      case 'up':
        textureKey = SLEIGH_SPRITES.UP;
        scale = SLEIGH_SCALES.UP;
        break;
      case 'down':
        textureKey = SLEIGH_SPRITES.DOWN;
        scale = SLEIGH_SCALES.DOWN;
        break;
      case 'left':
        textureKey = SLEIGH_SPRITES.LEFT;
        scale = SLEIGH_SCALES.LEFT;
        break;
      case 'right':
        textureKey = SLEIGH_SPRITES.RIGHT;
        scale = SLEIGH_SCALES.RIGHT;
        break;
      default:
        textureKey = SLEIGH_SPRITES.DOWN;
        scale = SLEIGH_SCALES.DOWN;
    }

    this.player.setTexture(textureKey);
    this.player.setScale(scale);
    this.currentDirection = direction;
  }

  // Restore player to normal walking state
  private restorePlayerSprite(): void {
    if (!this.player) return;

    this.player.setTexture(`player_${this.currentDirection}`);
    this.player.setScale(PLAYER_CONFIG.NORMAL_SCALE);

    // Restore original collision body
    if (this.originalBodySize && this.originalBodyOffset) {
      this.player.setSize(this.originalBodySize.width, this.originalBodySize.height);
      this.player.setOffset(this.originalBodyOffset.x, this.originalBodyOffset.y);
    }
  }

  // Update method called each frame - handles direction changes while riding
  update(): void {
    if (!this.player) return;

    // Update riding direction based on velocity
    if (this.isRiding) {
      const vx = this.player.body?.velocity.x || 0;
      const vy = this.player.body?.velocity.y || 0;

      let newDirection = this.currentDirection;
      if (Math.abs(vx) > Math.abs(vy) && Math.abs(vx) > 10) {
        newDirection = vx < 0 ? 'left' : 'right';
      } else if (Math.abs(vy) > 10) {
        newDirection = vy < 0 ? 'up' : 'down';
      }

      if (newDirection !== this.currentDirection) {
        this.updateRidingSprite(newDirection);
      }
    }
  }

  // Get current riding speed based on galloping state
  getRidingSpeed(isGalloping: boolean): number {
    if (!this.isRiding) return 0;

    return isGalloping ? SLEIGH_RIDE_SPEED * SLEIGH_GALLOP_MULTIPLIER : SLEIGH_RIDE_SPEED;
  }

  // Getters
  getIsRiding(): boolean {
    return this.isRiding;
  }

  getDismountedSleighSprite(): Phaser.GameObjects.Sprite | null {
    return this.dismountedSleighSprite;
  }

  getCurrentDirection(): string {
    return this.currentDirection;
  }

  // Set current direction (called by scene when needed)
  setCurrentDirection(direction: string): void {
    this.currentDirection = direction;
    if (this.isRiding && this.player) {
      this.updateRidingSprite(direction);
    }
  }

  // Called when leaving a scene - sleigh returns to home
  onSceneExit(): void {
    if (this.dismountedSleighSprite && !this.isRiding) {
      // Remove from scene tracking - sleigh returns to home
      SleighRidingSystem.dismountedSleigh = null;

      // Destroy the sprite
      this.dismountedSleighSprite.destroy();
      this.dismountedSleighSprite = null;
    }
  }

  // Clean up
  destroy(): void {
    if (this.dismountedSleighSprite) {
      this.dismountedSleighSprite.destroy();
      this.dismountedSleighSprite = null;
    }
    this.player = null;
    this.isRiding = false;
  }

  // Static method to check if currently riding sleigh (for scene integration)
  static isCurrentlyRiding(): boolean {
    return SleighRidingSystem.currentlyRidingSleigh;
  }

  // Static method to check if there's a dismounted sleigh in a specific scene
  static hasDismountedSleighInScene(sceneKey: string): boolean {
    return SleighRidingSystem.dismountedSleigh?.sceneKey === sceneKey;
  }

  // Static method to clear dismounted sleigh (for reset)
  static clearDismountedSleigh(): void {
    SleighRidingSystem.dismountedSleigh = null;
  }
}
