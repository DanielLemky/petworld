import Phaser from 'phaser';
import { PetManager } from './PetManager';
import { TILE_SIZE } from '../utils/constants';

// Companion follows player with smooth movement
const FOLLOW_DISTANCE = TILE_SIZE * 1.5;
const FOLLOW_SPEED = 80;
const CLOSE_ENOUGH = TILE_SIZE * 0.5;

export class CompanionSystem {
  private scene: Phaser.Scene;
  private sprite: Phaser.Physics.Arcade.Sprite | null = null;
  private player: Phaser.Physics.Arcade.Sprite | null = null;
  private positionHistory: { x: number; y: number }[] = [];
  private historyDelay = 15; // frames of delay for following

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  // Initialize companion if one is set
  init(player: Phaser.Physics.Arcade.Sprite): void {
    this.player = player;
    this.positionHistory = [];

    const companion = PetManager.getCompanion();
    if (!companion) return;

    // Create the companion sprite
    const petType = companion.type.toLowerCase();
    this.sprite = this.scene.physics.add.sprite(
      player.x - FOLLOW_DISTANCE,
      player.y,
      `pet_${petType}`
    );

    this.sprite.setCollideWorldBounds(true);
    this.sprite.setDepth(player.y);
    this.sprite.setData('petType', petType);
    this.sprite.setData('companionId', companion.id);

    // Smaller collision box
    this.sprite.setSize(10, 6);
    this.sprite.setOffset(3, TILE_SIZE - 8);

    // Initialize position history with current position
    for (let i = 0; i < this.historyDelay; i++) {
      this.positionHistory.push({ x: player.x - FOLLOW_DISTANCE, y: player.y });
    }
  }

  // Update companion position to follow player
  update(): void {
    if (!this.sprite || !this.player) return;

    // Add current player position to history
    this.positionHistory.push({ x: this.player.x, y: this.player.y });

    // Remove old positions, keeping only historyDelay frames
    while (this.positionHistory.length > this.historyDelay) {
      this.positionHistory.shift();
    }

    // Target the delayed position
    const targetPos = this.positionHistory[0];
    if (!targetPos) return;

    const dx = targetPos.x - this.sprite.x;
    const dy = targetPos.y - this.sprite.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > CLOSE_ENOUGH) {
      // Move toward target
      const angle = Math.atan2(dy, dx);
      const speed = Math.min(FOLLOW_SPEED, distance * 2);

      this.sprite.setVelocity(
        Math.cos(angle) * speed,
        Math.sin(angle) * speed
      );

      // Flip sprite based on movement direction
      if (dx > 1) {
        this.sprite.setFlipX(false);
      } else if (dx < -1) {
        this.sprite.setFlipX(true);
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
