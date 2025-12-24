import Phaser from 'phaser';
import { SCENES, TILE_SIZE, PLAYER_SPEED, PLAYER_RUN_MULTIPLIER, PLAYER_HEIGHT, isChristmasSeason } from '../utils/constants';
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

export class MountainScene extends Phaser.Scene {
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private boulders!: Phaser.Physics.Arcade.StaticGroup;
  private cliffs!: Phaser.Physics.Arcade.StaticGroup;
  private pets!: Phaser.Physics.Arcade.Group;
  private playerAnimator!: PlayerAnimator;
  private eagles!: Phaser.Physics.Arcade.Group;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private infoText!: Phaser.GameObjects.Text;
  private petCountText!: Phaser.GameObjects.Text;
  private playerDirection: string = 'down';

  private catchingUI!: CatchingUI;
  private isCatching: boolean = false;
  private targetPet: Phaser.Physics.Arcade.Sprite | null = null;
  private exitZone!: Phaser.GameObjects.Zone;
  private isTransitioning: boolean = false;
  private windParticles: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private collectibles!: Phaser.Physics.Arcade.Group;
  private inventoryText!: Phaser.GameObjects.Text;
  
  private companionSystem!: CompanionSystem;
  private fetchSystem!: FetchSystem;
  private ridingSystem!: RidingSystem;
  private rideKey!: Phaser.Input.Keyboard.Key;

  constructor() {
    super({ key: SCENES.MOUNTAIN });
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
      this.companionSystem.addCollider(this.boulders);
      this.companionSystem.addCollider(this.cliffs);
    }

    // Initialize fetch system
    this.fetchSystem = new FetchSystem(this, this.player);
    this.fetchSystem.setCompanion(this.companionSystem.getSprite());
    this.companionSystem.setFetchSystem(this.fetchSystem);

    // Initialize riding system
    this.ridingSystem = new RidingSystem(this);
    this.ridingSystem.init(this.player);

    // Hide companion if player is riding (restored from scene transition)
    if (this.ridingSystem.getIsRiding()) {
      this.companionSystem.setVisible(false);
    }

    // Add colliders for dismounted horse if one exists
    const dismountedHorse = this.ridingSystem.getDismountedHorseSprite();
    if (dismountedHorse) {
      this.physics.add.collider(dismountedHorse, this.boulders);
      this.physics.add.collider(dismountedHorse, this.cliffs);
    }

    this.createPets();
    this.createEagles();
    this.createCollectibles();
    this.setupInput();

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(1.0);

    this.createUI();
    this.createWindEffect();

    // Christmas snowfall effect (Dec 1 - Jan 6)
    if (isChristmasSeason()) {
      this.createChristmasSnowfall();
    }

    SoundManager.playMusic('mountain');
  }

  update(): void {
    // Update gamepad state
    GamepadManager.update();

    if (this.isCatching) return;

    // Handle gamepad buttons
    this.handleGamepadButtons();

    this.handlePlayerMovement();
    this.handleFetchWithGamepad();
    this.handlePetBehavior();
    this.handleEagleBehavior();
    this.updateDepthSorting();
    this.companionSystem.update();
    this.fetchSystem.update();
    this.ridingSystem.update();
    this.checkExitZone();
  }

  private createWorld(): void {
    const worldWidth = 225;
    const worldHeight = 175;

    this.physics.world.setBounds(0, 0, worldWidth * TILE_SIZE, worldHeight * TILE_SIZE);

    // Rocky ground with level-based color variation
    for (let y = 0; y < worldHeight; y++) {
      for (let x = 0; x < worldWidth; x++) {
        const rockType = Math.random() > 0.8 ? 'rock_pebbles' : 'rock';
        const tile = this.add.image(
          x * TILE_SIZE + TILE_SIZE / 2,
          y * TILE_SIZE + TILE_SIZE / 2,
          rockType
        );
        tile.setDepth(-10);
        // Slight tint variation by level
        if (y < 50) {
          tile.setTint(0xcccccc); // Level 2 (high) - lighter
        } else if (y < 110) {
          tile.setTint(0xbbbbbb); // Level 1 (mid)
        }
        // Level 0 keeps default color
      }
    }

    // Create terrain levels with cliffs
    this.createTerrainLevels(worldWidth);

    // Mountain paths (connecting stairs)
    this.createMountainPaths();

    // Cliff walls along the very top (decorative)
    for (let x = 0; x < worldWidth; x++) {
      for (let y = 0; y < 15; y++) {
        const cliff = this.add.image(
          x * TILE_SIZE + TILE_SIZE / 2,
          y * TILE_SIZE + TILE_SIZE / 2,
          'cliff'
        );
        cliff.setDepth(-5);
      }
    }

    // Mountain peaks in background (~15 peaks on upper level)
    const peakRandom = new Phaser.Math.RandomDataGenerator(['mountain-peaks']);
    for (let i = 0; i < 15; i++) {
      const x = peakRandom.integerInRange(10, worldWidth - 10);
      const y = peakRandom.integerInRange(2, 12);
      const peak = this.add.image(
        x * TILE_SIZE + TILE_SIZE * 1.5,
        y * TILE_SIZE + TILE_SIZE,
        'mountain_peak'
      );
      peak.setDepth(-8);
      peak.setAlpha(0.7);
    }

    // Stair locations (gaps in cliffs) - 12 stairs per cliff
    const stairsCliff1 = [15, 33, 51, 69, 87, 105, 123, 141, 159, 177, 195, 213]; // x positions for cliff at y=50
    const stairsCliff2 = [24, 42, 60, 78, 96, 114, 132, 150, 168, 186, 204, 220]; // x positions for cliff at y=110
    const stairWidth = 8;

    // Boulders as obstacles (~45 boulders avoiding stairs and cliffs)
    this.boulders = this.physics.add.staticGroup();
    const boulderRandom = new Phaser.Math.RandomDataGenerator(['mountain-boulders']);
    for (let i = 0; i < 45; i++) {
      let x: number, y: number;
      let attempts = 0;
      do {
        x = boulderRandom.integerInRange(10, worldWidth - 10);
        y = boulderRandom.integerInRange(20, worldHeight - 10);
        attempts++;
      } while (
        attempts < 50 &&
        (
          // Avoid exit zone
          (x < 15 && y >= 115 && y <= 140) ||
          // Avoid cave area (now on upper level)
          (x >= 95 && x <= 115 && y >= 20 && y <= 35) ||
          // Avoid cliff zones (y=48-58 and y=108-118 for 6-tile high cliffs)
          (y >= 48 && y <= 58) ||
          (y >= 108 && y <= 118) ||
          // Avoid stair areas on cliff 1 (expanded for taller cliffs)
          (y >= 45 && y <= 60 && stairsCliff1.some(sx => x >= sx - 2 && x <= sx + stairWidth + 2)) ||
          // Avoid stair areas on cliff 2 (expanded for taller cliffs)
          (y >= 105 && y <= 120 && stairsCliff2.some(sx => x >= sx - 2 && x <= sx + stairWidth + 2))
        )
      );

      if (attempts < 50) {
        const boulder = this.add.image(
          x * TILE_SIZE + TILE_SIZE,
          y * TILE_SIZE + TILE_SIZE,
          'boulder'
        );
        boulder.setDepth(y * TILE_SIZE + TILE_SIZE * 2);

        const collider = this.boulders.create(
          x * TILE_SIZE + TILE_SIZE,
          y * TILE_SIZE + TILE_SIZE * 1.3,
          'rock'
        ) as Phaser.Physics.Arcade.Sprite;
        collider.setVisible(false);
        collider.setSize(28, 14);
        collider.refreshBody();
      }
    }

    // Cave entrance decoration (on upper level)
    const caveX = 105;
    const caveY = 25;
    const cave = this.add.image(
      caveX * TILE_SIZE + TILE_SIZE,
      caveY * TILE_SIZE + TILE_SIZE,
      'cave'
    );
    cave.setDepth(caveY * TILE_SIZE);

    // Cave collider
    const caveCollider = this.boulders.create(
      caveX * TILE_SIZE + TILE_SIZE,
      caveY * TILE_SIZE + TILE_SIZE,
      'rock'
    ) as Phaser.Physics.Arcade.Sprite;
    caveCollider.setVisible(false);
    caveCollider.setSize(32, 32);
    caveCollider.refreshBody();

    // Exit zone (path back to main world) - on Level 0 (base level)
    this.exitZone = this.add.zone(5 * TILE_SIZE, 130 * TILE_SIZE, TILE_SIZE * 4, TILE_SIZE * 6);

    // Exit sign
    const exitText = this.add.text(5 * TILE_SIZE, 127 * TILE_SIZE, 'To World', {
      fontSize: '8px',
      color: '#ffffff',
      backgroundColor: '#2d2d44aa',
      padding: { x: 4, y: 2 },
    });
    exitText.setOrigin(0.5);
    exitText.setDepth(100);

    const arrow = this.add.text(5 * TILE_SIZE, 128 * TILE_SIZE, '◀', {
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

    // Path tiles leading to exit (on Level 0)
    for (let y = 120; y < 145; y++) {
      for (let x = 0; x < 10; x++) {
        const path = this.add.image(
          x * TILE_SIZE + TILE_SIZE / 2,
          y * TILE_SIZE + TILE_SIZE / 2,
          'mountain_path'
        );
        path.setDepth(-5);
      }
    }
  }

  private createTerrainLevels(worldWidth: number): void {
    // Create cliff collision group
    this.cliffs = this.physics.add.staticGroup();

    // Stair locations (gaps in cliffs) - 12 stairs per cliff
    const stairsCliff1 = [15, 33, 51, 69, 87, 105, 123, 141, 159, 177, 195, 213]; // x positions for cliff at y=50
    const stairsCliff2 = [24, 42, 60, 78, 96, 114, 132, 150, 168, 186, 204, 220]; // x positions for cliff at y=110
    const stairWidth = 8;
    const cliffHeight = 6; // Visual cliff height in tiles

    // Cliff 1: Between Level 2 (high) and Level 1 (mid) at y=50
    for (let x = 0; x < worldWidth; x++) {
      // Check if this x position is a stair gap
      const isStair1 = stairsCliff1.some(sx => x >= sx && x < sx + stairWidth);

      if (!isStair1) {
        // Render cliff face tiles
        for (let cy = 0; cy < cliffHeight; cy++) {
          const cliffTile = this.add.image(
            x * TILE_SIZE + TILE_SIZE / 2,
            (50 + cy) * TILE_SIZE + TILE_SIZE / 2,
            'cliff'
          );
          cliffTile.setDepth(-3);
          cliffTile.setTint(0x666666); // Darker for cliff face
        }

        // Add collision body (spans all cliff height)
        const collider = this.cliffs.create(
          x * TILE_SIZE + TILE_SIZE / 2,
          50 * TILE_SIZE + TILE_SIZE,
          'rock'
        ) as Phaser.Physics.Arcade.Sprite;
        collider.setVisible(false);
        collider.setSize(TILE_SIZE, cliffHeight * TILE_SIZE);
        collider.refreshBody();
      } else {
        // Render stair/ramp path tiles
        for (let cy = 0; cy < cliffHeight + 2; cy++) {
          const stairTile = this.add.image(
            x * TILE_SIZE + TILE_SIZE / 2,
            (49 + cy) * TILE_SIZE + TILE_SIZE / 2,
            'mountain_path'
          );
          stairTile.setDepth(-4);
        }
      }
    }

    // Cliff 2: Between Level 1 (mid) and Level 0 (low) at y=110
    for (let x = 0; x < worldWidth; x++) {
      // Check if this x position is a stair gap
      const isStair2 = stairsCliff2.some(sx => x >= sx && x < sx + stairWidth);

      if (!isStair2) {
        // Render cliff face tiles
        for (let cy = 0; cy < cliffHeight; cy++) {
          const cliffTile = this.add.image(
            x * TILE_SIZE + TILE_SIZE / 2,
            (110 + cy) * TILE_SIZE + TILE_SIZE / 2,
            'cliff'
          );
          cliffTile.setDepth(-3);
          cliffTile.setTint(0x666666); // Darker for cliff face
        }

        // Add collision body
        const collider = this.cliffs.create(
          x * TILE_SIZE + TILE_SIZE / 2,
          110 * TILE_SIZE + TILE_SIZE,
          'rock'
        ) as Phaser.Physics.Arcade.Sprite;
        collider.setVisible(false);
        collider.setSize(TILE_SIZE, cliffHeight * TILE_SIZE);
        collider.refreshBody();
      } else {
        // Render stair/ramp path tiles
        for (let cy = 0; cy < cliffHeight + 2; cy++) {
          const stairTile = this.add.image(
            x * TILE_SIZE + TILE_SIZE / 2,
            (109 + cy) * TILE_SIZE + TILE_SIZE / 2,
            'mountain_path'
          );
          stairTile.setDepth(-4);
        }
      }
    }
  }

  private createMountainPaths(): void {
    // Stair locations (12 stairs per cliff)
    const stairsCliff1 = [15, 33, 51, 69, 87, 105, 123, 141, 159, 177, 195, 213];
    const stairsCliff2 = [24, 42, 60, 78, 96, 114, 132, 150, 168, 186, 204, 220];

    const pathTiles: { x: number; y: number }[] = [];

    // Level 2 (High) - main horizontal path
    for (let i = 0; i < 200; i++) {
      pathTiles.push({ x: 10 + i, y: 35 });
    }
    // Vertical paths from Level 2 to Cliff 1 stairs
    stairsCliff1.forEach(stairX => {
      for (let i = 0; i < 18; i++) {
        pathTiles.push({ x: stairX + 4, y: 35 + i });
      }
    });

    // Level 1 (Mid) - main horizontal path
    for (let i = 0; i < 200; i++) {
      pathTiles.push({ x: 10 + i, y: 80 });
    }
    // Vertical paths from Cliff 1 stairs to Level 1
    stairsCliff1.forEach(stairX => {
      for (let i = 0; i < 22; i++) {
        pathTiles.push({ x: stairX + 4, y: 58 + i });
      }
    });
    // Vertical paths from Level 1 to Cliff 2 stairs
    stairsCliff2.forEach(stairX => {
      for (let i = 0; i < 28; i++) {
        pathTiles.push({ x: stairX + 4, y: 85 + i });
      }
    });

    // Level 0 (Low) - main horizontal path
    for (let i = 0; i < 200; i++) {
      pathTiles.push({ x: 10 + i, y: 140 });
    }
    // Vertical paths from Cliff 2 stairs to Level 0
    stairsCliff2.forEach(stairX => {
      for (let i = 0; i < 22; i++) {
        pathTiles.push({ x: stairX + 4, y: 118 + i });
      }
    });

    pathTiles.forEach(pos => {
      const path = this.add.image(
        pos.x * TILE_SIZE + TILE_SIZE / 2,
        pos.y * TILE_SIZE + TILE_SIZE / 2,
        'mountain_path'
      );
      path.setDepth(-8);
    });
  }

  private createPlayer(): void {
    // Spawn on Level 0 (base level) near exit zone
    this.player = this.physics.add.sprite(
      15 * TILE_SIZE + TILE_SIZE / 2,
      130 * TILE_SIZE + PLAYER_HEIGHT / 2,
      'player_right'
    ) as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;

    // Scale will be set by PlayerAnimator

    this.player.setSize(800, 400);
    this.player.setOffset(400, 2400);
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(this.player.y);

    this.physics.add.collider(this.player, this.boulders);
    this.physics.add.collider(this.player, this.cliffs);
  }

  private createPets(): void {
    this.pets = this.physics.add.group();

    // Spawn ground mountain pets (~40 pets distributed across all levels)
    const groundPetTypes = ['GOAT', 'FOX', 'BEAR_CUB', 'HORSE'];
    const worldWidth = 225;
    const spawnPositions: { x: number; y: number }[] = [];

    const petRandom = new Phaser.Math.RandomDataGenerator(['mountain-pets']);

    // Spawn ~13 pets per level
    // Level 2 (High): y = 18-47
    for (let i = 0; i < 13; i++) {
      let x: number, y: number;
      let attempts = 0;
      do {
        x = petRandom.integerInRange(20, worldWidth - 10);
        y = petRandom.integerInRange(18, 47);
        attempts++;
      } while (
        attempts < 50 &&
        (x >= 95 && x <= 115 && y >= 20 && y <= 35) // Avoid cave
      );
      if (attempts < 50) spawnPositions.push({ x, y });
    }

    // Level 1 (Mid): y = 55-107
    for (let i = 0; i < 14; i++) {
      let x: number, y: number;
      let attempts = 0;
      do {
        x = petRandom.integerInRange(20, worldWidth - 10);
        y = petRandom.integerInRange(55, 107);
        attempts++;
      } while (attempts < 50);
      if (attempts < 50) spawnPositions.push({ x, y });
    }

    // Level 0 (Low): y = 115-165
    for (let i = 0; i < 13; i++) {
      let x: number, y: number;
      let attempts = 0;
      do {
        x = petRandom.integerInRange(20, worldWidth - 10);
        y = petRandom.integerInRange(115, 165);
        attempts++;
      } while (
        attempts < 50 &&
        (x < 15 && y >= 120 && y <= 145) // Avoid exit zone
      );
      if (attempts < 50) spawnPositions.push({ x, y });
    }

    spawnPositions.forEach(pos => {
      const petType = groundPetTypes[Math.floor(Math.random() * groundPetTypes.length)];
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

    this.physics.add.collider(this.pets, this.boulders);
    this.physics.add.collider(this.pets, this.cliffs);
    this.physics.add.collider(this.pets, this.pets);
  }

  private createEagles(): void {
    this.eagles = this.physics.add.group();

    // Eagles fly around the mountain (~25 eagles procedurally placed)
    const worldWidth = 225;
    const worldHeight = 175;
    const eaglePositions: { x: number; y: number }[] = [];

    const eagleRandom = new Phaser.Math.RandomDataGenerator(['mountain-eagles']);
    for (let i = 0; i < 25; i++) {
      const x = eagleRandom.integerInRange(15, worldWidth - 15);
      const y = eagleRandom.integerInRange(20, worldHeight - 20);
      eaglePositions.push({ x, y });
    }

    eaglePositions.forEach(pos => {
      const eagle = this.eagles.create(
        pos.x * TILE_SIZE + TILE_SIZE / 2,
        pos.y * TILE_SIZE + TILE_SIZE / 2,
        getSpriteKey('eagle', true)
      ) as Phaser.Physics.Arcade.Sprite;

      eagle.setCollideWorldBounds(true);
      eagle.setData('petType', 'EAGLE');
      eagle.setData('flyTimer', Math.random() * 1000);
      eagle.setData('flyDirection', { x: 0, y: 0 });
      eagle.setData('baseY', pos.y * TILE_SIZE + TILE_SIZE / 2);
      eagle.setDepth(1000); // Eagles fly above everything

      // Apply sprite configuration from centralized config
      applyPetSpriteConfig(eagle, 'eagle');

      // Soaring animation (gentle bob)
      this.tweens.add({
        targets: eagle,
        y: eagle.y - 8,
        duration: 1500 + Math.random() * 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });
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

      // ESC key - Open menu
      const menuKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
      menuKey.on('down', () => {
        if (!this.isCatching) {
          this.openMenu();
        }
      });

      // R key for mounting/dismounting horse
      this.rideKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
      this.rideKey.on('down', () => {
        if (!this.isCatching && !this.isTransitioning) {
          this.handleRideToggle();
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
    // Y button (3) - Mount/Dismount horse if applicable, else go to World
    if (GamepadManager.isButtonJustPressed(GAMEPAD_BUTTONS.Y)) {
      if (this.ridingSystem.getIsRiding()) {
        this.handleRideToggle();
      } else {
        const nearHorse = this.findNearestMountableHorse();
        if (nearHorse) {
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
    this.scene.launch(SCENES.MENU, { previousScene: SCENES.MOUNTAIN });
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

    // Location indicator
    const locationText = this.add.text(
      this.cameras.main.width - 16,
      16,
      'MOUNTAIN',
      {
        fontSize: '10px',
        color: '#9e9e9e',
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

  private createWindEffect(): void {
    // Create dust/wind particle
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0xbcaaa4, 0.5);
    g.fillRect(0, 0, 3, 1);
    g.generateTexture('dust', 3, 1);
    g.destroy();

    // Horizontal wind particles
    this.windParticles = this.add.particles(0, 0, 'dust', {
      x: -10,
      y: { min: 0, max: this.cameras.main.height },
      lifespan: 3000,
      speedX: { min: 60, max: 100 },
      speedY: { min: -5, max: 5 },
      scale: { min: 0.5, max: 1.5 },
      alpha: { start: 0.5, end: 0 },
      frequency: 200,
    });
    this.windParticles.setScrollFactor(0);
    this.windParticles.setDepth(998);
  }

  private getPetCountText(): string {
    const count = PetManager.getPetCount();
    return `Pets: ${count}`;
  }

  private handlePlayerMovement(): void {
    let velocityX = 0;
    let velocityY = 0;
    let newDirection = this.playerDirection;

    // Check running/galloping state
    const isRunning = this.shiftKey?.isDown || GamepadManager.isButtonDown(GAMEPAD_BUTTONS.RB);

    // Determine speed based on riding state
    let speed: number;
    if (this.ridingSystem.getIsRiding()) {
      speed = this.ridingSystem.getRidingSpeed(isRunning);
    } else {
      speed = PLAYER_SPEED;
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

    // Handle player animations
    const moving = velocityX !== 0 || velocityY !== 0;

    // Only use PlayerAnimator when not riding - RidingSystem handles riding sprites
    if (!this.ridingSystem.getIsRiding()) {
      this.playerAnimator.updateAnimation(moving, velocityX, isRunning);
    }

    if (newDirection !== this.playerDirection) {
      this.playerDirection = newDirection;
      // PlayerAnimator handles texture changes automatically
    }
  }

  

  private handlePetBehavior(): void {
    const petSpeed = 22;

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

  private handleEagleBehavior(): void {
    const flySpeed = 40;

    this.eagles.children.each((eagle: Phaser.GameObjects.GameObject) => {
      const sprite = eagle as Phaser.Physics.Arcade.Sprite;
      let timer = sprite.getData('flyTimer') as number;

      timer -= this.game.loop.delta;

      if (timer <= 0) {
        // Eagles soar in circular patterns
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() > 0.2 ? 1 : 0;

        sprite.setData('flyDirection', {
          x: Math.cos(angle) * speed,
          y: Math.sin(angle) * speed * 0.3, // Mostly horizontal movement
        });
        sprite.setData('flyTimer', 800 + Math.random() * 1200);
      } else {
        sprite.setData('flyTimer', timer);
      }

      const dir = sprite.getData('flyDirection') as { x: number; y: number };
      sprite.setVelocityX(dir.x * flySpeed);
      // Don't set Y velocity - let the tween handle vertical bobbing

      // Handle sprite direction flipping using centralized config
      updatePetSpriteDirection(sprite, 'eagle', dir.x);

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
    let nearestDistance = TILE_SIZE * 2.5;

    // Check ground pets
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

    // Check eagles (slightly larger range since they fly)
    this.eagles.children.each((eagle: Phaser.GameObjects.GameObject) => {
      const sprite = eagle as Phaser.Physics.Arcade.Sprite;
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

  private findNearestMountableHorse(): Phaser.Physics.Arcade.Sprite | null {
    // Check dismounted horse first
    const dismountedSprite = this.ridingSystem.getDismountedHorseSprite();
    if (dismountedSprite) {
      const distance = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        dismountedSprite.x, dismountedSprite.y
      );
      if (distance < TILE_SIZE * 3) {
        return dismountedSprite;
      }
    }
    return null;
  }

  private handleRideToggle(): void {
    if (this.ridingSystem.getIsRiding()) {
      // Dismount
      const horse = this.ridingSystem.dismount();
      if (horse) {
        showCatchMessage(this, 'Dismounted horse', '#888888');
        SoundManager.playClick();
        // Reinitialize player animator to restore proper scale
        this.playerAnimator = new PlayerAnimator(this, this.player);
        // Show companion again
        this.companionSystem.setVisible(true);
        // Add collider for dismounted horse
        this.physics.add.collider(horse, this.boulders);
        this.physics.add.collider(horse, this.cliffs);
      }
    } else {
      // Try to mount nearby horse
      const nearHorse = this.findNearestMountableHorse();
      if (nearHorse && this.ridingSystem.canMount(nearHorse)) {
        if (this.ridingSystem.mount(nearHorse)) {
          showCatchMessage(this, 'Mounted horse!', '#4ade80');
          SoundManager.playSuccess();
          // Hide companion while riding
          this.companionSystem.setVisible(false);
        }
      } else {
        showCatchMessage(this, 'No horse nearby to mount', '#ef4444');
      }
    }
  }

  private goToWorld(): void {
    if (this.isCatching || this.isTransitioning) return;
    this.isTransitioning = true;

    // Handle dismounted horse on scene exit
    this.ridingSystem.onSceneExit();

    SoundManager.playClick();

    this.cameras.main.fadeOut(300, 0, 0, 0);

    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(SCENES.WORLD);
    });
  }

  private createCollectibles(): void {
    this.collectibles = this.physics.add.group();

    // TREATS spawns in mountains - good for luring bear cubs (scaled position)
    if (!InventoryManager.hasTool('TREATS')) {
      this.createCollectibleItem(125, 75, 'TREATS');
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

  private createChristmasSnowfall(): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0xffffff, 0.8);
    g.fillRect(0, 0, 2, 2);
    g.generateTexture('snowflake', 2, 2);
    g.destroy();

    const snowflakes = this.add.particles(0, 0, 'snowflake', {
      x: { min: 0, max: this.cameras.main.width },
      y: -10,
      lifespan: 8000,
      speedY: { min: 30, max: 60 },
      speedX: { min: -10, max: 10 },
      scale: { min: 0.5, max: 1 },
      alpha: { start: 0.8, end: 0 },
      frequency: 40,
      blendMode: 'ADD',
    });
    snowflakes.setScrollFactor(0);
    snowflakes.setDepth(999);

    // Add snow accumulation effects
    this.createSnowAccumulation();
    this.createSurfaceSnow();
  }

  private createSnowAccumulation(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    const snowOverlay = this.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      0xffffff,
      0
    );
    snowOverlay.setScrollFactor(0);
    snowOverlay.setDepth(-9);

    this.tweens.add({
      targets: snowOverlay,
      fillAlpha: 0.9,
      duration: 120000,
      ease: 'Sine.easeOut'
    });
  }

  private createSurfaceSnow(): void {
    // Create snow cap texture
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0xffffff, 0.9);
    g.fillEllipse(16, 4, 32, 8);
    g.generateTexture('snow_cap', 32, 8);
    g.destroy();

    // Add snow caps to boulders
    this.boulders.children.each((boulder: Phaser.GameObjects.GameObject) => {
      const sprite = boulder as Phaser.Physics.Arcade.Sprite;
      const snowCap = this.add.image(sprite.x, sprite.y - 10, 'snow_cap');
      snowCap.setDepth(sprite.depth + 1);
      snowCap.setAlpha(0);

      this.tweens.add({
        targets: snowCap,
        alpha: 1,
        duration: 60000,
        delay: Math.random() * 30000,
        ease: 'Sine.easeOut'
      });
      return true;
    });
  }
}
