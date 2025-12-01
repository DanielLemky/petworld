import Phaser from 'phaser';
import { PetManager } from './PetManager';
import { SoundManager } from './SoundManager';
import { TILE_SIZE } from '../utils/constants';

type FetchState = 'idle' | 'thrown' | 'chasing' | 'returning';

const BALL_SPEED = 300;
const BALL_FRICTION = 0.985;
const CHASE_SPEED = 130;
const CATCH_DISTANCE = TILE_SIZE * 0.8;
const RETURN_DISTANCE = TILE_SIZE * 1.5;

export class FetchSystem {
  private scene: Phaser.Scene;
  private ball: Phaser.Physics.Arcade.Sprite | null = null;
  private state: FetchState = 'idle';
  private player: Phaser.Physics.Arcade.Sprite;
  private companionSprite: Phaser.Physics.Arcade.Sprite | null = null;
  private ballVelocity = { x: 0, y: 0 };
  private facingRight: boolean = true;

  constructor(scene: Phaser.Scene, player: Phaser.Physics.Arcade.Sprite) {
    this.scene = scene;
    this.player = player;
  }

  // Set the companion sprite reference
  setCompanion(sprite: Phaser.Physics.Arcade.Sprite | null): void {
    this.companionSprite = sprite;
  }

  // Check if we can play fetch (companion is a puppy)
  canPlay(): boolean {
    if (this.state !== 'idle') return false;

    const companion = PetManager.getCompanion();
    if (!companion) return false;

    // Only puppies can play fetch
    return companion.type === 'PUPPY';
  }

  // Check if fetch is currently in progress
  isPlaying(): boolean {
    return this.state !== 'idle';
  }

  // Throw the ball toward target position
  throwBall(targetX: number, targetY: number): void {
    if (!this.canPlay()) return;

    // Create ball at player position
    this.ball = this.scene.physics.add.sprite(
      this.player.x,
      this.player.y,
      'ball'
    );
    this.ball.setDepth(1000);
    this.ball.setCollideWorldBounds(true);

    // Calculate direction and velocity
    const dx = targetX - this.player.x;
    const dy = targetY - this.player.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Normalize and apply speed (cap the throw distance)
    const maxDistance = TILE_SIZE * 10;
    const throwPower = Math.min(distance, maxDistance) / maxDistance;

    this.ballVelocity = {
      x: (dx / distance) * BALL_SPEED * throwPower,
      y: (dy / distance) * BALL_SPEED * throwPower,
    };

    this.ball.setVelocity(this.ballVelocity.x, this.ballVelocity.y);
    this.state = 'thrown';

    // Play throw sound
    SoundManager.playClick();

    // Start chasing after a short delay (let ball get ahead)
    this.scene.time.delayedCall(300, () => {
      if (this.state === 'thrown') {
        this.state = 'chasing';
      }
    });
  }

  // Update fetch mechanics
  update(): void {
    if (this.state === 'idle' || !this.ball || !this.companionSprite) return;

    switch (this.state) {
      case 'thrown':
        this.updateThrownBall();
        break;
      case 'chasing':
        this.updateChasing();
        break;
      case 'returning':
        this.updateReturning();
        break;
    }

    // Update ball depth
    if (this.ball) {
      this.ball.setDepth(this.ball.y + TILE_SIZE / 2);
    }
  }

  private updateThrownBall(): void {
    if (!this.ball) return;

    // Apply friction to slow down ball
    this.ballVelocity.x *= BALL_FRICTION;
    this.ballVelocity.y *= BALL_FRICTION;
    this.ball.setVelocity(this.ballVelocity.x, this.ballVelocity.y);

    // Check if ball has stopped
    const speed = Math.sqrt(
      this.ballVelocity.x * this.ballVelocity.x +
      this.ballVelocity.y * this.ballVelocity.y
    );

    if (speed < 5) {
      this.ball.setVelocity(0, 0);
      this.state = 'chasing';
    }
  }

  private updateChasing(): void {
    if (!this.ball || !this.companionSprite) return;

    // Apply friction to ball while it's still moving
    this.ballVelocity.x *= BALL_FRICTION;
    this.ballVelocity.y *= BALL_FRICTION;
    this.ball.setVelocity(this.ballVelocity.x, this.ballVelocity.y);

    // Move puppy toward ball
    const dx = this.ball.x - this.companionSprite.x;
    const dy = this.ball.y - this.companionSprite.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > CATCH_DISTANCE) {
      // Move toward ball
      const angle = Math.atan2(dy, dx);
      this.companionSprite.setVelocity(
        Math.cos(angle) * CHASE_SPEED,
        Math.sin(angle) * CHASE_SPEED
      );

      // Update sprite direction (use textures for puppy)
      if (dx > 1 && !this.facingRight) {
        this.facingRight = true;
        this.companionSprite.setTexture('puppy_right');
      } else if (dx < -1 && this.facingRight) {
        this.facingRight = false;
        this.companionSprite.setTexture('puppy_left');
      }
    } else {
      // Caught the ball!
      this.companionSprite.setVelocity(0, 0);
      this.state = 'returning';

      // Switch to ball-holding sprite
      this.companionSprite.setTexture(this.facingRight ? 'puppy_right_ball' : 'puppy_left_ball');

      // Ball follows puppy now (hide it)
      this.ball.setVisible(false);

      // Play catch sound
      SoundManager.playPet();

      // Happy bounce animation
      this.scene.tweens.add({
        targets: this.companionSprite,
        y: this.companionSprite.y - 8,
        duration: 150,
        yoyo: true,
        ease: 'Quad.easeOut',
      });
    }
  }

  private updateReturning(): void {
    if (!this.ball || !this.companionSprite) return;

    // Move puppy back to player
    const dx = this.player.x - this.companionSprite.x;
    const dy = this.player.y - this.companionSprite.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Ball follows puppy (hidden)
    this.ball.setPosition(this.companionSprite.x, this.companionSprite.y - 4);

    if (distance > RETURN_DISTANCE) {
      // Move toward player
      const angle = Math.atan2(dy, dx);
      this.companionSprite.setVelocity(
        Math.cos(angle) * CHASE_SPEED,
        Math.sin(angle) * CHASE_SPEED
      );

      // Update sprite direction (use ball-holding textures)
      if (dx > 1 && !this.facingRight) {
        this.facingRight = true;
        this.companionSprite.setTexture('puppy_right_ball');
      } else if (dx < -1 && this.facingRight) {
        this.facingRight = false;
        this.companionSprite.setTexture('puppy_left_ball');
      }
    } else {
      // Returned to player - fetch complete!
      this.completeFetch();
    }
  }

  private completeFetch(): void {
    if (!this.companionSprite) return;

    this.companionSprite.setVelocity(0, 0);

    // Switch back to regular puppy sprite (without ball)
    this.companionSprite.setTexture(this.facingRight ? 'puppy_right' : 'puppy_left');

    // Award happiness
    const companion = PetManager.getCompanion();
    if (companion) {
      PetManager.playWithPet(companion.id);
    }

    // Play success sound
    SoundManager.playSuccess();

    // Show heart particle
    this.showHeartParticle();

    // Clean up ball
    if (this.ball) {
      this.ball.destroy();
      this.ball = null;
    }

    this.state = 'idle';
  }

  private showHeartParticle(): void {
    if (!this.companionSprite) return;

    const heart = this.scene.add.text(
      this.companionSprite.x,
      this.companionSprite.y - 16,
      '❤️',
      { fontSize: '16px' }
    );
    heart.setOrigin(0.5);
    heart.setDepth(2000);

    this.scene.tweens.add({
      targets: heart,
      y: heart.y - 20,
      alpha: 0,
      duration: 800,
      ease: 'Quad.easeOut',
      onComplete: () => heart.destroy(),
    });
  }

  // Check if companion is controlled by fetch (for CompanionSystem to skip normal update)
  isControllingCompanion(): boolean {
    return this.state === 'chasing' || this.state === 'returning';
  }

  // Clean up
  destroy(): void {
    if (this.ball) {
      this.ball.destroy();
      this.ball = null;
    }
    this.state = 'idle';
  }
}
