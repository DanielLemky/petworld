import Phaser from 'phaser';
import { PALETTE, PET_TYPES } from '../utils/constants';
import { InventoryManager, TOOL_INFO } from '../systems/InventoryManager';
import { GamepadManager, GAMEPAD_BUTTONS } from '../systems/GamepadManager';
import { getSpriteKey, getPetSpriteConfig } from '../systems/PetSpriteConfig';

export type CatchResult = 'success' | 'failure' | 'cancelled' | 'no_tool';

export class CatchingUI {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private indicator!: Phaser.GameObjects.Rectangle;
  private catchZone!: Phaser.GameObjects.Rectangle;
  private barBackground!: Phaser.GameObjects.Rectangle;
  private instructionText!: Phaser.GameObjects.Text;
  private petNameText!: Phaser.GameObjects.Text;
  private petSprite!: Phaser.GameObjects.Image;

  private isActive: boolean = false;
  private indicatorTween!: Phaser.Tweens.Tween;
  private onComplete!: (result: CatchResult) => void;

  // Difficulty settings: level -> { zoneWidth, speed }
  // Level 1 = Very Easy, Level 4 = Hard
  private readonly DIFFICULTY_SETTINGS: Record<number, { zoneWidth: number; speed: number }> = {
    1: { zoneWidth: 70, speed: 1000 },  // Very Easy - slow, large zone
    2: { zoneWidth: 55, speed: 900 },   // Easy - comfortable for kids
    3: { zoneWidth: 38, speed: 650 },   // Medium - challenging
    4: { zoneWidth: 28, speed: 500 },   // Hard - fast, small zone
  };

  // Game settings
  private readonly barWidth = 200;
  private readonly barHeight = 20;
  private readonly indicatorWidth = 8;

  // These are set per-catch based on pet difficulty
  private catchZoneWidth = 50;
  private speed = 800;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  start(petType: string, callback: (result: CatchResult) => void): void {
    if (this.isActive) return;

    // Check if player has the required tool
    const toolCheck = InventoryManager.canCatchPet(petType);
    if (!toolCheck.canCatch && toolCheck.requiredTool) {
      this.showNeedToolMessage(petType, toolCheck.requiredTool, callback);
      return;
    }

    this.isActive = true;
    this.onComplete = callback;

    // Get pet info and difficulty
    const petKey = petType.toUpperCase() as keyof typeof PET_TYPES;
    const petInfo = PET_TYPES[petKey];
    const petName = petInfo?.name || 'Pet';

    // Apply difficulty settings for this pet
    const difficulty = petInfo?.difficulty || 2;
    const settings = this.DIFFICULTY_SETTINGS[difficulty] || this.DIFFICULTY_SETTINGS[2];
    this.catchZoneWidth = settings.zoneWidth;
    this.speed = settings.speed;

    const centerX = this.scene.cameras.main.width / 2;
    const centerY = this.scene.cameras.main.height / 2;

    // Create container for all UI elements
    this.container = this.scene.add.container(centerX, centerY);
    this.container.setScrollFactor(0);
    this.container.setDepth(3000);

    // Darken background
    const overlay = this.scene.add.rectangle(0, 0, 400, 250, 0x000000, 0.7);
    overlay.setStrokeStyle(3, PALETTE.UI_BORDER);
    this.container.add(overlay);

    this.petNameText = this.scene.add.text(0, -90, `Wild ${petName} appeared!`, {
      fontSize: '16px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    this.petNameText.setOrigin(0.5);
    this.container.add(this.petNameText);

    // Pet sprite (bouncing) - use animal sprites from PetSpriteConfig
    const spriteKey = getSpriteKey(petType, true);
    this.petSprite = this.scene.add.image(0, -45, spriteKey);
    const petConfig = getPetSpriteConfig(petType);
    this.petSprite.setScale(petConfig.scale * 1.5);
    this.container.add(this.petSprite);

    // Bounce animation for pet
    this.scene.tweens.add({
      targets: this.petSprite,
      y: -50,
      duration: 400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Catching bar background
    this.barBackground = this.scene.add.rectangle(
      0, 20,
      this.barWidth, this.barHeight,
      0x333333, 1
    );
    this.barBackground.setStrokeStyle(2, 0x555555);
    this.container.add(this.barBackground);

    // Catch zone (green area - target)
    const catchZoneX = (Math.random() * (this.barWidth - this.catchZoneWidth - 40)) - (this.barWidth / 2 - 20 - this.catchZoneWidth / 2);
    this.catchZone = this.scene.add.rectangle(
      catchZoneX, 20,
      this.catchZoneWidth, this.barHeight - 4,
      0x4ade80, 1
    );
    this.container.add(this.catchZone);

    // Moving indicator
    this.indicator = this.scene.add.rectangle(
      -this.barWidth / 2 + this.indicatorWidth / 2 + 4, 20,
      this.indicatorWidth, this.barHeight + 4,
      0xffffff, 1
    );
    this.container.add(this.indicator);

    // Instruction text
    this.instructionText = this.scene.add.text(0, 60, 'Press SPACE in the green zone!', {
      fontSize: '12px',
      color: '#ffff00',
    });
    this.instructionText.setOrigin(0.5);
    this.container.add(this.instructionText);

    // Cancel hint
    const cancelText = this.scene.add.text(0, 85, '(ESC to run away)', {
      fontSize: '10px',
      color: '#888888',
    });
    cancelText.setOrigin(0.5);
    this.container.add(cancelText);

    // Start indicator animation
    this.startIndicatorMovement();

    // Set up input
    this.setupInput();

    // Entry animation
    this.container.setScale(0);
    this.scene.tweens.add({
      targets: this.container,
      scale: 1,
      duration: 200,
      ease: 'Back.easeOut',
    });
  }

  private startIndicatorMovement(): void {
    const rightBound = this.barWidth / 2 - this.indicatorWidth / 2 - 4;

    this.indicatorTween = this.scene.tweens.add({
      targets: this.indicator,
      x: rightBound,
      duration: this.speed,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private setupInput(): void {
    // Internal functions that do the actual work
    const doCatch = () => {
      this.scene.input.keyboard?.off('keydown', handleKeydown);
      this.checkCatch();
    };

    const doCancel = () => {
      this.scene.input.keyboard?.off('keydown', handleKeydown);
      this.finish('cancelled');
    };

    // Event-based keyboard handler (doesn't create key objects)
    const handleKeydown = (event: KeyboardEvent) => {
      if (!this.isActive) return;
      if (event.code === 'Space') {
        doCatch();
      } else if (event.code === 'Escape') {
        doCancel();
      }
    };

    // Delay input setup by 150ms to prevent immediate triggering from start key
    this.scene.time.delayedCall(150, () => {
      this.scene.input.keyboard?.on('keydown', handleKeydown);

      // Store reference for cleanup
      this.container.setData('handleKeydown', handleKeydown);

      // Set up gamepad polling for catch/cancel
      this.container.setData('gamepadHandled', false);
      const gamepadPollEvent = this.scene.time.addEvent({
        delay: 16, // ~60fps
        callback: () => {
          if (!this.isActive || this.container.getData('gamepadHandled')) return;

          GamepadManager.update();

          // A button (0) - Catch
          if (GamepadManager.isButtonJustPressed(GAMEPAD_BUTTONS.A)) {
            this.container.setData('gamepadHandled', true);
            doCatch();
          }
          // B button (1) - Cancel
          if (GamepadManager.isButtonJustPressed(GAMEPAD_BUTTONS.B)) {
            this.container.setData('gamepadHandled', true);
            doCancel();
          }
        },
        loop: true,
      });
      this.container.setData('gamepadPollEvent', gamepadPollEvent);
    });
  }

  private checkCatch(): void {
    // Check if indicator overlaps with catch zone
    const indicatorLeft = this.indicator.x - this.indicatorWidth / 2;
    const indicatorRight = this.indicator.x + this.indicatorWidth / 2;
    const zoneLeft = this.catchZone.x - this.catchZoneWidth / 2;
    const zoneRight = this.catchZone.x + this.catchZoneWidth / 2;

    const isInZone = indicatorRight >= zoneLeft && indicatorLeft <= zoneRight;

    if (isInZone) {
      this.showSuccess();
    } else {
      this.showFailure();
    }
  }

  private showSuccess(): void {
    // Stop the indicator
    this.indicatorTween.stop();

    // Flash green
    this.indicator.setFillStyle(0x4ade80);

    // Success text
    this.instructionText.setText('CAUGHT!');
    this.instructionText.setColor('#4ade80');

    // Pet celebration
    this.scene.tweens.add({
      targets: this.petSprite,
      angle: 360,
      scale: 2.5,
      duration: 500,
      ease: 'Back.easeOut',
    });

    // Particles effect
    this.createSuccessParticles();

    // Finish after delay
    this.scene.time.delayedCall(1000, () => {
      this.finish('success');
    });
  }

  private showFailure(): void {
    // Stop the indicator
    this.indicatorTween.stop();

    // Flash red
    this.indicator.setFillStyle(0xef4444);
    this.barBackground.setFillStyle(0x7f1d1d);

    // Failure text
    this.instructionText.setText('It got away...');
    this.instructionText.setColor('#ef4444');

    // Pet escapes animation
    this.scene.tweens.add({
      targets: this.petSprite,
      x: 150,
      alpha: 0,
      duration: 400,
      ease: 'Quad.easeIn',
    });

    // Shake the container
    this.scene.tweens.add({
      targets: this.container,
      x: this.container.x + 5,
      duration: 50,
      yoyo: true,
      repeat: 5,
    });

    // Finish after delay
    this.scene.time.delayedCall(1200, () => {
      this.finish('failure');
    });
  }

  private createSuccessParticles(): void {
    // Create simple star particles
    const colors = [0xffd700, 0xff69b4, 0x4ade80, 0x60a5fa];

    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const distance = 40 + Math.random() * 30;

      const particle = this.scene.add.rectangle(
        this.petSprite.x,
        this.petSprite.y,
        6, 6,
        colors[i % colors.length]
      );
      this.container.add(particle);

      this.scene.tweens.add({
        targets: particle,
        x: this.petSprite.x + Math.cos(angle) * distance,
        y: this.petSprite.y + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0,
        duration: 600,
        ease: 'Quad.easeOut',
        delay: i * 30,
      });
    }
  }

  private finish(result: CatchResult): void {
    if (!this.isActive) return;
    this.isActive = false;

    // Exit animation
    this.scene.tweens.add({
      targets: this.container,
      scale: 0,
      alpha: 0,
      duration: 200,
      ease: 'Back.easeIn',
      onComplete: () => {
        this.cleanup();
        this.onComplete(result);
      },
    });
  }

  private cleanup(): void {
    // Remove our keyboard event listener
    const handleKeydown = this.container.getData('handleKeydown') as (event: KeyboardEvent) => void;
    this.scene.input.keyboard?.off('keydown', handleKeydown);

    // Remove gamepad poll event
    const gamepadPollEvent = this.container.getData('gamepadPollEvent') as Phaser.Time.TimerEvent;
    gamepadPollEvent?.remove();

    // Destroy container and all children
    this.container.destroy();
  }

  isRunning(): boolean {
    return this.isActive;
  }

  private showNeedToolMessage(petType: string, requiredTool: string, callback: (result: CatchResult) => void): void {
    const centerX = this.scene.cameras.main.width / 2;
    const centerY = this.scene.cameras.main.height / 2;

    const petKey = petType.toUpperCase() as keyof typeof PET_TYPES;
    const petName = PET_TYPES[petKey]?.name || 'Pet';
    const toolInfo = TOOL_INFO[requiredTool as keyof typeof TOOL_INFO];

    // Create temporary container
    const container = this.scene.add.container(centerX, centerY);
    container.setScrollFactor(0);
    container.setDepth(3000);

    // Background
    const bg = this.scene.add.rectangle(0, 0, 280, 140, 0x000000, 0.85);
    bg.setStrokeStyle(3, 0xfbbf24);
    container.add(bg);

    // Message
    const title = this.scene.add.text(0, -40, `Can't catch ${petName}!`, {
      fontSize: '14px',
      color: '#ef4444',
      fontStyle: 'bold',
    });
    title.setOrigin(0.5);
    container.add(title);

    const toolMsg = this.scene.add.text(0, -10, `You need: ${toolInfo.name}`, {
      fontSize: '12px',
      color: '#fbbf24',
    });
    toolMsg.setOrigin(0.5);
    container.add(toolMsg);

    const hint = this.scene.add.text(0, 15, `(${toolInfo.description})`, {
      fontSize: '10px',
      color: '#888888',
    });
    hint.setOrigin(0.5);
    container.add(hint);

    const dismiss = this.scene.add.text(0, 45, 'Press any key or A/B button to continue', {
      fontSize: '10px',
      color: '#666666',
    });
    dismiss.setOrigin(0.5);
    container.add(dismiss);

    // Entry animation
    container.setScale(0);
    this.scene.tweens.add({
      targets: container,
      scale: 1,
      duration: 200,
      ease: 'Back.easeOut',
    });

    // Set up gamepad polling for dismiss
    container.setData('gamepadHandled', false);
    const gamepadPollEvent = this.scene.time.addEvent({
      delay: 16, // ~60fps
      callback: () => {
        if (container.getData('gamepadHandled')) return;
        
        GamepadManager.update();
        
        // A button (0) or B button (1) - Dismiss
        if (GamepadManager.isButtonJustPressed(GAMEPAD_BUTTONS.A) || 
            GamepadManager.isButtonJustPressed(GAMEPAD_BUTTONS.B)) {
          container.setData('gamepadHandled', true);
          dismissHandler();
        }
      },
      loop: true,
    });
    container.setData('gamepadPollEvent', gamepadPollEvent);

    // Dismiss on any key or gamepad button
    const dismissHandler = () => {
      this.scene.input.keyboard?.off('keydown', dismissHandler);
      
      // Remove gamepad poll event
      const pollEvent = container.getData('gamepadPollEvent') as Phaser.Time.TimerEvent;
      pollEvent?.remove();
      
      this.scene.tweens.add({
        targets: container,
        scale: 0,
        alpha: 0,
        duration: 150,
        onComplete: () => {
          container.destroy();
          callback('no_tool');
        },
      });
    };

    this.scene.time.delayedCall(300, () => {
      this.scene.input.keyboard?.on('keydown', dismissHandler);
    });
  }
}
