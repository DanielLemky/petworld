import Phaser from 'phaser';
import { SCENES, TILE_SIZE, PLAYER_SPEED, PLAYER_RUN_MULTIPLIER, PLAYER_HEIGHT } from '../utils/constants';
import { CatchingUI } from '../ui/CatchingUI';
import { PetManager } from '../systems/PetManager';
import { SoundManager } from '../systems/SoundManager';
import { InventoryManager, TOOL_INFO, type ToolType } from '../systems/InventoryManager';
import { CompanionSystem } from '../systems/CompanionSystem';
import { FetchSystem } from '../systems/FetchSystem';
import { GamepadManager, GAMEPAD_BUTTONS } from '../systems/GamepadManager';
import { getSpriteKey, applyPetSpriteConfig, updatePetSpriteDirection } from '../systems/PetSpriteConfig';
import { fleePetFromPlayer, showCatchMessage } from '../utils/petUtils';
import { AccountManager } from '../systems/AccountManager';
import { PlayerAnimator } from '../systems/PlayerAnimator';

const SNOW_PET_TYPES = ['PENGUIN', 'POLAR_BEAR', 'SNOW_BUNNY', 'SEAL'];

export class SnowScene extends Phaser.Scene {
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private trees!: Phaser.Physics.Arcade.StaticGroup;
  private pets!: Phaser.Physics.Arcade.Group;
  private playerAnimator!: PlayerAnimator;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private infoText!: Phaser.GameObjects.Text;
  private petCountText!: Phaser.GameObjects.Text;
  private playerDirection: string = 'down';

  private catchingUI!: CatchingUI;
  private isCatching: boolean = false;
  private targetPet: Phaser.Physics.Arcade.Sprite | null = null;
  private exitZone!: Phaser.GameObjects.Zone;
  private isTransitioning: boolean = false;
  private iceBounds!: Phaser.Geom.Rectangle;
  private isOnIce: boolean = false;
  private snowflakes: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private collectibles!: Phaser.Physics.Arcade.Group;
  private inventoryText!: Phaser.GameObjects.Text;
  
  private companionSystem!: CompanionSystem;
  private fetchSystem!: FetchSystem;

  constructor() {
    super({ key: SCENES.SNOW });
  }

  create(): void {
    this.isTransitioning = false;
    this.isCatching = false;

    this.catchingUI = new CatchingUI(this);

    this.createWorld();
    this.createPlayer();

    // Initialize player animator
    this.playerAnimator = new PlayerAnimator(this, this.player);

    // Initialize companion system
    this.companionSystem = new CompanionSystem(this);
    this.companionSystem.init(this.player);
    if (this.companionSystem.hasCompanion()) {
      this.companionSystem.addCollider(this.trees);
    }

    // Initialize fetch system
    this.fetchSystem = new FetchSystem(this, this.player);
    this.fetchSystem.setCompanion(this.companionSystem.getSprite());
    this.companionSystem.setFetchSystem(this.fetchSystem);

    this.createPets();
    this.createCollectibles();
    this.setupInput();

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(1.0);

    this.createUI();
    this.createSnowfall();

    // Play snow music (we'll use world music for now, could add snow-specific later)
    SoundManager.playMusic('snow');
  }

  update(): void {
    // Update gamepad state
    GamepadManager.update();

    if (this.isCatching) return;

    // Handle gamepad buttons
    this.handleGamepadButtons();

    const feetY = this.player.y + PLAYER_HEIGHT / 2 - 4;
    this.isOnIce = this.iceBounds.contains(this.player.x, feetY);

    this.handlePlayerMovement();
    this.handlePetBehavior();
    this.updateDepthSorting();
    this.companionSystem.update();
    this.fetchSystem.update();
    this.checkExitZone();

    // Handle right stick for fetch aiming
    this.handleFetchWithGamepad();
  }

  private handleGamepadButtons(): void {
    // A button (0) - Interact
    if (GamepadManager.isButtonJustPressed(GAMEPAD_BUTTONS.A)) {
      this.tryInteract();
    }
    // Start button - Open menu
    if (GamepadManager.isButtonJustPressed(GAMEPAD_BUTTONS.START)) {
      this.openMenu();
    }
  }

  private openMenu(): void {
    if (this.isCatching || this.isTransitioning) return;
    this.scene.pause();
    this.scene.launch(SCENES.MENU, { previousScene: SCENES.SNOW });
    this.scene.bringToTop(SCENES.MENU);
  }

  private handleFetchWithGamepad(): void {
    if (!this.fetchSystem.canPlay() || this.isCatching || this.isTransitioning) return;

    const rightStick = GamepadManager.getRightStick();
    const stickMagnitude = Math.sqrt(rightStick.x * rightStick.x + rightStick.y * rightStick.y);
    
    // R2 trigger to throw, right stick to aim
    // Trigger pressure controls throw distance
    if (stickMagnitude > 0.3 && GamepadManager.isButtonJustPressed(GAMEPAD_BUTTONS.RT)) {
      const triggerValue = GamepadManager.getTriggerValue(GAMEPAD_BUTTONS.RT);
      const minDistance = 50;
      const maxDistance = 150;
      const throwDistance = minDistance + (maxDistance - minDistance) * triggerValue;
      
      // Normalize stick direction and apply throw distance
      const targetX = this.player.x + (rightStick.x / stickMagnitude) * throwDistance;
      const targetY = this.player.y + (rightStick.y / stickMagnitude) * throwDistance;
      this.fetchSystem.throwBall(targetX, targetY);
    }
  }

  private createWorld(): void {
    const worldWidth = 40;
    const worldHeight = 30;

    this.physics.world.setBounds(0, 0, worldWidth * TILE_SIZE, worldHeight * TILE_SIZE);

    // Snow ground
    for (let y = 0; y < worldHeight; y++) {
      for (let x = 0; x < worldWidth; x++) {
        const snowType = Math.random() > 0.85 ? 'snow_sparkle' : 'snow';
        const tile = this.add.image(
          x * TILE_SIZE + TILE_SIZE / 2,
          y * TILE_SIZE + TILE_SIZE / 2,
          snowType
        );
        tile.setDepth(-10);
      }
    }

    // Frozen pond
    const pondX = 20;
    const pondY = 12;
    const pondWidth = 8;
    const pondHeight = 6;

    for (let y = pondY; y < pondY + pondHeight; y++) {
      for (let x = pondX; x < pondX + pondWidth; x++) {
        const ice = this.add.image(
          x * TILE_SIZE + TILE_SIZE / 2,
          y * TILE_SIZE + TILE_SIZE / 2,
          'ice'
        );
        ice.setDepth(-5);
      }
    }

    this.iceBounds = new Phaser.Geom.Rectangle(
      pondX * TILE_SIZE,
      pondY * TILE_SIZE,
      pondWidth * TILE_SIZE,
      pondHeight * TILE_SIZE
    );

    // Pine trees
    this.trees = this.physics.add.staticGroup();
    const treePositions = [
      { x: 5, y: 5 }, { x: 12, y: 3 }, { x: 30, y: 6 },
      { x: 8, y: 15 }, { x: 35, y: 12 }, { x: 3, y: 22 },
      { x: 15, y: 20 }, { x: 32, y: 22 }, { x: 25, y: 4 },
      { x: 6, y: 10 }, { x: 33, y: 18 }, { x: 18, y: 25 },
    ];

    treePositions.forEach(pos => {
      const treeWidth = TILE_SIZE * 4;   // 2x scale
      const treeHeight = TILE_SIZE * 6;  // 2x scale

      const tree = this.add.image(
        pos.x * TILE_SIZE + treeWidth / 2,
        pos.y * TILE_SIZE + treeHeight / 2,
        'pine_tree'
      );
      tree.setDepth(pos.y * TILE_SIZE + treeHeight);

      const collider = this.trees.create(
        pos.x * TILE_SIZE + treeWidth / 2,
        pos.y * TILE_SIZE + treeHeight * 0.8,  // Position collider at base of larger tree
        'snow'
      ) as Phaser.Physics.Arcade.Sprite;
      collider.setVisible(false);
      collider.setSize(treeWidth * 0.6, treeHeight * 0.2);  // Scale collider proportionally
      collider.refreshBody();
    });

    // Snowmen decorations
    const snowmanPositions = [
      { x: 10, y: 8 }, { x: 28, y: 15 }, { x: 22, y: 24 },
    ];

    snowmanPositions.forEach(pos => {
      const snowman = this.add.image(
        pos.x * TILE_SIZE + TILE_SIZE / 2,
        pos.y * TILE_SIZE + TILE_SIZE / 2,
        'snowman'
      );
      snowman.setDepth(pos.y * TILE_SIZE);
    });

    // Exit zone (path back to main world)
    this.exitZone = this.add.zone(2 * TILE_SIZE, 15 * TILE_SIZE, TILE_SIZE * 2, TILE_SIZE * 3);

    // Exit sign
    const exitText = this.add.text(2 * TILE_SIZE, 13.5 * TILE_SIZE, 'To World', {
      fontSize: '8px',
      color: '#ffffff',
      backgroundColor: '#2d2d44aa',
      padding: { x: 4, y: 2 },
    });
    exitText.setOrigin(0.5);
    exitText.setDepth(100);

    const arrow = this.add.text(2 * TILE_SIZE, 14 * TILE_SIZE, '◀', {
      fontSize: '10px',
      color: '#4ade80',
    });
    arrow.setOrigin(0.5);
    arrow.setDepth(100);

    this.tweens.add({
      targets: arrow,
      x: arrow.x - 4,
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Create path tiles leading to exit
    for (let y = 13; y < 18; y++) {
      for (let x = 0; x < 3; x++) {
        const path = this.add.image(
          x * TILE_SIZE + TILE_SIZE / 2,
          y * TILE_SIZE + TILE_SIZE / 2,
          'path'
        );
        path.setDepth(-5);
      }
    }
  }

  private createPlayer(): void {
this.player = this.physics.add.sprite(
      5 * TILE_SIZE + TILE_SIZE / 2,
      17 * TILE_SIZE + PLAYER_HEIGHT / 2,
      'player_right'
    ) as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;

    // Scale will be set by PlayerAnimator

    this.player.setSize(800, 400);
    this.player.setOffset(400, 2400);
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(this.player.y);

    this.physics.add.collider(this.player, this.trees);
  }

  private createPets(): void {
    this.pets = this.physics.add.group();

    // Spawn snow pets
    const spawnPositions = [
      { x: 15, y: 8 }, { x: 25, y: 10 }, { x: 30, y: 20 },
      { x: 10, y: 18 }, { x: 35, y: 8 }, { x: 20, y: 22 },
      { x: 8, y: 25 }, { x: 32, y: 25 },
    ];

    spawnPositions.forEach(pos => {
      const petType = SNOW_PET_TYPES[Math.floor(Math.random() * SNOW_PET_TYPES.length)];
      const petTypeLower = petType.toLowerCase();
      const spriteKey = getSpriteKey(petTypeLower, true);
      
      const pet = this.pets.create(
        pos.x * TILE_SIZE + TILE_SIZE / 2,
        pos.y * TILE_SIZE + TILE_SIZE / 2,
        spriteKey
      ) as Phaser.Physics.Arcade.Sprite;

      pet.setCollideWorldBounds(true);
      pet.setData('petType', petType);
      pet.setData('wanderTimer', Math.random() * 2000);
      pet.setData('wanderDirection', { x: 0, y: 0 });
      pet.setDepth(pos.y * TILE_SIZE);

      // Apply sprite configuration from centralized config
      applyPetSpriteConfig(pet, petTypeLower);
    });

    this.physics.add.collider(this.pets, this.trees);
    this.physics.add.collider(this.pets, this.pets);
  }

  private setupInput(): void {
    // Initialize gamepad manager
    GamepadManager.setScene(this);

    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasd = {
        W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
      this.interactKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      this.shiftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);

      this.interactKey.on('down', () => this.tryInteract());

      // ESC key - Open menu
      const menuKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
      menuKey.on('down', () => {
        if (!this.isCatching) {
          this.openMenu();
        }
      });
    }

    // Mouse click handler for fetch
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.fetchSystem.canPlay() && !this.isCatching && !this.isTransitioning) {
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        this.fetchSystem.throwBall(worldPoint.x, worldPoint.y);
      }
    });
  }

  private createUI(): void {
    this.infoText = this.add.text(16, 16, 'WASD move | SPACE catch', {
      fontSize: '10px',
      color: '#ffffff',
      backgroundColor: '#2d2d44dd',
      padding: { x: 6, y: 3 },
    });
    this.infoText.setScrollFactor(0);
    this.infoText.setDepth(1000);

    this.petCountText = this.add.text(16, 38, this.getPetCountText(), {
      fontSize: '10px',
      color: '#4ade80',
      backgroundColor: '#2d2d44dd',
      padding: { x: 6, y: 3 },
    });
    this.petCountText.setScrollFactor(0);
    this.petCountText.setDepth(1000);

    // Location indicator
    const locationText = this.add.text(
      this.cameras.main.width - 16,
      16,
      'SNOW LANDS',
      {
        fontSize: '10px',
        color: '#87ceeb',
        backgroundColor: '#2d2d44dd',
        padding: { x: 6, y: 3 },
      }
    );
    locationText.setOrigin(1, 0);
    locationText.setScrollFactor(0);
    locationText.setDepth(1000);

    // Account name display
    const account = AccountManager.getActiveAccount();
    if (account) {
      const accountText = this.add.text(
        this.cameras.main.width - 16,
        38,
        account.name,
        {
          fontSize: '10px',
          color: '#aaaaaa',
          backgroundColor: '#2d2d44dd',
          padding: { x: 6, y: 3 },
        }
      );
      accountText.setOrigin(1, 0);
      accountText.setScrollFactor(0);
      accountText.setDepth(1000);
    }

    this.inventoryText = this.add.text(16, 60, this.getInventoryText(), {
      fontSize: '10px', color: '#fbbf24', backgroundColor: '#2d2d44dd', padding: { x: 6, y: 3 },
    });
    this.inventoryText.setScrollFactor(0).setDepth(1000);
  }

  private getInventoryText(): string {
    const tools = InventoryManager.getTools();
    if (tools.length === 0) return 'Tools: None';
    return `Tools: ${tools.map(t => TOOL_INFO[t].name.split(' ')[0]).join(', ')}`;
  }

  private createSnowfall(): void {
    // Create snowflake particle
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0xffffff, 0.8);
    g.fillRect(0, 0, 2, 2);
    g.generateTexture('snowflake', 2, 2);
    g.destroy();

    // Create particle emitter for snowfall
    this.snowflakes = this.add.particles(0, 0, 'snowflake', {
      x: { min: 0, max: this.cameras.main.width },
      y: -10,
      lifespan: 4000,
      speedY: { min: 20, max: 40 },
      speedX: { min: -10, max: 10 },
      scale: { min: 0.5, max: 1 },
      alpha: { start: 0.8, end: 0 },
      frequency: 100,
      blendMode: 'ADD',
    });
    this.snowflakes.setScrollFactor(0);
    this.snowflakes.setDepth(999);
  }

  private getPetCountText(): string {
    const count = PetManager.getPetCount();
    return `Pets: ${count}`;
  }

  private handlePlayerMovement(): void {
    let velocityX = 0;
    let velocityY = 0;
    let newDirection = this.playerDirection;

    // Calculate speed with terrain modifiers and run multiplier
    const isRunning = this.shiftKey?.isDown || GamepadManager.isButtonDown(GAMEPAD_BUTTONS.RB);
    let speed = this.isOnIce ? PLAYER_SPEED * 1.3 : PLAYER_SPEED;
    if (isRunning) {
      speed *= PLAYER_RUN_MULTIPLIER;
    }
    const friction = this.isOnIce ? 0.98 : 1;

    // Get gamepad input
    const leftStick = GamepadManager.getLeftStick();
    const dpad = GamepadManager.getDPad();

    // Check horizontal movement (keyboard, gamepad stick, or d-pad)
    if (this.cursors?.left.isDown || this.wasd?.A.isDown || leftStick.x < -0.2 || dpad.x < 0) {
      velocityX = -speed;
      newDirection = 'left';
    } else if (this.cursors?.right.isDown || this.wasd?.D.isDown || leftStick.x > 0.2 || dpad.x > 0) {
      velocityX = speed;
      newDirection = 'right';
    }

    // Check vertical movement (keyboard, gamepad stick, or d-pad)
    if (this.cursors?.up.isDown || this.wasd?.W.isDown || leftStick.y < -0.2 || dpad.y < 0) {
      velocityY = -speed;
      if (velocityX === 0) newDirection = 'up';
    } else if (this.cursors?.down.isDown || this.wasd?.S.isDown || leftStick.y > 0.2 || dpad.y > 0) {
      velocityY = speed;
      if (velocityX === 0) newDirection = 'down';
    }

    // For analog stick, use the actual stick values for smoother movement
    if (Math.abs(leftStick.x) > 0.2 || Math.abs(leftStick.y) > 0.2) {
      velocityX = leftStick.x * speed;
      velocityY = leftStick.y * speed;
      
      // Determine direction based on dominant axis
      if (Math.abs(leftStick.x) > Math.abs(leftStick.y)) {
        newDirection = leftStick.x < 0 ? 'left' : 'right';
      } else {
        newDirection = leftStick.y < 0 ? 'up' : 'down';
      }
    } else {
      // Normalize diagonal movement for keyboard/d-pad
      if (velocityX !== 0 && velocityY !== 0) {
        velocityX *= 0.707;
        velocityY *= 0.707;
      }
    }

    // On ice, blend current velocity with input for sliding effect
    if (this.isOnIce) {
      const currentVelX = this.player.body?.velocity.x || 0;
      const currentVelY = this.player.body?.velocity.y || 0;

      if (velocityX === 0 && velocityY === 0) {
        // Sliding when no input
        velocityX = currentVelX * friction;
        velocityY = currentVelY * friction;
      } else {
        // Blend input with momentum
        velocityX = velocityX * 0.3 + currentVelX * 0.7;
        velocityY = velocityY * 0.3 + currentVelY * 0.7;
      }
    }

    this.player.setVelocity(velocityX, velocityY);

    // Handle player animations using unified animator
    const moving = velocityX !== 0 || velocityY !== 0;
    this.playerAnimator.updateAnimation(moving, velocityX, isRunning);

    if (newDirection !== this.playerDirection) {
      this.playerDirection = newDirection;
      // PlayerAnimator handles texture changes automatically
    }
  }

  

  private handlePetBehavior(): void {
    const petSpeed = 25;

    this.pets.children.each((pet: Phaser.GameObjects.GameObject) => {
      const sprite = pet as Phaser.Physics.Arcade.Sprite;
      let timer = sprite.getData('wanderTimer') as number;

      timer -= this.game.loop.delta;

      if (timer <= 0) {
        const directions = [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: -1, y: 0 },
          { x: 0, y: 1 },
          { x: 0, y: -1 },
          { x: 0, y: 0 },
          { x: 0, y: 0 },
        ];

        const newDir = directions[Math.floor(Math.random() * directions.length)];
        sprite.setData('wanderDirection', newDir);
        sprite.setData('wanderTimer', 1500 + Math.random() * 3000);
      } else {
        sprite.setData('wanderTimer', timer);
      }

      const dir = sprite.getData('wanderDirection') as { x: number; y: number };
      sprite.setVelocity(dir.x * petSpeed, dir.y * petSpeed);

      // Handle sprite direction flipping using centralized config
      const petType = (sprite.getData('petType') as string).toLowerCase();
      updatePetSpriteDirection(sprite, petType, dir.x);

      return true;
    });
  }

  private updateDepthSorting(): void {
    this.player.setDepth(this.player.y + PLAYER_HEIGHT / 2);

    this.pets.children.each((pet: Phaser.GameObjects.GameObject) => {
      const sprite = pet as Phaser.Physics.Arcade.Sprite;
      sprite.setDepth(sprite.y + TILE_SIZE / 2);
      return true;
    });
  }

  private tryInteract(): void {
    if (this.isCatching) return;

    let nearestPet: Phaser.Physics.Arcade.Sprite | null = null;
    let nearestDistance = TILE_SIZE * 2;

    this.pets.children.each((pet: Phaser.GameObjects.GameObject) => {
      const sprite = pet as Phaser.Physics.Arcade.Sprite;
      const distance = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        sprite.x, sprite.y
      );

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestPet = sprite;
      }

      return true;
    });

    if (nearestPet) {
      this.startCatching(nearestPet);
    }
  }

  private startCatching(pet: Phaser.Physics.Arcade.Sprite): void {
    this.isCatching = true;
    this.targetPet = pet;

    const petType = pet.getData('petType') as string;

    this.catchingUI.start(petType, (result) => {
      if (result === 'success' && this.targetPet) {
        SoundManager.playSuccess();

        const caughtPet = PetManager.catchPet(petType);
        this.petCountText.setText(this.getPetCountText());

        showCatchMessage(this, `${caughtPet.name} joined your team!`, '#4ade80');

        this.tweens.add({
          targets: this.targetPet,
          alpha: 0,
          scale: 0.5,
          duration: 300,
          onComplete: () => {
            this.targetPet?.destroy();
            this.targetPet = null;
          },
        });
      } else if (result === 'failure') {
        SoundManager.playFailure();

        showCatchMessage(this, 'It got away!', '#ef4444');

        if (this.targetPet) {
          fleePetFromPlayer(this, this.targetPet, this.player.x, this.player.y);
        }
        this.targetPet = null;
      } else {
        // 'cancelled' or 'no_tool' - pet stays in place
        showCatchMessage(this, 'You backed away...', '#888888');
        this.targetPet = null;
      }

      this.isCatching = false;
    });
  }

  private checkExitZone(): void {
    if (this.isTransitioning) return;

    const playerBounds = this.player.getBounds();
    const zoneBounds = this.exitZone.getBounds();

    if (Phaser.Geom.Rectangle.Overlaps(playerBounds, zoneBounds)) {
      this.goToWorld();
    }
  }

  private goToWorld(): void {
    if (this.isCatching || this.isTransitioning) return;
    this.isTransitioning = true;

    SoundManager.playClick();

    this.cameras.main.fadeOut(300, 0, 0, 0);

    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(SCENES.WORLD);
    });
  }

  private createCollectibles(): void {
    this.collectibles = this.physics.add.group();

    // TRAP spawns in snow lands - good for catching snow bunnies
    if (!InventoryManager.hasTool('TRAP')) {
      this.createCollectibleItem(28, 20, 'TRAP');
    }

    this.physics.add.overlap(this.player, this.collectibles, (_, collectible) => {
      this.collectItem(collectible as Phaser.Physics.Arcade.Sprite);
    });
  }

  private createCollectibleItem(tileX: number, tileY: number, toolType: ToolType): void {
    const x = tileX * TILE_SIZE + TILE_SIZE / 2;
    const y = tileY * TILE_SIZE + TILE_SIZE / 2;

    const item = this.collectibles.create(x, y, `tool_${toolType.toLowerCase()}`) as Phaser.Physics.Arcade.Sprite;
    item.setData('toolType', toolType);
    item.setDepth(y + 10);

    // Bobbing animation
    this.tweens.add({
      targets: item,
      y: y - 4,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Sparkle effect
    const sparkle = this.add.sprite(x, y, 'collectible_sparkle');
    sparkle.setAlpha(0.7);
    sparkle.setDepth(y + 11);
    this.tweens.add({
      targets: sparkle,
      alpha: 0.3,
      scale: 1.3,
      duration: 600,
      yoyo: true,
      repeat: -1,
    });
    item.setData('sparkle', sparkle);
  }

  private collectItem(item: Phaser.Physics.Arcade.Sprite): void {
    const toolType = item.getData('toolType') as ToolType;
    const sparkle = item.getData('sparkle') as Phaser.GameObjects.Sprite;

    if (InventoryManager.addTool(toolType)) {
      SoundManager.playSuccess();
      this.showCollectMessage(toolType);
      this.updateInventoryUI();

      // Remove sparkle
      if (sparkle) sparkle.destroy();

      // Collect animation
      this.tweens.add({
        targets: item,
        y: item.y - 30,
        alpha: 0,
        scale: 1.5,
        duration: 400,
        onComplete: () => item.destroy(),
      });
    }
  }

  private showCollectMessage(toolType: ToolType): void {
    const info = TOOL_INFO[toolType];
    const msg = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 - 30,
      `Found ${info.name}!\n${info.description}`,
      { fontSize: '12px', color: '#ffffff', backgroundColor: '#2d2d44ee', padding: { x: 10, y: 6 }, align: 'center' }
    );
    msg.setOrigin(0.5).setScrollFactor(0).setDepth(2000);

    this.tweens.add({
      targets: msg,
      alpha: 0,
      y: msg.y - 20,
      delay: 2000,
      duration: 500,
      onComplete: () => msg.destroy(),
    });
  }

  private updateInventoryUI(): void {
    this.inventoryText.setText(this.getInventoryText());
  }
}
