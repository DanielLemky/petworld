import Phaser from 'phaser';
import { PetManager } from './PetManager';
import { TILE_SIZE } from '../utils/constants';
import type { FetchSystem } from './FetchSystem';

// Companion follows player with smooth movement
const FOLLOW_DISTANCE = TILE_SIZE * 1.2;
const FOLLOW_SPEED = 70;
const CLOSE_ENOUGH = TILE_SIZE * 0.6;

export class CompanionSystem {
  private scene: Phaser.Scene;
  private sprite: Phaser.Physics.Arcade.Sprite | null = null;
  private player: Phaser.Physics.Arcade.Sprite | null = null;
  private positionHistory: { x: number; y: number }[] = [];
  private historyDelay = 5; // frames of delay for following
  private fetchSystem: FetchSystem | null = null;
  private isPuppy: boolean = false;
  private facingRight: boolean = true;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  // Set fetch system reference for coordination
  setFetchSystem(fetchSystem: FetchSystem): void {
    this.fetchSystem = fetchSystem;
  }

  // Initialize companion if one is set
  init(player: Phaser.Physics.Arcade.Sprite): void {
    this.player = player;
    this.positionHistory = [];

    const companion = PetManager.getCompanion();
    if (!companion) return;

    const petType = companion.type.toLowerCase();
    this.isPuppy = companion.type === 'PUPPY';

    // Create the companion sprite
    if (this.isPuppy) {
      // Use loaded puppy sprite with scaling
      this.sprite = this.scene.physics.add.sprite(
        player.x - FOLLOW_DISTANCE,
        player.y,
        'puppy_right'
      );
      // Scale down the high-res sprite
      this.sprite.setScale(0.012);
      // Adjust collision box for scaled sprite
      this.sprite.setSize(400, 200);
      this.sprite.setOffset(200, 500);
    } else {
      // Use programmatic pet sprite for other pets
      // Butterflies use different sprite naming (no "pet_" prefix)
      const spriteKey = petType.startsWith('butterfly_')
        ? petType
        : `pet_${petType}`;

      this.sprite = this.scene.physics.add.sprite(
        player.x - FOLLOW_DISTANCE,
        player.y,
        spriteKey
      );
      // Collision box for programmatic sprites
      this.sprite.setSize(14, 12);
      this.sprite.setOffset(1, TILE_SIZE - 14);
    }

    this.sprite.setCollideWorldBounds(true);
    this.sprite.setDepth(player.y);
    this.sprite.setData('petType', petType);
    this.sprite.setData('companionId', companion.id);

    // Initialize position history with current position
    for (let i = 0; i < this.historyDelay; i++) {
      this.positionHistory.push({ x: player.x - FOLLOW_DISTANCE, y: player.y });
    }
  }

  // Update companion position to follow player
  update(): void {
    if (!this.sprite || !this.player) return;

    // Skip normal following if fetch system is controlling the companion
    if (this.fetchSystem?.isControllingCompanion()) {
      // Update depth for proper z-ordering even during fetch
      this.sprite.setDepth(this.sprite.y + TILE_SIZE / 2);
      return;
    }

    // Calculate target position beside the player (not behind)
    // Stay on whichever side the puppy is currently on
    const offsetX = this.sprite.x < this.player.x ? -FOLLOW_DISTANCE : FOLLOW_DISTANCE;
    const targetX = this.player.x + offsetX;
    const targetY = this.player.y;

    const dx = targetX - this.sprite.x;
    const dy = targetY - this.sprite.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > CLOSE_ENOUGH) {
      // Move toward target
      const angle = Math.atan2(dy, dx);
      const speed = Math.min(FOLLOW_SPEED, distance * 3);

      this.sprite.setVelocity(
        Math.cos(angle) * speed,
        Math.sin(angle) * speed
      );

      // Update sprite direction - face toward the player
      if (this.sprite.x < this.player.x && !this.facingRight) {
        this.facingRight = true;
        if (this.isPuppy) {
          this.sprite.setTexture('puppy_right');
        } else {
          this.sprite.setFlipX(false);
        }
      } else if (this.sprite.x > this.player.x && this.facingRight) {
        this.facingRight = false;
        if (this.isPuppy) {
          this.sprite.setTexture('puppy_left');
        } else {
          this.sprite.setFlipX(true);
        }
      }
    } else {
      // Close enough, stop moving
      this.sprite.setVelocity(0, 0);
    }

    // Update depth for proper z-ordering
    this.sprite.setDepth(this.sprite.y + TILE_SIZE / 2);
  }

  // Get the sprite for collision setup
  getSprite(): Phaser.Physics.Arcade.Sprite | null {
    return this.sprite;
  }

  // Check if companion exists
  hasCompanion(): boolean {
    return this.sprite !== null;
  }

  // Check if companion is a puppy (for sprite switching)
  getIsPuppy(): boolean {
    return this.isPuppy;
  }

  // Get current facing direction
  isFacingRight(): boolean {
    return this.facingRight;
  }

  // Set facing direction (called by FetchSystem)
  setFacingRight(right: boolean): void {
    if (this.facingRight === right) return;
    this.facingRight = right;
    if (this.isPuppy && this.sprite) {
      this.sprite.setTexture(right ? 'puppy_right' : 'puppy_left');
    }
  }

  // Clean up
  destroy(): void {
    if (this.sprite) {
      this.scene.tweens.killTweensOf(this.sprite);
      this.sprite.destroy();
      this.sprite = null;
    }
    this.positionHistory = [];
  }

  // Add collision with a group (like trees)
  addCollider(group: Phaser.Physics.Arcade.StaticGroup | Phaser.Physics.Arcade.Group): void {
    if (this.sprite) {
      this.scene.physics.add.collider(this.sprite, group);
    }
  }
}
