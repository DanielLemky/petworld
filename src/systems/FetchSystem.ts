import Phaser from 'phaser';
import { PetManager } from './PetManager';
import { SoundManager } from './SoundManager';
import { TILE_SIZE } from '../utils/constants';

type FetchState = 'idle' | 'thrown' | 'chasing' | 'stuck_retry' | 'returning';

const BALL_SPEED = 300;
const BALL_FRICTION = 0.985;
const CHASE_SPEED = 130;
const CATCH_DISTANCE = TILE_SIZE * 0.8;
const RETURN_DISTANCE = TILE_SIZE * 1.5;

// Stuck detection constants
const STUCK_CHECK_INTERVAL = 500; // ms
const STUCK_POSITION_HISTORY = 6; // positions to track (3 seconds)
const STUCK_DISTANCE_THRESHOLD = 15; // pixels total movement in 3 seconds
const STUCK_MOVEMENT_THRESHOLD = 5; // pixels in 0.5s to reset stuck timer
const ANGLE_RETRY_TIME = 2000; // ms per angle attempt
const STUCK_TIMEOUT = 60000; // 60 seconds total timeout
const ANGLE_OFFSETS = [0, 22.5, -22.5, 45, -45, 67.5, -67.5, 90, -90]; // degrees

export class FetchSystem {
  private scene: Phaser.Scene;
  private ball: Phaser.Physics.Arcade.Sprite | null = null;
  private state: FetchState = 'idle';
  private player: Phaser.Physics.Arcade.Sprite;
  private companionSprite: Phaser.Physics.Arcade.Sprite | null = null;
  private ballVelocity = { x: 0, y: 0 };
  private facingRight: boolean = true;

  // Stuck detection and retry system
  private positionHistory: Array<{x: number, y: number, time: number}> = [];
  private lastPositionCheck: number = 0;
  private stuckStartTime: number = 0;
  private angleRetryIndex: number = 0;
  private angleRetryStartTime: number = 0;

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

    // Reset stuck detection state
    this.resetStuckDetection();

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
      case 'stuck_retry':
        this.updateStuckRetry();
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

    // Check for stuck state
    this.checkStuckState();

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

  private updateStuckRetry(): void {
    if (!this.ball || !this.companionSprite) return;

    const now = this.scene.time.now;

    // Check if it's time to try the next angle
    if (now - this.angleRetryStartTime >= ANGLE_RETRY_TIME) {
      this.angleRetryIndex = (this.angleRetryIndex + 1) % ANGLE_OFFSETS.length;
      this.angleRetryStartTime = now;
    }

    // Check if puppy is moving again (success!)
    this.checkMovementProgress();

    // Apply friction to ball while it's still moving
    this.ballVelocity.x *= BALL_FRICTION;
    this.ballVelocity.y *= BALL_FRICTION;
    this.ball.setVelocity(this.ballVelocity.x, this.ballVelocity.y);

    // Move puppy toward ball with angle offset
    const dx = this.ball.x - this.companionSprite.x;
    const dy = this.ball.y - this.companionSprite.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > CATCH_DISTANCE) {
      // Calculate angle with offset
      const baseAngle = Math.atan2(dy, dx);
      const offsetRadians = (ANGLE_OFFSETS[this.angleRetryIndex] * Math.PI) / 180;
      const adjustedAngle = baseAngle + offsetRadians;

      this.companionSprite.setVelocity(
        Math.cos(adjustedAngle) * CHASE_SPEED,
        Math.sin(adjustedAngle) * CHASE_SPEED
      );

      // Update sprite direction based on movement direction
      const moveX = Math.cos(adjustedAngle);
      if (moveX > 0.1 && !this.facingRight) {
        this.facingRight = true;
        this.companionSprite.setTexture('puppy_right');
      } else if (moveX < -0.1 && this.facingRight) {
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

    // Check for total timeout
    if (now - this.stuckStartTime >= STUCK_TIMEOUT) {
      this.handleStuckTimeout();
    }
  }

  private checkStuckState(): void {
    const now = this.scene.time.now;

    // Record position periodically
    if (now - this.lastPositionCheck >= STUCK_CHECK_INTERVAL) {
      this.positionHistory.push({
        x: this.companionSprite!.x,
        y: this.companionSprite!.y,
        time: now
      });

      // Keep only recent history
      while (this.positionHistory.length > STUCK_POSITION_HISTORY) {
        this.positionHistory.shift();
      }

      this.lastPositionCheck = now;

      // Check if stuck
      if (this.positionHistory.length >= STUCK_POSITION_HISTORY) {
        const oldest = this.positionHistory[0];
        const newest = this.positionHistory[this.positionHistory.length - 1];
        const totalDistance = Math.sqrt(
          Math.pow(newest.x - oldest.x, 2) + Math.pow(newest.y - oldest.y, 2)
        );

        if (totalDistance < STUCK_DISTANCE_THRESHOLD) {
          // Puppy is stuck!
          if (this.stuckStartTime === 0) {
            this.stuckStartTime = now;
            this.angleRetryIndex = 0;
            this.angleRetryStartTime = now;
          }
          this.state = 'stuck_retry';
        }
      }
    }
  }

  private checkMovementProgress(): void {
    if (this.positionHistory.length < 2) return;

    const recent = this.positionHistory.slice(-2); // Last 2 positions (1 second)
    const distance = Math.sqrt(
      Math.pow(recent[1].x - recent[0].x, 2) + Math.pow(recent[1].y - recent[0].y, 2)
    );

    // If puppy moved significantly recently, resume normal chasing
    if (distance >= STUCK_MOVEMENT_THRESHOLD) {
      this.state = 'chasing';
      this.stuckStartTime = 0;
      this.positionHistory = [];
    }
  }

  private handleStuckTimeout(): void {
    if (!this.companionSprite) return;

    // Stop trying and return ball to player
    this.companionSprite.setVelocity(0, 0);
    this.state = 'returning';

    // Ball stays visible and follows puppy
    if (this.ball) {
      this.ball.setVisible(true);
      this.ball.setVelocity(0, 0);
    }

    // Show message that puppy gave up
    this.showStuckMessage();
  }

  private showStuckMessage(): void {
    const message = this.scene.add.text(
      this.scene.cameras.main.width / 2,
      this.scene.cameras.main.height - 80,
      'The puppy got stuck and gave up',
      {
        fontSize: '14px',
        color: '#ff6b6b',
        backgroundColor: '#2d2d44ee',
        padding: { x: 12, y: 6 },
      }
    );
    message.setOrigin(0.5);
    message.setScrollFactor(0);
    message.setDepth(2000);

    this.scene.tweens.add({
      targets: message,
      alpha: 0,
      y: message.y - 20,
      duration: 2000,
      ease: 'Quad.easeOut',
      onComplete: () => message.destroy(),
    });
  }

  private resetStuckDetection(): void {
    this.positionHistory = [];
    this.lastPositionCheck = 0;
    this.stuckStartTime = 0;
    this.angleRetryIndex = 0;
    this.angleRetryStartTime = 0;
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
