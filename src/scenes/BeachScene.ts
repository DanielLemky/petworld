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
import { RidingSystem } from '../systems/RidingSystem';
import { SleighRidingSystem } from '../systems/SleighRidingSystem';

const BEACH_PET_TYPES = ['CRAB', 'SEAGULL', 'TURTLE', 'STARFISH'];

export class BeachScene extends Phaser.Scene {
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
  private oceanBounds!: Phaser.Geom.Rectangle;
  private isInWater: boolean = false;
  private collectibles!: Phaser.Physics.Arcade.Group;
  private inventoryText!: Phaser.GameObjects.Text;
  
  private companionSystem!: CompanionSystem;
  private fetchSystem!: FetchSystem;
  private ridingSystem!: RidingSystem;
  private sleighRidingSystem!: SleighRidingSystem;
  private rideKey!: Phaser.Input.Keyboard.Key;

  constructor() {
    super({ key: SCENES.BEACH });
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

    // Initialize riding system
    this.ridingSystem = new RidingSystem(this);
    this.ridingSystem.init(this.player);
    // Add collider for dismounted horses
    this.ridingSystem.addCollider(this.trees);

    // Initialize sleigh riding system
    this.sleighRidingSystem = new SleighRidingSystem(this);
    this.sleighRidingSystem.init(this.player);

    // Hide companion if player is riding (restored from scene transition)
    if (this.ridingSystem.getIsRiding() || this.sleighRidingSystem.getIsRiding()) {
      this.companionSystem.setVisible(false);
    }

    this.createPets();
    this.createCollectibles();
    this.setupInput();

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(1.0);

    this.createUI();

    SoundManager.playMusic('beach');
  }

  update(): void {
    // Update gamepad state
    GamepadManager.update();

    if (this.isCatching) return;

    // Handle gamepad buttons
    this.handleGamepadButtons();

    const feetY = this.player.y + PLAYER_HEIGHT / 2 - 4;
    this.isInWater = this.oceanBounds.contains(this.player.x, feetY);

    this.handlePlayerMovement();
    this.handleFetchWithGamepad();
    this.handlePetBehavior();
    this.updateDepthSorting();
    this.companionSystem.update();
    this.fetchSystem.update();
    this.ridingSystem.update();
    this.sleighRidingSystem.update();
    this.checkExitZone();
  }

  private createWorld(): void {
    const worldWidth = 225;
    const worldHeight = 175;

    this.physics.world.setBounds(0, 0, worldWidth * TILE_SIZE, worldHeight * TILE_SIZE);

    // Create the beach layout: ocean on the right, sand on the left (scaled 5x)
    for (let y = 0; y < worldHeight; y++) {
      for (let x = 0; x < worldWidth; x++) {
        let tileType: string;

        if (x > 175) {
          // Deep ocean
          tileType = 'ocean';
        } else if (x > 150) {
          // Shallow water
          tileType = 'shallow_water';
        } else if (x > 40) {
          // Sandy beach
          tileType = Math.random() > 0.9 ? 'sand_shells' : 'sand';
        } else {
          // Grassy area near exit
          tileType = Math.random() > 0.9 ? 'grass_flower' : 'grass';
        }

        const tile = this.add.image(
          x * TILE_SIZE + TILE_SIZE / 2,
          y * TILE_SIZE + TILE_SIZE / 2,
          tileType
        );
        tile.setDepth(-10);
      }
    }

    // Ocean bounds (scaled)
    this.oceanBounds = new Phaser.Geom.Rectangle(
      155 * TILE_SIZE,
      0,
      70 * TILE_SIZE,
      worldHeight * TILE_SIZE
    );

    // Palm trees (~45 trees procedurally placed)
    this.trees = this.physics.add.staticGroup();
    const treeRandom = new Phaser.Math.RandomDataGenerator(['beach-trees']);
    for (let i = 0; i < 45; i++) {
      let x: number, y: number;
      let attempts = 0;
      do {
        x = treeRandom.integerInRange(45, 145);
        y = treeRandom.integerInRange(10, worldHeight - 15);
        attempts++;
      } while (
        attempts < 50 &&
        (x < 15 && y >= 75 && y <= 100) // Avoid exit zone
      );

      if (attempts < 50) {
        const treeWidth = TILE_SIZE * 4;
        const treeHeight = TILE_SIZE * 6;

        const tree = this.add.image(
          x * TILE_SIZE + treeWidth / 2,
          y * TILE_SIZE + treeHeight / 2,
          'palm_tree'
        );
        tree.setDepth(y * TILE_SIZE + treeHeight);

        const collider = this.trees.create(
          x * TILE_SIZE + treeWidth / 2,
          y * TILE_SIZE + treeHeight * 0.8,
          'sand'
        ) as Phaser.Physics.Arcade.Sprite;
        collider.setVisible(false);
        collider.setSize(treeWidth * 0.6, treeHeight * 0.2);
        collider.refreshBody();
      }
    }

    // Beach umbrellas (~15 umbrellas procedurally placed)
    const umbrellaRandom = new Phaser.Math.RandomDataGenerator(['beach-umbrellas']);
    for (let i = 0; i < 15; i++) {
      const x = umbrellaRandom.integerInRange(50, 140);
      const y = umbrellaRandom.integerInRange(15, worldHeight - 15);
      const umbrella = this.add.image(
        x * TILE_SIZE + TILE_SIZE / 2,
        y * TILE_SIZE + TILE_SIZE / 2,
        'beach_umbrella'
      );
      umbrella.setDepth(y * TILE_SIZE);
    }

    // Exit zone (path back to main world) - scaled position
    this.exitZone = this.add.zone(5 * TILE_SIZE, 85 * TILE_SIZE, TILE_SIZE * 4, TILE_SIZE * 6);
    this.physics.add.existing(this.exitZone, true);

    // Create path tiles leading to exit (wider path)
    for (let y = 75; y < 100; y++) {
      for (let x = 0; x < 10; x++) {
        const path = this.add.image(
          x * TILE_SIZE + TILE_SIZE / 2,
          y * TILE_SIZE + TILE_SIZE / 2,
          'path'
        );
        path.setDepth(-5);
      }
    }

    // Exit sign
    const exitText = this.add.text(5 * TILE_SIZE, 72 * TILE_SIZE, 'To World', {
      fontSize: '8px',
      color: '#ffffff',
      backgroundColor: '#2d2d44aa',
      padding: { x: 4, y: 2 },
    });
    exitText.setOrigin(0.5);
    exitText.setDepth(100);

    const arrow = this.add.text(5 * TILE_SIZE, 73 * TILE_SIZE, '◀', {
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

    // Add wave animation on the shore
    this.createWaveEffect();
  }

  private createWaveEffect(): void {
    // Create subtle wave lines at the water edge (scaled position)
    for (let y = 0; y < 175; y += 3) {
      const wave = this.add.rectangle(
        155 * TILE_SIZE,
        y * TILE_SIZE + TILE_SIZE,
        TILE_SIZE * 0.5,
        2,
        0xffffff,
        0.5
      );
      wave.setDepth(-4);

      this.tweens.add({
        targets: wave,
        x: wave.x - 8,
        alpha: 0,
        duration: 1500,
        repeat: -1,
        delay: (y % 35) * 100,
      });
    }
  }

  private createPlayer(): void {
    // Spawn near exit zone on scaled map
    this.player = this.physics.add.sprite(
      15 * TILE_SIZE + TILE_SIZE / 2,
      85 * TILE_SIZE + PLAYER_HEIGHT / 2,
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

    // Spawn beach pets on the sand (~45 pets procedurally placed)
    const worldHeight = 175;
    const spawnPositions: { x: number; y: number }[] = [];

    const petRandom = new Phaser.Math.RandomDataGenerator(['beach-pets']);
    for (let i = 0; i < 45; i++) {
      let x: number, y: number;
      let attempts = 0;
      do {
        x = petRandom.integerInRange(45, 145); // Beach area
        y = petRandom.integerInRange(10, worldHeight - 10);
        attempts++;
      } while (
        attempts < 50 &&
        (x < 15 && y >= 75 && y <= 100) // Avoid exit zone
      );
      if (attempts < 50) {
        spawnPositions.push({ x, y });
      }
    }

    spawnPositions.forEach(pos => {
      const petType = BEACH_PET_TYPES[Math.floor(Math.random() * BEACH_PET_TYPES.length)];
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
    if (!GamepadManager.isInitialized()) {
      GamepadManager.init(this);
    } else {
      GamepadManager.setScene(this);
    }

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

      // R key - Mount/dismount horse
      this.rideKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
      this.rideKey.on('down', () => this.handleRideToggle());

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

  private handleGamepadButtons(): void {
    // A button (0) - Interact
    if (GamepadManager.isButtonJustPressed(GAMEPAD_BUTTONS.A)) {
      this.tryInteract();
    }
    // Y button - Mount/dismount horse, or go to world if not near horse
    if (GamepadManager.isButtonJustPressed(GAMEPAD_BUTTONS.Y)) {
      if (this.ridingSystem.getIsRiding() || this.sleighRidingSystem.getIsRiding()) {
        this.handleRideToggle();
      } else {
        const nearestHorse = this.findNearestMountableHorse();
        if (nearestHorse) {
          this.handleRideToggle();
        } else {
          this.goToWorld();
        }
      }
    }
    // Start button - Open menu
    if (GamepadManager.isButtonJustPressed(GAMEPAD_BUTTONS.START)) {
      this.openMenu();
    }
  }

  private openMenu(): void {
    if (this.isCatching || this.isTransitioning) return;
    this.scene.pause();
    this.scene.launch(SCENES.MENU, { previousScene: SCENES.BEACH });
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

    const locationText = this.add.text(
      this.cameras.main.width - 16,
      16,
      'SUNNY BEACH',
      {
        fontSize: '10px',
        color: '#ffa500',
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

    // Inventory display
    this.inventoryText = this.add.text(16, 60, this.getInventoryText(), {
      fontSize: '10px',
      color: '#fbbf24',
      backgroundColor: '#2d2d44dd',
      padding: { x: 6, y: 3 },
    });
    this.inventoryText.setScrollFactor(0);
    this.inventoryText.setDepth(1000);
  }

  private getInventoryText(): string {
    const tools = InventoryManager.getTools();
    if (tools.length === 0) return 'Tools: None';
    const toolNames = tools.map(t => TOOL_INFO[t].name.split(' ')[0]).join(', ');
    return `Tools: ${toolNames}`;
  }

  private getPetCountText(): string {
    const count = PetManager.getPetCount();
    return `Pets: ${count}`;
  }

  private handlePlayerMovement(): void {
    let velocityX = 0;
    let velocityY = 0;
    let newDirection = this.playerDirection;

    // Calculate speed with terrain modifiers, riding, and run multiplier
    const isRunning = this.shiftKey?.isDown || GamepadManager.isButtonDown(GAMEPAD_BUTTONS.RB);
    let speed: number;
    if (this.ridingSystem.getIsRiding()) {
      speed = this.ridingSystem.getRidingSpeed(isRunning);
    } else if (this.sleighRidingSystem.getIsRiding()) {
      speed = this.sleighRidingSystem.getRidingSpeed(isRunning);
    } else {
      speed = this.isInWater ? PLAYER_SPEED * 0.6 : PLAYER_SPEED;
      if (isRunning) {
        speed *= PLAYER_RUN_MULTIPLIER;
      }
    }

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

    this.player.setVelocity(velocityX, velocityY);

    // Handle player animations using unified animator (skip when riding - RidingSystem handles it)
    const moving = velocityX !== 0 || velocityY !== 0;
    if (!this.ridingSystem.getIsRiding() && !this.sleighRidingSystem.getIsRiding()) {
      this.playerAnimator.updateAnimation(moving, velocityX, isRunning);
    }

    if (newDirection !== this.playerDirection) {
      this.playerDirection = newDirection;
      // PlayerAnimator handles texture changes automatically (or RidingSystem when riding)
    }
  }

  

  private handlePetBehavior(): void {
    const petSpeed = 20;

    this.pets.children.each((pet: Phaser.GameObjects.GameObject) => {
      const sprite = pet as Phaser.Physics.Arcade.Sprite;
      let timer = sprite.getData('wanderTimer') as number;

      timer -= this.game.loop.delta;

      if (timer <= 0) {
        // Crabs move sideways more often
        const petType = sprite.getData('petType') as string;
        let directions;

        if (petType === 'CRAB') {
          directions = [
            { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 1, y: 0 }, { x: -1, y: 0 },
            { x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
          ];
        } else {
          directions = [
            { x: 0, y: 0 }, { x: 1, y: 0 }, { x: -1, y: 0 },
            { x: 0, y: 1 }, { x: 0, y: -1 }, { x: 0, y: 0 },
          ];
        }

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

    // Handle riding system scene exit (dismounted horses return to home)
    this.ridingSystem.onSceneExit();
    this.sleighRidingSystem.onSceneExit();

    SoundManager.playClick();

    this.cameras.main.fadeOut(300, 0, 0, 0);

    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(SCENES.WORLD);
    });
  }

  private findNearestMountableHorse(): Phaser.Physics.Arcade.Sprite | null {
    // Check for dismounted horses nearby that can be mounted
    const dismountedHorse = this.ridingSystem.getDismountedHorseSprite();
    if (dismountedHorse) {
      const distance = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        dismountedHorse.x, dismountedHorse.y
      );
      if (distance < TILE_SIZE * 2) {
        return dismountedHorse;
      }
    }
    return null;
  }

  private handleRideToggle(): void {
    if (this.isCatching || this.isTransitioning) return;

    if (this.ridingSystem.getIsRiding()) {
      // Dismount horse
      this.ridingSystem.dismount();
      showCatchMessage(this, 'Dismounted horse', '#888888');
    } else if (this.sleighRidingSystem.getIsRiding()) {
      // Dismount sleigh
      this.sleighRidingSystem.dismount();
      showCatchMessage(this, 'Dismounted sleigh', '#888888');
    } else {
      // Try to mount
      const nearestHorse = this.findNearestMountableHorse();
      if (nearestHorse && this.ridingSystem.canMount(nearestHorse)) {
        this.ridingSystem.mount(nearestHorse);
        showCatchMessage(this, 'Mounted horse!', '#4ade80');
      } else {
        showCatchMessage(this, 'No horse nearby to mount', '#ef4444');
      }
    }
  }

  private createCollectibles(): void {
    this.collectibles = this.physics.add.group();

    // FISHING_ROD spawns at the beach (scaled position)
    const toolSpawns: { tool: ToolType; x: number; y: number }[] = [
      { tool: 'FISHING_ROD', x: 125, y: 60 },
    ];

    toolSpawns.forEach(spawn => {
      if (!InventoryManager.hasTool(spawn.tool)) {
        this.createCollectibleItem(spawn.tool, spawn.x, spawn.y);
      }
    });

    this.physics.add.overlap(this.player, this.collectibles, (_, item) => {
      this.collectItem(item as Phaser.Physics.Arcade.Sprite);
    });
  }

  private createCollectibleItem(tool: ToolType, tileX: number, tileY: number): void {
    const x = tileX * TILE_SIZE + TILE_SIZE / 2;
    const y = tileY * TILE_SIZE + TILE_SIZE / 2;

    const toolSprite = this.collectibles.create(x, y, `tool_${tool.toLowerCase()}`) as Phaser.Physics.Arcade.Sprite;
    toolSprite.setData('toolType', tool);
    toolSprite.setDepth(tileY * TILE_SIZE);

    const sparkle = this.add.image(x, y, 'collectible_sparkle');
    sparkle.setDepth(tileY * TILE_SIZE - 1);
    sparkle.setAlpha(0.6);

    this.tweens.add({ targets: sparkle, angle: 360, duration: 3000, repeat: -1, ease: 'Linear' });
    this.tweens.add({ targets: sparkle, scale: 1.3, alpha: 0.3, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: toolSprite, y: y - 4, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    toolSprite.setData('sparkle', sparkle);
  }

  private collectItem(item: Phaser.Physics.Arcade.Sprite): void {
    const toolType = item.getData('toolType') as ToolType;
    const sparkle = item.getData('sparkle') as Phaser.GameObjects.Image;

    if (InventoryManager.addTool(toolType)) {
      SoundManager.playSuccess();
      const toolInfo = TOOL_INFO[toolType];
      this.showCollectMessage(`Found ${toolInfo.name}!`, toolInfo.color);
      this.inventoryText.setText(this.getInventoryText());

      if (sparkle) { this.tweens.killTweensOf(sparkle); sparkle.destroy(); }
      this.tweens.add({
        targets: item, y: item.y - 20, alpha: 0, scale: 1.5, duration: 300,
        ease: 'Back.easeOut', onComplete: () => item.destroy(),
      });
    }
  }

  private showCollectMessage(text: string, color: number): void {
    const hexColor = '#' + color.toString(16).padStart(6, '0');
    const message = this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2 - 40, text, {
      fontSize: '12px', color: hexColor, backgroundColor: '#2d2d44ee', padding: { x: 10, y: 6 },
    });
    message.setOrigin(0.5).setScrollFactor(0).setDepth(2000).setAlpha(0).setScale(0.5);

    this.tweens.add({ targets: message, alpha: 1, scale: 1, duration: 200, ease: 'Back.easeOut' });
    this.tweens.add({ targets: message, alpha: 0, y: message.y - 30, duration: 500, delay: 1500, ease: 'Quad.easeIn', onComplete: () => message.destroy() });
  }
}
