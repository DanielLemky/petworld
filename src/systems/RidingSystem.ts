import Phaser from 'phaser';
import type { CaughtPet } from './PetManager';
import { getSpriteKey, applyPetSpriteConfig } from './PetSpriteConfig';
import { TILE_SIZE, HORSE_RIDE_SPEED, HORSE_GALLOP_MULTIPLIER } from '../utils/constants';
import { PLAYER_CONFIG } from './PlayerConfig';

// Riding configuration
const RIDING_CONFIG = {
  // Player scale when riding - larger than normal to compensate for smaller sprite dimensions
  // Riding sprites are ~693x1790 vs regular player ~1568x2720, so scale up ~2.2x
  RIDING_SCALE: 0.05,

  // Collision body for riding sprite (693x1790)
  // Positioned at horse's feet, similar scaled size to normal player collision
  RIDING_BODY_WIDTH: 360,     // ~18px scaled at 0.05
  RIDING_BODY_HEIGHT: 180,    // ~9px scaled at 0.05
  RIDING_BODY_OFFSET_X: 165,  // Center horizontally (693-360)/2
  RIDING_BODY_OFFSET_Y: 1600, // Near bottom of sprite (horse's feet)

  // Dismounted horse behavior
  HORSE_IDLE_WANDER_SPEED: 10,
};

// Sprite keys for riding
const RIDING_SPRITES = {
  UP: 'player_riding_horse_up',
  DOWN: 'player_riding_horse_down',
  LEFT: 'player_riding_horse_left',
  RIGHT: 'player_riding_horse_right',
};

interface DismountedHorse {
  petId: string;
  sceneKey: string;
  position: { x: number; y: number };
}

export class RidingSystem {
  private scene: Phaser.Scene;
  private player: Phaser.Physics.Arcade.Sprite | null = null;
  private isRiding: boolean = false;
  private mountedHorseId: string | null = null;
  private currentDirection: string = 'down';

  // Track dismounted horses across scenes (static to persist between scene instances)
  private static dismountedHorses: Map<string, DismountedHorse> = new Map();

  // Track riding state across scenes (static to persist between scene instances)
  private static currentlyRiding: boolean = false;
  private static currentlyRidingHorseId: string | null = null;

  // Local sprite reference for dismounted horse in current scene
  private dismountedHorseSprite: Phaser.Physics.Arcade.Sprite | null = null;

  // Store original collision body values for restoration when dismounting
  private originalBodySize: { width: number; height: number } | null = null;
  private originalBodyOffset: { x: number; y: number } | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  // Initialize with player reference
  init(player: Phaser.Physics.Arcade.Sprite): void {
    this.player = player;

    // Store original collision body values (before any modifications)
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    if (body) {
      // Store in sprite coordinate space (unscaled)
      this.originalBodySize = { width: body.width / this.player.scaleX, height: body.height / this.player.scaleY };
      this.originalBodyOffset = { x: body.offset.x / this.player.scaleX, y: body.offset.y / this.player.scaleY };
    }

    // Restore riding state if player was riding when transitioning scenes
    if (RidingSystem.currentlyRiding && RidingSystem.currentlyRidingHorseId) {
      this.isRiding = true;
      this.mountedHorseId = RidingSystem.currentlyRidingHorseId;
      this.updateRidingSprite(this.currentDirection);
      this.player.setScale(RIDING_CONFIG.RIDING_SCALE);

      // Apply riding collision body
      this.player.setSize(RIDING_CONFIG.RIDING_BODY_WIDTH, RIDING_CONFIG.RIDING_BODY_HEIGHT);
      this.player.setOffset(RIDING_CONFIG.RIDING_BODY_OFFSET_X, RIDING_CONFIG.RIDING_BODY_OFFSET_Y);
    }

    // Check for dismounted horse in this scene
    this.restoreDismountedHorse();
  }

  // Check if a horse sprite can be mounted
  canMount(horseSprite: Phaser.Physics.Arcade.Sprite): boolean {
    if (this.isRiding) return false;

    const petData = horseSprite.getData('petData') as CaughtPet | undefined;
    const isDismounted = horseSprite.getData('isDismountedHorse') as boolean;

    // Can mount if it's a captured horse (has petData with type HORSE) or a dismounted horse
    if (petData && petData.type === 'HORSE') {
      return true;
    }

    if (isDismounted) {
      return true;
    }

    return false;
  }

  // Mount a horse
  mount(horseSprite: Phaser.Physics.Arcade.Sprite): boolean {
    if (!this.player || !this.canMount(horseSprite)) return false;

    const petData = horseSprite.getData('petData') as CaughtPet | undefined;
    const petId = petData?.id || horseSprite.getData('petId') as string;

    if (!petId) return false;

    this.isRiding = true;
    this.mountedHorseId = petId;

    // Update static state for scene transition persistence
    RidingSystem.currentlyRiding = true;
    RidingSystem.currentlyRidingHorseId = petId;

    // Hide the horse sprite
    horseSprite.setVisible(false);
    horseSprite.setActive(false);
    if (horseSprite.body) {
      (horseSprite.body as Phaser.Physics.Arcade.Body).enable = false;
    }

    // Switch player to riding sprite
    this.updateRidingSprite(this.currentDirection);
    this.player.setScale(RIDING_CONFIG.RIDING_SCALE);

    // Apply riding collision body
    this.player.setSize(RIDING_CONFIG.RIDING_BODY_WIDTH, RIDING_CONFIG.RIDING_BODY_HEIGHT);
    this.player.setOffset(RIDING_CONFIG.RIDING_BODY_OFFSET_X, RIDING_CONFIG.RIDING_BODY_OFFSET_Y);

    // Remove from dismounted horses if it was there
    RidingSystem.dismountedHorses.delete(petId);

    return true;
  }

  // Dismount the horse
  dismount(): Phaser.Physics.Arcade.Sprite | null {
    if (!this.player || !this.isRiding || !this.mountedHorseId) return null;

    const dismountX = this.player.x;
    const dismountY = this.player.y + 20; // Slightly below player

    // Create dismounted horse sprite at player position
    const horseSprite = this.createDismountedHorseSprite(dismountX, dismountY);

    // Store dismounted horse location
    const sceneKey = this.scene.scene.key;
    RidingSystem.dismountedHorses.set(this.mountedHorseId, {
      petId: this.mountedHorseId,
      sceneKey: sceneKey,
      position: { x: dismountX, y: dismountY },
    });

    this.dismountedHorseSprite = horseSprite;

    // Reset riding state
    this.isRiding = false;
    this.mountedHorseId = null;

    // Clear static state
    RidingSystem.currentlyRiding = false;
    RidingSystem.currentlyRidingHorseId = null;

    // Restore player normal sprite and scale
    this.restorePlayerSprite();

    return horseSprite;
  }

  // Create a horse sprite for dismounted state
  private createDismountedHorseSprite(x: number, y: number): Phaser.Physics.Arcade.Sprite {
    const spriteKey = getSpriteKey('horse', true);
    const sprite = this.scene.physics.add.sprite(x, y, spriteKey);

    applyPetSpriteConfig(sprite, 'horse');
    sprite.setData('petId', this.mountedHorseId);
    sprite.setData('isDismountedHorse', true);
    sprite.setData('wanderTimer', 0);
    sprite.setData('wanderDirection', { x: 0, y: 0 });
    sprite.setCollideWorldBounds(true);
    sprite.setDepth(y + TILE_SIZE / 2);

    return sprite;
  }

  // Restore dismounted horse if one exists in this scene
  private restoreDismountedHorse(): void {
    const sceneKey = this.scene.scene.key;

    for (const [petId, horse] of RidingSystem.dismountedHorses) {
      if (horse.sceneKey === sceneKey) {
        // Create sprite at saved position
        this.dismountedHorseSprite = this.createDismountedHorseSprite(
          horse.position.x,
          horse.position.y
        );
        this.dismountedHorseSprite.setData('petId', petId);
      }
    }
  }

  // Update riding sprite based on direction
  private updateRidingSprite(direction: string): void {
    if (!this.player || !this.isRiding) return;

    let textureKey: string;
    switch (direction) {
      case 'up': textureKey = RIDING_SPRITES.UP; break;
      case 'down': textureKey = RIDING_SPRITES.DOWN; break;
      case 'left': textureKey = RIDING_SPRITES.LEFT; break;
      case 'right': textureKey = RIDING_SPRITES.RIGHT; break;
      default: textureKey = RIDING_SPRITES.DOWN;
    }

    this.player.setTexture(textureKey);
    this.currentDirection = direction;
  }

  // Restore player to walking sprite
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

    // Update dismounted horse wandering behavior
    if (this.dismountedHorseSprite && this.dismountedHorseSprite.active) {
      this.updateDismountedHorseBehavior();
    }
  }

  // Gentle wandering for dismounted horse
  private updateDismountedHorseBehavior(): void {
    if (!this.dismountedHorseSprite) return;

    const sprite = this.dismountedHorseSprite;
    let timer = sprite.getData('wanderTimer') as number;
    timer -= this.scene.game.loop.delta;

    if (timer <= 0) {
      // Mostly stand still, occasionally move slowly
      const directions = [
        { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 },  // 80% idle
        { x: 1, y: 0 }, { x: -1, y: 0 },
      ];
      const dir = directions[Math.floor(Math.random() * directions.length)];
      sprite.setData('wanderDirection', dir);
      sprite.setData('wanderTimer', 3000 + Math.random() * 5000);
    } else {
      sprite.setData('wanderTimer', timer);
    }

    const dir = sprite.getData('wanderDirection') as { x: number; y: number };
    sprite.setVelocity(
      dir.x * RIDING_CONFIG.HORSE_IDLE_WANDER_SPEED,
      dir.y * RIDING_CONFIG.HORSE_IDLE_WANDER_SPEED
    );

    // Update sprite direction based on movement
    if (dir.x !== 0) {
      sprite.setFlipX(dir.x < 0);
    }

    // Update depth
    sprite.setDepth(sprite.y + TILE_SIZE / 2);
  }

  // Get current riding speed based on galloping state
  getRidingSpeed(isGalloping: boolean): number {
    if (!this.isRiding) return 0;

    return isGalloping ? HORSE_RIDE_SPEED * HORSE_GALLOP_MULTIPLIER : HORSE_RIDE_SPEED;
  }

  // Getters
  getIsRiding(): boolean {
    return this.isRiding;
  }

  getMountedHorseId(): string | null {
    return this.mountedHorseId;
  }

  getDismountedHorseSprite(): Phaser.Physics.Arcade.Sprite | null {
    return this.dismountedHorseSprite;
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

  // Called when leaving a scene - return horse to home if dismounted
  onSceneExit(): void {
    if (this.dismountedHorseSprite && !this.isRiding) {
      const petId = this.dismountedHorseSprite.getData('petId') as string;

      // Remove from scene tracking - horse returns to home
      RidingSystem.dismountedHorses.delete(petId);

      // Destroy the sprite
      this.dismountedHorseSprite.destroy();
      this.dismountedHorseSprite = null;
    }
  }

  // Add colliders to dismounted horse
  addCollider(group: Phaser.Physics.Arcade.StaticGroup | Phaser.Physics.Arcade.Group): void {
    if (this.dismountedHorseSprite) {
      this.scene.physics.add.collider(this.dismountedHorseSprite, group);
    }
  }

  // Clean up
  destroy(): void {
    if (this.dismountedHorseSprite) {
      this.dismountedHorseSprite.destroy();
      this.dismountedHorseSprite = null;
    }
    this.player = null;
    this.isRiding = false;
    this.mountedHorseId = null;
  }

  // Static method to clear all dismounted horses (for testing/reset)
  static clearAllDismountedHorses(): void {
    RidingSystem.dismountedHorses.clear();
  }

  // Check if there's a dismounted horse in a specific scene
  static hasDismountedHorseInScene(sceneKey: string): boolean {
    for (const horse of RidingSystem.dismountedHorses.values()) {
      if (horse.sceneKey === sceneKey) {
        return true;
      }
    }
    return false;
  }
}
