import Phaser from 'phaser';
import { SCENES, TILE_SIZE, PLAYER_SPEED, PLAYER_RUN_MULTIPLIER, PLAYER_HEIGHT, PET_TYPES, isChristmasSeason } from '../utils/constants';
import { PLAYER_CONFIG } from '../systems/PlayerConfig';
import { CatchingUI, type CatchResult } from '../ui/CatchingUI';
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

export class WorldScene extends Phaser.Scene {
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private trees!: Phaser.Physics.Arcade.StaticGroup;
  private pets!: Phaser.Physics.Arcade.Group;
  private butterflies!: Phaser.Physics.Arcade.Group;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private infoText!: Phaser.GameObjects.Text;
  private petCountText!: Phaser.GameObjects.Text;
  private playerDirection: string = 'down';

  private catchingUI!: CatchingUI;
  private isCatching: boolean = false;
  private targetPet: Phaser.Physics.Arcade.Sprite | null = null;
  private homeZone!: Phaser.GameObjects.Zone;
  private snowZone!: Phaser.GameObjects.Zone;
  private beachZone!: Phaser.GameObjects.Zone;
  private mountainZone!: Phaser.GameObjects.Zone;
  private jungleZone!: Phaser.GameObjects.Zone;
  private isTransitioning: boolean = false;
  private waterBounds!: Phaser.Geom.Rectangle;
  private bridgeBounds!: Phaser.Geom.Rectangle;
  private isInWater: boolean = false;
  private splashTimer: number = 0;
  private collectibles!: Phaser.Physics.Arcade.Group;
  private inventoryText!: Phaser.GameObjects.Text;
  private playerAnimator!: PlayerAnimator;
  private companionSystem!: CompanionSystem;
  private fetchSystem!: FetchSystem;
  private ridingSystem!: RidingSystem;
  private rideKey!: Phaser.Input.Keyboard.Key;

  constructor() {
    super({ key: SCENES.WORLD });
  }

  create(): void {
    // Reset transition state
    this.isTransitioning = false;
    this.isCatching = false;

    // Create the catching UI
    this.catchingUI = new CatchingUI(this);

    // Create the world background
    this.createWorld();

    // Create the player
    this.createPlayer();

    // Initialize player animator
    this.playerAnimator = new PlayerAnimator(this, this.player);

    // Initialize companion system
    this.companionSystem = new CompanionSystem(this);
    this.companionSystem.init(this.player);
    if (this.companionSystem.hasCompanion()) {
      this.companionSystem.addCollider(this.trees);
    }

    // Initialize fetch system (for playing fetch with puppy companion)
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
      this.physics.add.collider(dismountedHorse, this.trees);
    }

    // Add overlap detection for home zone entry
    this.physics.add.overlap(this.player, this.homeZone, () => this.goHome());

    // Add overlap detection for snow zone entry
    this.physics.add.overlap(this.player, this.snowZone, () => this.goToSnow());

    // Add overlap detection for beach zone entry
    this.physics.add.overlap(this.player, this.beachZone, () => this.goToBeach());

    // Add overlap detection for mountain zone entry
    this.physics.add.overlap(this.player, this.mountainZone, () => this.goToMountain());

    // Add overlap detection for jungle zone entry
    this.physics.add.overlap(this.player, this.jungleZone, () => this.goToJungle());

    // Create some pets wandering around
    this.createPets();

    // Create butterflies
    this.createButterflies();

    // Create collectible items
    this.createCollectibles();

    // Set up input
    this.setupInput();

    // Set up camera for 16px art
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(1.0);

    // Create UI
    this.createUI();

    // Christmas snowfall effect (Dec 1 - Jan 6)
    if (isChristmasSeason()) {
      this.createChristmasSnowfall();
    }

    // Start world music
    SoundManager.playMusic('world');
  }

  update(_time: number, delta: number): void {
    // Update gamepad state for button detection
    GamepadManager.update();

    // Don't update gameplay while catching
    if (this.isCatching) return;

    // Check gamepad buttons
    this.handleGamepadButtons();

    // Check if player is in water (but not on the bridge)
    // Use feet position (bottom of sprite) for accurate detection
    const feetY = this.player.y + PLAYER_HEIGHT / 2 - 4;
    const wasInWater = this.isInWater;
    const inWaterArea = this.waterBounds.contains(this.player.x, feetY);
    const onBridge = this.bridgeBounds.contains(this.player.x, feetY);
    this.isInWater = inWaterArea && !onBridge;

    this.handlePlayerMovement();
    this.handlePetBehavior();
    this.handleButterflyBehavior();
    this.updateDepthSorting();
    this.companionSystem.update();
    this.fetchSystem.update();
    this.ridingSystem.update();

    // Handle water effects
    this.handleWaterEffects(delta, wasInWater);

    // Handle right stick for fetch aiming
    this.handleFetchWithGamepad();
  }

  private handleGamepadButtons(): void {
    // A button (0) - Interact
    if (GamepadManager.isButtonJustPressed(GAMEPAD_BUTTONS.A)) {
      this.handleInteraction();
    }

    // Y button (3) - Mount/Dismount horse if applicable, else Go Home
    if (GamepadManager.isButtonJustPressed(GAMEPAD_BUTTONS.Y)) {
      if (this.ridingSystem.getIsRiding()) {
        this.handleRideToggle();
      } else {
        const nearHorse = this.findNearestMountableHorse();
        if (nearHorse) {
          this.handleRideToggle();
        } else {
          this.goHome();
        }
      }
    }

    // Start button - Open menu
    if (GamepadManager.isButtonJustPressed(GAMEPAD_BUTTONS.START)) {
      this.openMenu();
    }
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
    // Info text
    this.infoText = this.add.text(16, 16, 'WASD move | SPACE catch | H home | R ride', {
      fontSize: '10px',
      color: '#ffffff',
      backgroundColor: '#2d2d44dd',
      padding: { x: 6, y: 3 },
    });
    this.infoText.setScrollFactor(0);
    this.infoText.setDepth(1000);

    // Pet count
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
      'WORLD',
      {
        fontSize: '10px',
        color: '#60a5fa',
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
    if (tools.length === 0) {
      return 'Tools: None';
    }
    const toolNames = tools.map(t => TOOL_INFO[t].name.split(' ')[0]).join(', ');
    return `Tools: ${toolNames}`;
  }

  private updateInventoryUI(): void {
    this.inventoryText.setText(this.getInventoryText());

    // Flash animation
    this.tweens.add({
      targets: this.inventoryText,
      scale: 1.2,
      duration: 100,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  private getPetCountText(): string {
    const count = PetManager.getPetCount();
    return `Pets: ${count}`;
  }

  private updatePetCountUI(): void {
    this.petCountText.setText(this.getPetCountText());

    // Flash animation when count changes
    this.tweens.add({
      targets: this.petCountText,
      scale: 1.2,
      duration: 100,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  private createWorld(): void {
    const worldWidth = 120;
    const worldHeight = 90;

    // Set world bounds
    this.physics.world.setBounds(0, 0, worldWidth * TILE_SIZE, worldHeight * TILE_SIZE);

    // Create grass background with variation
    for (let y = 0; y < worldHeight; y++) {
      for (let x = 0; x < worldWidth; x++) {
        // Randomly choose grass or grass with flowers
        const grassType = Math.random() > 0.92 ? 'grass_flower' : 'grass';
        const tile = this.add.image(
          x * TILE_SIZE + TILE_SIZE / 2,
          y * TILE_SIZE + TILE_SIZE / 2,
          grassType
        );
        tile.setDepth(-10);
      }
    }

    // Create paths
    this.createPaths();

    // Create multiple ponds
    this.createPond(50, 25, 10, 8);  // Main pond (larger)
    this.createSmallPond(20, 55, 5, 4);  // Small pond
    this.createSmallPond(85, 40, 6, 5);  // Eastern pond

    // Create trees as obstacles
    this.trees = this.physics.add.staticGroup();

    // Many more trees for the expanded world
    const treePositions = [
      // Northern forest area
      { x: 5, y: 5 }, { x: 8, y: 3 }, { x: 14, y: 8 }, { x: 18, y: 5 },
      { x: 25, y: 3 }, { x: 32, y: 6 }, { x: 38, y: 4 }, { x: 45, y: 7 },
      { x: 55, y: 5 }, { x: 62, y: 8 }, { x: 70, y: 4 }, { x: 78, y: 6 },
      { x: 85, y: 3 }, { x: 92, y: 7 }, { x: 100, y: 5 }, { x: 108, y: 8 },
      // Western edge trees
      { x: 3, y: 25 }, { x: 5, y: 35 }, { x: 4, y: 45 }, { x: 6, y: 55 },
      { x: 3, y: 65 }, { x: 5, y: 75 },
      // Eastern edge trees
      { x: 112, y: 20 }, { x: 115, y: 35 }, { x: 113, y: 50 },
      { x: 116, y: 65 }, { x: 114, y: 78 },
      // Central scattered trees
      { x: 30, y: 15 }, { x: 40, y: 18 }, { x: 70, y: 15 }, { x: 80, y: 12 },
      { x: 95, y: 18 }, { x: 35, y: 35 }, { x: 65, y: 38 }, { x: 75, y: 32 },
      { x: 100, y: 35 }, { x: 25, y: 45 }, { x: 45, y: 48 }, { x: 55, y: 42 },
      { x: 90, y: 48 }, { x: 105, y: 42 },
      // Southern area trees
      { x: 10, y: 70 }, { x: 30, y: 72 }, { x: 50, y: 68 }, { x: 70, y: 75 },
      { x: 90, y: 70 }, { x: 110, y: 72 },
      { x: 15, y: 82 }, { x: 40, y: 78 }, { x: 65, y: 82 }, { x: 85, y: 78 },
      // Grove areas (clusters)
      { x: 12, y: 18 }, { x: 14, y: 20 }, { x: 10, y: 22 },
      { x: 95, y: 55 }, { x: 98, y: 57 }, { x: 93, y: 59 },
    ];

    treePositions.forEach(pos => {
      const treeWidth = TILE_SIZE * 4;   // 2x scale
      const treeHeight = TILE_SIZE * 6;  // 2x scale

      const tree = this.trees.create(
        pos.x * TILE_SIZE + treeWidth / 2,
        pos.y * TILE_SIZE + treeHeight / 2,
        'tree'
      ) as Phaser.Physics.Arcade.Sprite;

      // Collision box at base of tree only (scaled proportionally)
      tree.setSize(treeWidth * 0.75, TILE_SIZE * 1.5);  // Wider base for larger trees
      tree.setOffset(treeWidth * 0.125, treeHeight - TILE_SIZE * 1.5);
      tree.setDepth(pos.y * TILE_SIZE + treeHeight);
    });

    // Add decorative elements
    this.addFlowers();
    this.addRocks();
    this.addBushes();

    // Create path to snow lands on the right
    this.createSnowZone();

    // Create path to beach at the bottom
    this.createBeachZone();

    // Create path to mountain on the left
    this.createMountainZone();

    // Create path to jungle at the top
    this.createJungleZone();
  }

  private createSnowZone(): void {
    // Snow path on the right edge
    const snowX = 117;
    const snowY = 35;

    // Create snowy path tiles leading to exit
    for (let y = snowY - 2; y < snowY + 5; y++) {
      for (let x = snowX - 2; x < 120; x++) {
        const snowTile = this.add.image(
          x * TILE_SIZE + TILE_SIZE / 2,
          y * TILE_SIZE + TILE_SIZE / 2,
          Math.random() > 0.7 ? 'snow_sparkle' : 'snow'
        );
        snowTile.setDepth(-8);
      }
    }

    // Transition zone
    this.snowZone = this.add.zone(119 * TILE_SIZE, snowY * TILE_SIZE + TILE_SIZE, TILE_SIZE * 2, TILE_SIZE * 4);
    this.physics.add.existing(this.snowZone, true);

    // Sign
    const signText = this.add.text(116 * TILE_SIZE, (snowY - 1) * TILE_SIZE, 'SNOW LANDS', {
      fontSize: '8px',
      color: '#87ceeb',
      backgroundColor: '#2d2d44dd',
      padding: { x: 4, y: 2 },
    });
    signText.setOrigin(0.5);
    signText.setDepth(100);

    // Arrow indicator
    const arrow = this.add.text(118 * TILE_SIZE, snowY * TILE_SIZE + TILE_SIZE, '▶', {
      fontSize: '10px',
      color: '#87ceeb',
    });
    arrow.setOrigin(0.5);
    arrow.setDepth(100);

    this.tweens.add({
      targets: arrow,
      x: arrow.x + 4,
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private createBeachZone(): void {
    // Beach path at the bottom edge
    const beachX = 60;
    const beachY = 87;

    // Create sandy path tiles leading to exit
    for (let y = beachY - 2; y < 90; y++) {
      for (let x = beachX - 3; x < beachX + 4; x++) {
        const sandTile = this.add.image(
          x * TILE_SIZE + TILE_SIZE / 2,
          y * TILE_SIZE + TILE_SIZE / 2,
          Math.random() > 0.7 ? 'sand_shells' : 'sand'
        );
        sandTile.setDepth(-8);
      }
    }

    // Transition zone
    this.beachZone = this.add.zone(beachX * TILE_SIZE, 89 * TILE_SIZE, TILE_SIZE * 6, TILE_SIZE * 2);
    this.physics.add.existing(this.beachZone, true);

    // Sign
    const signText = this.add.text(beachX * TILE_SIZE, (beachY - 1) * TILE_SIZE, 'BEACH', {
      fontSize: '8px',
      color: '#f4e4bc',
      backgroundColor: '#2d2d44dd',
      padding: { x: 4, y: 2 },
    });
    signText.setOrigin(0.5);
    signText.setDepth(100);

    // Arrow indicator pointing down
    const arrow = this.add.text(beachX * TILE_SIZE, (beachY + 1) * TILE_SIZE, '▼', {
      fontSize: '10px',
      color: '#f4e4bc',
    });
    arrow.setOrigin(0.5);
    arrow.setDepth(100);

    this.tweens.add({
      targets: arrow,
      y: arrow.y + 4,
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private createMountainZone(): void {
    // Mountain path on the left edge (middle area)
    const mountainX = 3;
    const mountainY = 40;

    // Create rocky path tiles leading to exit
    for (let y = mountainY - 2; y < mountainY + 5; y++) {
      for (let x = 0; x < mountainX + 2; x++) {
        const rockTile = this.add.image(
          x * TILE_SIZE + TILE_SIZE / 2,
          y * TILE_SIZE + TILE_SIZE / 2,
          Math.random() > 0.7 ? 'rock_pebbles' : 'rock'
        );
        rockTile.setDepth(-8);
      }
    }

    // Transition zone (positioned 1 tile inward from edge to allow overlap when riding)
    this.mountainZone = this.add.zone(TILE_SIZE, mountainY * TILE_SIZE + TILE_SIZE, TILE_SIZE * 2, TILE_SIZE * 4);
    this.physics.add.existing(this.mountainZone, true);

    // Sign
    const signText = this.add.text(3 * TILE_SIZE, (mountainY - 1) * TILE_SIZE, 'MOUNTAIN', {
      fontSize: '8px',
      color: '#9e9e9e',
      backgroundColor: '#2d2d44dd',
      padding: { x: 4, y: 2 },
    });
    signText.setOrigin(0.5);
    signText.setDepth(100);

    // Arrow indicator pointing left
    const arrow = this.add.text(1.5 * TILE_SIZE, mountainY * TILE_SIZE + TILE_SIZE, '◀', {
      fontSize: '10px',
      color: '#9e9e9e',
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
  }

  private createJungleZone(): void {
    // Jungle path at the top edge (centered)
    const jungleX = 60;
    const jungleY = 3;

    // Create jungle floor tiles leading to exit
    for (let y = 0; y < jungleY + 4; y++) {
      for (let x = jungleX - 3; x < jungleX + 4; x++) {
        const jungleTile = this.add.image(
          x * TILE_SIZE + TILE_SIZE / 2,
          y * TILE_SIZE + TILE_SIZE / 2,
          Math.random() > 0.7 ? 'jungle_floor_moss' : 'jungle_floor'
        );
        jungleTile.setDepth(-8);
      }
    }

    // Transition zone
    this.jungleZone = this.add.zone(jungleX * TILE_SIZE, 0, TILE_SIZE * 6, TILE_SIZE * 2);
    this.physics.add.existing(this.jungleZone, true);

    // Sign
    const signText = this.add.text(jungleX * TILE_SIZE, (jungleY + 2) * TILE_SIZE, 'JUNGLE', {
      fontSize: '8px',
      color: '#32cd32',
      backgroundColor: '#2d2d44dd',
      padding: { x: 4, y: 2 },
    });
    signText.setOrigin(0.5);
    signText.setDepth(100);

    // Arrow indicator pointing up
    const arrow = this.add.text(jungleX * TILE_SIZE, (jungleY + 1) * TILE_SIZE, '\u25B2', {
      fontSize: '10px',
      color: '#32cd32',
    });
    arrow.setOrigin(0.5);
    arrow.setDepth(100);

    this.tweens.add({
      targets: arrow,
      y: arrow.y - 4,
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private createPaths(): void {
    // Main horizontal path (center of world)
    for (let x = 8; x < 112; x++) {
      const path = this.add.image(
        x * TILE_SIZE + TILE_SIZE / 2,
        45 * TILE_SIZE + TILE_SIZE / 2,
        'path'
      );
      path.setDepth(-5);
    }

    // Main vertical path (extends from house to beach exit)
    for (let y = 15; y < 88; y++) {
      const path = this.add.image(
        60 * TILE_SIZE + TILE_SIZE / 2,
        y * TILE_SIZE + TILE_SIZE / 2,
        'path'
      );
      path.setDepth(-5);
    }

    // Path to snow lands (east)
    for (let x = 60; x < 118; x++) {
      const path = this.add.image(
        x * TILE_SIZE + TILE_SIZE / 2,
        35 * TILE_SIZE + TILE_SIZE / 2,
        'path'
      );
      path.setDepth(-5);
    }
    // Connecting vertical path
    for (let y = 35; y < 46; y++) {
      const path = this.add.image(
        60 * TILE_SIZE + TILE_SIZE / 2,
        y * TILE_SIZE + TILE_SIZE / 2,
        'path'
      );
      path.setDepth(-5);
    }

    // Path to mountain (west)
    for (let x = 5; x < 61; x++) {
      const path = this.add.image(
        x * TILE_SIZE + TILE_SIZE / 2,
        40 * TILE_SIZE + TILE_SIZE / 2,
        'path'
      );
      path.setDepth(-5);
    }
    // Connecting vertical path
    for (let y = 40; y < 46; y++) {
      const path = this.add.image(
        60 * TILE_SIZE + TILE_SIZE / 2,
        y * TILE_SIZE + TILE_SIZE / 2,
        'path'
      );
      path.setDepth(-5);
    }

    // Northern exploration path
    for (let x = 30; x < 90; x++) {
      const path = this.add.image(
        x * TILE_SIZE + TILE_SIZE / 2,
        20 * TILE_SIZE + TILE_SIZE / 2,
        'path'
      );
      path.setDepth(-5);
    }
    // Connect north path to main
    for (let y = 20; y < 46; y++) {
      if (y < 35 || y > 40) { // Skip where other paths exist
        const path = this.add.image(
          60 * TILE_SIZE + TILE_SIZE / 2,
          y * TILE_SIZE + TILE_SIZE / 2,
          'path'
        );
        path.setDepth(-5);
      }
    }

    // Southern path
    for (let x = 25; x < 95; x++) {
      const path = this.add.image(
        x * TILE_SIZE + TILE_SIZE / 2,
        70 * TILE_SIZE + TILE_SIZE / 2,
        'path'
      );
      path.setDepth(-5);
    }
    // Connect south path to main
    for (let y = 45; y < 71; y++) {
      const path = this.add.image(
        60 * TILE_SIZE + TILE_SIZE / 2,
        y * TILE_SIZE + TILE_SIZE / 2,
        'path'
      );
      path.setDepth(-5);
    }

    // Create house in the center of the world map
    this.createHouse(60, 50);
  }

  private createHouse(tileX: number, tileY: number): void {
    const x = tileX * TILE_SIZE + TILE_SIZE;
    const y = tileY * TILE_SIZE + TILE_SIZE;
    const houseWidth = TILE_SIZE * 2.5 * 5; // 5x bigger
    const houseHeight = TILE_SIZE * 2 * 5; // 5x bigger

    // Replace procedural house with sprite
    const house = this.add.image(x, y, 'house');
    const scale = Math.min(houseWidth / 944, houseHeight / 579); // Scale to fit larger area
    house.setScale(scale);
    house.setDepth(tileY * TILE_SIZE);

    // Door
    const door = this.add.rectangle(x, y + 16, 12, 16, 0x4a3506);
    door.setDepth(tileY * TILE_SIZE + 1);

    // Window
    const window1 = this.add.rectangle(x - 12, y + 8, 8, 8, 0x5b9bd5);
    window1.setStrokeStyle(1, 0x4a3506);
    window1.setDepth(tileY * TILE_SIZE + 1);

    const window2 = this.add.rectangle(x + 12, y + 8, 8, 8, 0x5b9bd5);
    window2.setStrokeStyle(1, 0x4a3506);
    window2.setDepth(tileY * TILE_SIZE + 1);

    // "Home" label
    const label = this.add.text(x, y - 24, 'HOME', {
      fontSize: '8px',
      color: '#ffffff',
      backgroundColor: '#2d2d44dd',
      padding: { x: 4, y: 2 },
    });
    label.setOrigin(0.5);
    label.setDepth(tileY * TILE_SIZE + 2);

    // Create entry zone in front of door
    this.homeZone = this.add.zone(x, y + 28, TILE_SIZE * 1.5, TILE_SIZE);
    this.physics.add.existing(this.homeZone, true);
  }

  private createPond(startX: number, startY: number, width: number, height: number): void {
    for (let y = startY; y < startY + height; y++) {
      for (let x = startX; x < startX + width; x++) {
        const water = this.add.image(
          x * TILE_SIZE + TILE_SIZE / 2,
          y * TILE_SIZE + TILE_SIZE / 2,
          'water'
        );
        water.setDepth(-5);
      }
    }

    // Store water bounds for collision detection
    this.waterBounds = new Phaser.Geom.Rectangle(
      startX * TILE_SIZE,
      startY * TILE_SIZE,
      width * TILE_SIZE,
      height * TILE_SIZE
    );

    // Create bridge across the middle of the pond
    const bridgeY = startY + Math.floor(height / 2);
    for (let x = startX - 1; x <= startX + width; x++) {
      const bridge = this.add.image(
        x * TILE_SIZE + TILE_SIZE / 2,
        bridgeY * TILE_SIZE + TILE_SIZE / 2,
        'bridge'
      );
      bridge.setDepth(bridgeY * TILE_SIZE);
    }

    // Store bridge bounds (player on bridge = not in water)
    this.bridgeBounds = new Phaser.Geom.Rectangle(
      (startX - 1) * TILE_SIZE,
      bridgeY * TILE_SIZE,
      (width + 2) * TILE_SIZE,
      TILE_SIZE
    );
  }

  private createSmallPond(startX: number, startY: number, width: number, height: number): void {
    // Small decorative ponds without bridges
    for (let y = startY; y < startY + height; y++) {
      for (let x = startX; x < startX + width; x++) {
        const water = this.add.image(
          x * TILE_SIZE + TILE_SIZE / 2,
          y * TILE_SIZE + TILE_SIZE / 2,
          'water'
        );
        water.setDepth(-5);
      }
    }

    // Add some lily pads or reeds around the edge for decoration
    const decorPositions = [
      { x: startX, y: startY },
      { x: startX + width - 1, y: startY + height - 1 },
      { x: startX + Math.floor(width / 2), y: startY },
    ];

    decorPositions.forEach(pos => {
      const lilyPad = this.add.circle(
        pos.x * TILE_SIZE + TILE_SIZE / 2,
        pos.y * TILE_SIZE + TILE_SIZE / 2,
        4,
        0x228b22
      );
      lilyPad.setDepth(-4);
    });
  }

  private addFlowers(): void {
    const flowerTypes = ['flower_red', 'flower_yellow', 'flower_blue', 'flower_pink'];
    const flowerPositions = [
      // Northern meadow
      { x: 7, y: 10 }, { x: 15, y: 12 }, { x: 22, y: 8 }, { x: 35, y: 14 },
      { x: 45, y: 10 }, { x: 55, y: 12 }, { x: 68, y: 9 }, { x: 82, y: 11 },
      { x: 95, y: 13 }, { x: 105, y: 10 },
      // Western area
      { x: 10, y: 28 }, { x: 12, y: 35 }, { x: 8, y: 48 }, { x: 15, y: 60 },
      { x: 10, y: 75 },
      // Eastern area
      { x: 100, y: 25 }, { x: 108, y: 32 }, { x: 105, y: 45 }, { x: 110, y: 58 },
      { x: 102, y: 72 },
      // Central scattered
      { x: 38, y: 30 }, { x: 72, y: 28 }, { x: 45, y: 52 }, { x: 78, y: 55 },
      { x: 32, y: 62 }, { x: 88, y: 65 },
      // Southern area
      { x: 20, y: 80 }, { x: 45, y: 82 }, { x: 75, y: 78 }, { x: 95, y: 82 },
      // Flower clusters (meadow areas)
      { x: 25, y: 25 }, { x: 26, y: 26 }, { x: 27, y: 25 },
      { x: 85, y: 50 }, { x: 86, y: 51 }, { x: 87, y: 50 },
      { x: 40, y: 65 }, { x: 41, y: 66 }, { x: 42, y: 65 },
    ];

    flowerPositions.forEach((pos, i) => {
      const flower = this.add.image(
        pos.x * TILE_SIZE + TILE_SIZE / 2,
        pos.y * TILE_SIZE + TILE_SIZE / 2,
        flowerTypes[i % flowerTypes.length]
      );
      flower.setDepth(pos.y * TILE_SIZE);
    });
  }

  private addRocks(): void {
    const rockPositions = [
      // Scattered throughout the world
      { x: 18, y: 15 }, { x: 42, y: 22 }, { x: 75, y: 18 }, { x: 98, y: 15 },
      { x: 15, y: 38 }, { x: 85, y: 42 }, { x: 30, y: 58 }, { x: 95, y: 62 },
      { x: 22, y: 75 }, { x: 55, y: 78 }, { x: 88, y: 75 },
      // Small clusters
      { x: 48, y: 35 }, { x: 49, y: 36 },
      { x: 72, y: 60 }, { x: 73, y: 61 },
    ];

    rockPositions.forEach(pos => {
      const rock = this.add.ellipse(
        pos.x * TILE_SIZE + TILE_SIZE / 2,
        pos.y * TILE_SIZE + TILE_SIZE / 2,
        TILE_SIZE * 0.6,
        TILE_SIZE * 0.4,
        0x808080
      );
      rock.setDepth(pos.y * TILE_SIZE - 1);

      // Add highlight
      const highlight = this.add.ellipse(
        pos.x * TILE_SIZE + TILE_SIZE / 2 - 2,
        pos.y * TILE_SIZE + TILE_SIZE / 2 - 2,
        TILE_SIZE * 0.25,
        TILE_SIZE * 0.15,
        0xa0a0a0
      );
      highlight.setDepth(pos.y * TILE_SIZE);
    });
  }

  private addBushes(): void {
    const bushPositions = [
      // Forest edges
      { x: 8, y: 12 }, { x: 20, y: 8 }, { x: 38, y: 10 }, { x: 58, y: 6 },
      { x: 75, y: 9 }, { x: 95, y: 12 }, { x: 110, y: 8 },
      // Scattered throughout
      { x: 15, y: 30 }, { x: 28, y: 42 }, { x: 45, y: 35 }, { x: 68, y: 48 },
      { x: 82, y: 38 }, { x: 102, y: 30 },
      // Southern area
      { x: 18, y: 68 }, { x: 35, y: 75 }, { x: 58, y: 72 }, { x: 80, y: 68 },
      { x: 98, y: 78 },
    ];

    bushPositions.forEach(pos => {
      // Bush body
      const bush = this.add.ellipse(
        pos.x * TILE_SIZE + TILE_SIZE / 2,
        pos.y * TILE_SIZE + TILE_SIZE / 2,
        TILE_SIZE * 0.9,
        TILE_SIZE * 0.7,
        0x228b22
      );
      bush.setDepth(pos.y * TILE_SIZE - 1);

      // Bush highlight
      const highlight = this.add.ellipse(
        pos.x * TILE_SIZE + TILE_SIZE / 2 - 2,
        pos.y * TILE_SIZE + TILE_SIZE / 2 - 3,
        TILE_SIZE * 0.4,
        TILE_SIZE * 0.3,
        0x32cd32
      );
      highlight.setDepth(pos.y * TILE_SIZE);
    });
  }

  private createPlayer(): void {
    // Place player at starting position (below the central house)
    this.player = this.physics.add.sprite(
      60 * TILE_SIZE + TILE_SIZE / 2,
      55 * TILE_SIZE + PLAYER_HEIGHT / 2,
      'player_down'
    ) as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;

    // Scale will be set by PlayerAnimator

    // Adjust collision box to be at feet level - dynamically calculated based on visual sprite dimensions
    // Walking sprite dimensions: ~1568x2720 pixels, scaled to PLAYER_CONFIG.NORMAL_SCALE (0.0225)
    const WALKING_SPRITE_HEIGHT = 2720;
    const walkingScale = PLAYER_CONFIG.NORMAL_SCALE;

    // Calculate visual sprite height
    const visualHeight = WALKING_SPRITE_HEIGHT * walkingScale; // ~61.2px

    // Set collision body size (maintain 800x400 in world coordinates)
    this.player.setSize(800, 400);

    // Calculate offset to position collision body at feet (88% down from sprite origin)
    const feetPosition = visualHeight * 0.88; // ~53.86px from sprite origin
    const worldOffsetY = feetPosition / walkingScale; // Convert to world coordinates (~2394)

    this.player.setOffset(400, Math.round(worldOffsetY)); // Center horizontally, feet position

    this.player.setCollideWorldBounds(true);
    this.player.setDepth(this.player.y);

    // Set up collision with trees
    this.physics.add.collider(this.player, this.trees);
  }

  private createPets(): void {
    this.pets = this.physics.add.group();

    // Only use ground pet types, not butterflies
    const petTypes = Object.keys(PET_TYPES).filter(key => !key.startsWith('BUTTERFLY'));
    const petPositions = [
      // Northern area
      { x: 18, y: 12 }, { x: 40, y: 15 }, { x: 65, y: 10 }, { x: 88, y: 14 },
      // Western area
      { x: 12, y: 32 }, { x: 8, y: 50 }, { x: 15, y: 68 },
      // Eastern area
      { x: 105, y: 28 }, { x: 110, y: 52 }, { x: 100, y: 70 },
      // Central meadows
      { x: 35, y: 28 }, { x: 48, y: 38 }, { x: 75, y: 32 }, { x: 82, y: 55 },
      { x: 42, y: 58 }, { x: 68, y: 62 },
      // Southern area
      { x: 25, y: 75 }, { x: 55, y: 80 }, { x: 85, y: 78 },
      // Near ponds
      { x: 45, y: 22 }, { x: 92, y: 45 },
    ];

    petPositions.forEach((pos, index) => {
      const petType = petTypes[index % petTypes.length].toLowerCase();
      const spriteKey = getSpriteKey(petType, true);

      const pet = this.pets.create(
        pos.x * TILE_SIZE + TILE_SIZE / 2,
        pos.y * TILE_SIZE + TILE_SIZE / 2,
        spriteKey
      ) as Phaser.Physics.Arcade.Sprite;

      pet.setCollideWorldBounds(true);
      pet.setData('wanderTimer', Math.random() * 2000);
      pet.setData('wanderDirection', { x: 0, y: 0 });
      pet.setData('petType', petType);
      pet.setDepth(pos.y * TILE_SIZE);

      // Apply sprite configuration from centralized config
      applyPetSpriteConfig(pet, petType);
    });

    // Add extra frogs near ponds (frogs love water!)
    const frogPositions = [
      { x: 48, y: 34 },  // South of main pond
      { x: 22, y: 60 },  // South of small pond
      { x: 87, y: 46 },  // South of eastern pond
    ];

    frogPositions.forEach((pos) => {
      const frog = this.pets.create(
        pos.x * TILE_SIZE + TILE_SIZE / 2,
        pos.y * TILE_SIZE + TILE_SIZE / 2,
        getSpriteKey('frog', true)
      ) as Phaser.Physics.Arcade.Sprite;

      frog.setCollideWorldBounds(true);
      frog.setData('wanderTimer', Math.random() * 2000);
      frog.setData('wanderDirection', { x: 0, y: 0 });
      frog.setData('petType', 'frog');
      frog.setDepth(pos.y * TILE_SIZE);

      // Apply sprite configuration from centralized config
      applyPetSpriteConfig(frog, 'frog');
    });

    // Pets collide with trees and each other
    this.physics.add.collider(this.pets, this.trees);
    this.physics.add.collider(this.pets, this.pets);
  }

  private createButterflies(): void {
    this.butterflies = this.physics.add.group();

    const butterflyColors = ['blue', 'pink', 'yellow', 'purple'];
    const butterflyPositions = [
      // Near flower meadows
      { x: 25, y: 25 }, { x: 27, y: 26 },
      { x: 85, y: 50 }, { x: 87, y: 51 },
      { x: 40, y: 65 }, { x: 42, y: 66 },
      // Northern area
      { x: 15, y: 12 }, { x: 55, y: 10 }, { x: 95, y: 14 },
      // Central wanderers
      { x: 35, y: 35 }, { x: 70, y: 42 }, { x: 50, y: 55 },
      // Southern meadow
      { x: 30, y: 78 }, { x: 75, y: 82 },
    ];

    butterflyPositions.forEach((pos, index) => {
      const color = butterflyColors[index % butterflyColors.length];
      const butterfly = this.butterflies.create(
        pos.x * TILE_SIZE + TILE_SIZE / 2,
        pos.y * TILE_SIZE + TILE_SIZE / 2,
        `butterfly_${color}`
      ) as Phaser.Physics.Arcade.Sprite;

      butterfly.setCollideWorldBounds(true);
      butterfly.setData('flutterTimer', Math.random() * 1000);
      butterfly.setData('flutterDirection', { x: 0, y: 0 });
      butterfly.setData('petType', `butterfly_${color}`);
      butterfly.setData('baseY', pos.y * TILE_SIZE + TILE_SIZE / 2);
      butterfly.setData('isButterfly', true);
      butterfly.setDepth(1000); // Butterflies fly above everything

      // Small collision box
      butterfly.setSize(8, 8);
      butterfly.setOffset(4, 4);

      // Add gentle bobbing animation
      this.tweens.add({
        targets: butterfly,
        y: butterfly.y - 6,
        duration: 400 + Math.random() * 200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      // Wing flapping effect (scale pulse)
      this.tweens.add({
        targets: butterfly,
        scaleX: 0.8,
        duration: 100,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });
  }

  private createCollectibles(): void {
    this.collectibles = this.physics.add.group();

    // Define which tools spawn in this area (NET for catching butterflies)
    const toolSpawns: { tool: ToolType; x: number; y: number }[] = [
      { tool: 'NET', x: 28, y: 24 },  // Near butterfly meadow
    ];

    toolSpawns.forEach(spawn => {
      // Only spawn if player doesn't already have this tool
      if (!InventoryManager.hasTool(spawn.tool)) {
        this.createCollectibleItem(spawn.tool, spawn.x, spawn.y);
      }
    });

    // Set up overlap detection for collecting items
    this.physics.add.overlap(this.player, this.collectibles, (_, item) => {
      this.collectItem(item as Phaser.Physics.Arcade.Sprite);
    });
  }

  private createCollectibleItem(tool: ToolType, tileX: number, tileY: number): void {
    const x = tileX * TILE_SIZE + TILE_SIZE / 2;
    const y = tileY * TILE_SIZE + TILE_SIZE / 2;

    // Create the tool sprite
    const toolSprite = this.collectibles.create(x, y, `tool_${tool.toLowerCase()}`) as Phaser.Physics.Arcade.Sprite;
    toolSprite.setData('toolType', tool);
    toolSprite.setDepth(tileY * TILE_SIZE);

    // Add sparkle effect behind it
    const sparkle = this.add.image(x, y, 'collectible_sparkle');
    sparkle.setDepth(tileY * TILE_SIZE - 1);
    sparkle.setAlpha(0.6);

    // Sparkle rotation animation
    this.tweens.add({
      targets: sparkle,
      angle: 360,
      duration: 3000,
      repeat: -1,
      ease: 'Linear',
    });

    // Sparkle pulse
    this.tweens.add({
      targets: sparkle,
      scale: 1.3,
      alpha: 0.3,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Tool bob animation
    this.tweens.add({
      targets: toolSprite,
      y: y - 4,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Store sparkle reference for cleanup
    toolSprite.setData('sparkle', sparkle);
  }

  private collectItem(item: Phaser.Physics.Arcade.Sprite): void {
    const toolType = item.getData('toolType') as ToolType;
    const sparkle = item.getData('sparkle') as Phaser.GameObjects.Image;

    // Add to inventory
    if (InventoryManager.addTool(toolType)) {
      // Play collect sound
      SoundManager.playSuccess();

      // Show collect message
      const toolInfo = TOOL_INFO[toolType];
      this.showCollectMessage(`Found ${toolInfo.name}!`, toolInfo.color);

      // Update inventory display
      this.updateInventoryUI();

      // Destroy sparkle
      if (sparkle) {
        this.tweens.killTweensOf(sparkle);
        sparkle.destroy();
      }

      // Animate item collection
      this.tweens.add({
        targets: item,
        y: item.y - 20,
        alpha: 0,
        scale: 1.5,
        duration: 300,
        ease: 'Back.easeOut',
        onComplete: () => {
          item.destroy();
        },
      });
    }
  }

  private showCollectMessage(text: string, color: number): void {
    const hexColor = '#' + color.toString(16).padStart(6, '0');
    const message = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 - 40,
      text,
      {
        fontSize: '12px',
        color: hexColor,
        backgroundColor: '#2d2d44ee',
        padding: { x: 10, y: 6 },
      }
    );
    message.setOrigin(0.5);
    message.setScrollFactor(0);
    message.setDepth(2000);

    // Animate
    message.setAlpha(0);
    message.setScale(0.5);

    this.tweens.add({
      targets: message,
      alpha: 1,
      scale: 1,
      duration: 200,
      ease: 'Back.easeOut',
    });

    this.tweens.add({
      targets: message,
      alpha: 0,
      y: message.y - 30,
      duration: 500,
      delay: 1500,
      ease: 'Quad.easeIn',
      onComplete: () => message.destroy(),
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

      // Handle interact key
      this.interactKey.on('down', () => this.handleInteraction());

      // Handle home key - use justDown check in update for reliability
      this.input.keyboard.on('keydown-H', () => {
        if (!this.isCatching) {
          this.goHome();
        }
      });

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

  private findNearestMountableHorse(): Phaser.Physics.Arcade.Sprite | null {
    // In WorldScene, only dismounted horses can be mounted (wild horses must be caught first)
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
        this.physics.add.collider(horse, this.trees);
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

  private goHome(): void {
    if (this.isCatching || this.isTransitioning) return;
    this.isTransitioning = true;

    // Handle dismounted horse on scene exit (returns to home pen)
    this.ridingSystem.onSceneExit();

    // Play transition sound
    SoundManager.playClick();

    // Fade out and switch scene
    this.cameras.main.fadeOut(300, 0, 0, 0);

    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(SCENES.HOME);
    });
  }

  private openMenu(): void {
    if (this.isCatching || this.isTransitioning) return;
    this.scene.pause();
    this.scene.launch(SCENES.MENU, { previousScene: SCENES.WORLD });
    this.scene.bringToTop(SCENES.MENU);
  }

  private goToSnow(): void {
    if (this.isCatching || this.isTransitioning) return;
    this.isTransitioning = true;

    // Handle dismounted horse on scene exit
    this.ridingSystem.onSceneExit();

    SoundManager.playClick();

    this.cameras.main.fadeOut(300, 0, 0, 0);

    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(SCENES.SNOW);
    });
  }

  private goToBeach(): void {
    if (this.isCatching || this.isTransitioning) return;
    this.isTransitioning = true;

    // Handle dismounted horse on scene exit
    this.ridingSystem.onSceneExit();

    SoundManager.playClick();

    this.cameras.main.fadeOut(300, 0, 0, 0);

    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(SCENES.BEACH);
    });
  }

  private goToMountain(): void {
    if (this.isCatching || this.isTransitioning) return;
    this.isTransitioning = true;

    // Handle dismounted horse on scene exit
    this.ridingSystem.onSceneExit();

    SoundManager.playClick();

    this.cameras.main.fadeOut(300, 0, 0, 0);

    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(SCENES.MOUNTAIN);
    });
  }

  private goToJungle(): void {
    if (this.isCatching || this.isTransitioning) return;
    this.isTransitioning = true;

    // Handle dismounted horse on scene exit
    this.ridingSystem.onSceneExit();

    SoundManager.playClick();

    this.cameras.main.fadeOut(300, 0, 0, 0);

    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(SCENES.JUNGLE);
    });
  }

  private handlePlayerMovement(): void {
    let velocityX = 0;
    let velocityY = 0;
    let newDirection = this.playerDirection;

    // Check running/galloping state
    const isRunning = this.shiftKey?.isDown || GamepadManager.isButtonDown(GAMEPAD_BUTTONS.RB);

    // Determine speed based on riding state and terrain
    let speed: number;
    if (this.ridingSystem.getIsRiding()) {
      // Riding speed (not affected by water as much)
      speed = this.ridingSystem.getRidingSpeed(isRunning);
      if (this.isInWater) {
        speed *= 0.7; // Horses still slow down in water, but not as much
      }
    } else {
      speed = this.isInWater ? PLAYER_SPEED * 0.5 : PLAYER_SPEED;
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

    // Update player sprite direction
    if (newDirection !== this.playerDirection) {
      this.playerDirection = newDirection;
      // RidingSystem will pick up direction changes via velocity in its update()
    }
  }

  

  private handlePetBehavior(): void {
    const petSpeed = 20;

    this.pets.children.each((pet: Phaser.GameObjects.GameObject) => {
      const sprite = pet as Phaser.Physics.Arcade.Sprite;
      let timer = sprite.getData('wanderTimer') as number;

      timer -= this.game.loop.delta;

      if (timer <= 0) {
        // Change direction randomly
        const directions = [
          { x: 0, y: 0 },  // Stop
          { x: 1, y: 0 },  // Right
          { x: -1, y: 0 }, // Left
          { x: 0, y: 1 },  // Down
          { x: 0, y: -1 }, // Up
          { x: 0, y: 0 },  // More chance to stop
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
      const petType = sprite.getData('petType') as string;
      updatePetSpriteDirection(sprite, petType, dir.x);

      return true;
    });
  }

  private handleButterflyBehavior(): void {
    const flutterSpeed = 35;

    this.butterflies.children.each((butterfly: Phaser.GameObjects.GameObject) => {
      const sprite = butterfly as Phaser.Physics.Arcade.Sprite;
      let timer = sprite.getData('flutterTimer') as number;

      timer -= this.game.loop.delta;

      if (timer <= 0) {
        // Butterflies move more erratically
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() > 0.3 ? 1 : 0; // Sometimes pause

        sprite.setData('flutterDirection', {
          x: Math.cos(angle) * speed,
          y: Math.sin(angle) * speed,
        });
        sprite.setData('flutterTimer', 500 + Math.random() * 1500);
      } else {
        sprite.setData('flutterTimer', timer);
      }

      const dir = sprite.getData('flutterDirection') as { x: number; y: number };
      sprite.setVelocityX(dir.x * flutterSpeed);
      // Don't set Y velocity - let the tween handle vertical bobbing

      // Flip sprite based on movement direction
      if (dir.x > 0.1) {
        sprite.setFlipX(false);
      } else if (dir.x < -0.1) {
        sprite.setFlipX(true);
      }

      return true;
    });
  }

  private updateDepthSorting(): void {
    // Update player depth based on Y position (feet level)
    this.player.setDepth(this.player.y + PLAYER_HEIGHT / 2);

    // Update pet depths
    this.pets.children.each((pet: Phaser.GameObjects.GameObject) => {
      const sprite = pet as Phaser.Physics.Arcade.Sprite;
      sprite.setDepth(sprite.y + TILE_SIZE / 2);
      return true;
    });
  }

  private handleInteraction(): void {
    // Don't interact while catching
    if (this.isCatching) return;

    // Find nearest pet or butterfly within interaction range
    let nearestCreature: Phaser.Physics.Arcade.Sprite | null = null;
    let nearestDistance = TILE_SIZE * 3; // Interaction range

    // Check pets
    this.pets.children.each((pet: Phaser.GameObjects.GameObject) => {
      const sprite = pet as Phaser.Physics.Arcade.Sprite;
      const distance = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        sprite.x, sprite.y
      );

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestCreature = sprite;
      }

      return true;
    });

    // Check butterflies (slightly smaller catch range since they fly)
    this.butterflies.children.each((butterfly: Phaser.GameObjects.GameObject) => {
      const sprite = butterfly as Phaser.Physics.Arcade.Sprite;
      const distance = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        sprite.x, sprite.y
      );

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestCreature = sprite;
      }

      return true;
    });

    if (nearestCreature) {
      this.startCatching(nearestCreature);
    }
  }

  private startCatching(pet: Phaser.Physics.Arcade.Sprite): void {
    this.isCatching = true;
    this.targetPet = pet;

    // Stop player and pet movement
    this.player.setVelocity(0, 0);
    pet.setVelocity(0, 0);

    // Get pet type
    const petType = pet.getData('petType') as string;

    // Start catching mini-game
    this.catchingUI.start(petType, (result) => {
      this.handleCatchResult(result);
    });
  }

  private handleCatchResult(result: CatchResult): void {
    if (result === 'success' && this.targetPet) {
      // Play success sound
      SoundManager.playSuccess();

      // Add pet to collection
      const petType = this.targetPet.getData('petType') as string;
      const caughtPet = PetManager.catchPet(petType);

      // Show success message
      showCatchMessage(this, `${caughtPet.name} joined your team!`, '#4ade80');

      // Remove pet from world with animation
      this.tweens.add({
        targets: this.targetPet,
        scale: 0,
        alpha: 0,
        duration: 300,
        ease: 'Back.easeIn',
        onComplete: () => {
          this.targetPet?.destroy();
          this.targetPet = null;
        },
      });

      // Update pet count UI
      this.updatePetCountUI();

    } else if (result === 'failure') {
      // Play failure sound
      SoundManager.playFailure();

      // Show failure message and make pet flee
      showCatchMessage(this, 'It got away!', '#ef4444');

      if (this.targetPet) {
        fleePetFromPlayer(this, this.targetPet, this.player.x, this.player.y);
      }
    } else {
      // Cancelled - just show a message
      showCatchMessage(this, 'You backed away...', '#888888');
    }

    this.isCatching = false;
    this.targetPet = null;
  }

  private handleWaterEffects(delta: number, wasInWater: boolean): void {
    // Tint player blue when in water
    if (this.isInWater) {
      this.player.setTint(0x88bbff);
    } else {
      this.player.clearTint();
    }

    // Entry splash when first entering water
    if (this.isInWater && !wasInWater) {
      this.createSplash(this.player.x, this.player.y, true);
      SoundManager.playSplash();
    }

    // Create splashes while moving in water
    if (this.isInWater) {
      const isMoving = this.player.body && (
        Math.abs(this.player.body.velocity.x) > 5 ||
        Math.abs(this.player.body.velocity.y) > 5
      );

      if (isMoving) {
        this.splashTimer += delta;
        if (this.splashTimer > 150) {
          this.createSplash(this.player.x, this.player.y, false);
          this.splashTimer = 0;
        }
      }
    } else {
      this.splashTimer = 0;
    }
  }

  private createSplash(x: number, y: number, isBig: boolean): void {
    const splashCount = isBig ? 8 : 4;
    const speed = isBig ? 40 : 20;

    for (let i = 0; i < splashCount; i++) {
      const angle = (i / splashCount) * Math.PI * 2;
      const offsetX = Math.cos(angle) * (isBig ? 8 : 4);
      const offsetY = Math.sin(angle) * (isBig ? 8 : 4);

      // Water droplet
      const droplet = this.add.circle(
        x + offsetX,
        y + PLAYER_HEIGHT / 2 + offsetY,
        isBig ? 3 : 2,
        0x5b9bd5
      );
      droplet.setDepth(this.player.depth + 1);

      // Animate droplet
      this.tweens.add({
        targets: droplet,
        x: droplet.x + Math.cos(angle) * speed,
        y: droplet.y + Math.sin(angle) * speed - (isBig ? 10 : 5),
        alpha: 0,
        scale: 0.3,
        duration: isBig ? 400 : 250,
        ease: 'Quad.easeOut',
        onComplete: () => droplet.destroy(),
      });
    }

    // Ripple effect for big splashes
    if (isBig) {
      const ripple = this.add.circle(x, y + PLAYER_HEIGHT / 2, 4, 0x5b9bd5, 0);
      ripple.setStrokeStyle(2, 0x88ccff, 0.8);
      ripple.setDepth(this.player.depth - 1);

      this.tweens.add({
        targets: ripple,
        radius: 20,
        alpha: 0,
        duration: 500,
        ease: 'Quad.easeOut',
        onUpdate: () => {
          ripple.setStrokeStyle(2, 0x88ccff, ripple.alpha * 0.8);
        },
        onComplete: () => ripple.destroy(),
      });
    }
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
  }
}
