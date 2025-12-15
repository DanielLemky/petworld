import Phaser from 'phaser';
import { PLAYER_CONFIG } from './PlayerConfig';

/**
 * PlayerAnimator - Handles all player animations in a unified way
 * 
 * Usage:
 * - Create instance in scene: this.playerAnimator = new PlayerAnimator(this, this.player);
 * - Update each frame: this.playerAnimator.updateAnimation(isMoving, directionX);
 * - Cleanup automatically handled when scene is destroyed
 */
export class PlayerAnimator {
  private scene: Phaser.Scene;
  private player: Phaser.Physics.Arcade.Sprite;
  private walkTween: Phaser.Tweens.Tween | null = null;
  private isWalking: boolean = false;

  constructor(scene: Phaser.Scene, player: Phaser.Physics.Arcade.Sprite) {
    this.scene = scene;
    this.player = player;
    
    // Set initial scale and direction
    this.player.setScale(PLAYER_CONFIG.NORMAL_SCALE);
    this.player.setData('currentDirection', 'down');
    
    // Ensure player starts in idle state
    this.player.anims.play(PLAYER_CONFIG.ANIM_IDLE);
  }

  /**
   * Update animation state based on movement and direction
   * Call this once per frame in scene's update() method
   */
  updateAnimation(isMoving: boolean, directionX: number, isRunning: boolean = false): void {
    // Handle walking/running animation
    if (isMoving && isRunning && !this.isWalking) {
      this.startRunningAnimation();
      this.player.anims.play(PLAYER_CONFIG.ANIM_WALK);
    } else if (isMoving && !isRunning && !this.isWalking) {
      this.startWalkingAnimation();
      this.player.anims.play(PLAYER_CONFIG.ANIM_WALK);
    } else if (!isMoving && this.isWalking) {
      this.stopWalkingAnimation();
      this.player.anims.play(PLAYER_CONFIG.ANIM_IDLE);
    }

    // Handle directional sprite changes (horizontal priority)
    this.updatePlayerTexture(directionX);
  }

  /**
   * Update player sprite based on movement direction
   * Uses 4 separate directional sprites with horizontal priority
   */
  private updatePlayerTexture(directionX: number): void {
    const currentDirection = this.player.getData('currentDirection') as string || 'down';
    let newDirection = currentDirection;

    // Direction priority: horizontal over vertical
    if (Math.abs(directionX) > 0.1) {
      newDirection = directionX < 0 ? 'left' : 'right';
    } else {
      // No significant horizontal movement, check vertical from scene
      const velocityY = this.player.body?.velocity.y || 0;
      if (Math.abs(velocityY) > 0.1) {
        newDirection = velocityY < 0 ? 'up' : 'down';
      }
    }

    // Update texture if direction changed
    if (newDirection !== currentDirection) {
      this.player.setTexture(`player_${newDirection}`);
      this.player.setData('currentDirection', newDirection);
    }
  }

  /**
   * Start walking squash/stretch animation
   */
  private startWalkingAnimation(): void {
    this.isWalking = true;

    // Stop any existing walk tween
    if (this.walkTween) {
      this.walkTween.stop();
    }

    // Create squash/stretch animation using Option 2 (10% variation)
    this.walkTween = this.scene.tweens.add({
      targets: this.player,
      scaleY: {
        from: PLAYER_CONFIG.WALK_SCALE_Y_MAX,
        to: PLAYER_CONFIG.WALK_SCALE_Y_MIN
      },
      scaleX: {
        from: PLAYER_CONFIG.WALK_SCALE_X_MIN,
        to: PLAYER_CONFIG.WALK_SCALE_X_MAX
      },
      duration: PLAYER_CONFIG.WALK_ANIMATION_DURATION,
      yoyo: true,
      repeat: -1,
      ease: PLAYER_CONFIG.WALK_ANIMATION_EASE,
    });
  }

  /**
   * Start running animation (identical to walking)
   */
  private startRunningAnimation(): void {
    // Use same animation as walking for consistency
    this.startWalkingAnimation();
  }

  /**
   * Stop walking animation and reset scale
   */
  private stopWalkingAnimation(): void {
    this.isWalking = false;
    
    if (this.walkTween) {
      this.walkTween.stop();
      this.walkTween = null;
    }
    
    // Reset to normal scale
    this.player.setScale(PLAYER_CONFIG.NORMAL_SCALE);
  }

  /**
   * Force stop all animations (useful for scene transitions)
   */
  forceStop(): void {
    this.stopWalkingAnimation();
    this.player.anims.play(PLAYER_CONFIG.ANIM_IDLE);
  }

  /**
   * Get current walking state
   */
  getIsWalking(): boolean {
    return this.isWalking;
  }

  /**
   * Cleanup method - call when scene is destroyed
   */
  cleanup(): void {
    if (this.walkTween) {
      this.walkTween.stop();
      this.walkTween = null;
    }
    this.isWalking = false;
  }
}