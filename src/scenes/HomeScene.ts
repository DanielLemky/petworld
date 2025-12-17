import Phaser from 'phaser';
import { SCENES, TILE_SIZE, PLAYER_SPEED, PLAYER_RUN_MULTIPLIER, PLAYER_HEIGHT, PALETTE, getCorrectPenForPet, getPenConfigById } from '../utils/constants';
import { PetManager } from '../systems/PetManager';
import type { CaughtPet } from '../systems/PetManager';
import { SoundManager } from '../systems/SoundManager';
import { GamepadManager, GAMEPAD_BUTTONS } from '../systems/GamepadManager';
import { getSpriteKey, applyPetSpriteConfig, updatePetSpriteDirection } from '../systems/PetSpriteConfig';
import { AccountManager } from '../systems/AccountManager';
import { PlayerAnimator } from '../systems/PlayerAnimator';

// Farm dimensions
const FARM_WIDTH = 200;
const FARM_HEIGHT = 240;

// Pen dimensions and positions
const PEN_WIDTH = 66;
const PEN_HEIGHT = 48;

interface PenData {
  id: string;
  name: string;
  bounds: Phaser.Geom.Rectangle;
  fences: Phaser.Physics.Arcade.StaticGroup;
  color: number;
}

export class HomeScene extends Phaser.Scene {
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private playerDirection: string = 'down';
  private pets!: Phaser.Physics.Arcade.Group;
  private globalFences!: Phaser.Physics.Arcade.StaticGroup;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private exitZone!: Phaser.GameObjects.Zone;
  private infoText!: Phaser.GameObjects.Text;
  private petCountText!: Phaser.GameObjects.Text;
  private feedKey!: Phaser.Input.Keyboard.Key;
  private takeKey!: Phaser.Input.Keyboard.Key;
  private moodIndicators: Map<string, Phaser.GameObjects.Text> = new Map();
  private companionIndicators: Map<string, Phaser.GameObjects.Text> = new Map();
  
  private companionText!: Phaser.GameObjects.Text;

  // Pen management
  private pens: Map<string, PenData> = new Map();
  private penLabels: Map<string, Phaser.GameObjects.Text> = new Map();

  // Carry mechanic
  private carriedPet: Phaser.Physics.Arcade.Sprite | null = null;
  private carriedPetData: CaughtPet | null = null;
  private isCarryingPet: boolean = false;
  private carryText!: Phaser.GameObjects.Text;
  private penHighlight: Phaser.GameObjects.Rectangle | null = null;
  private playerAnimator!: PlayerAnimator;

  constructor() {
    super({ key: SCENES.HOME });
  }

  create(): void {
    // Update pet stats based on time elapsed
    PetManager.updatePetStats();

    // Create the farm environment
    this.createFarm();

    // Create the player
    this.createPlayer();

    // Create pets from the player's collection
    this.createOwnedPets();

    // Set up input
    this.setupInput();

    // Set up camera
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(1.0);

    // Create UI
    this.createUI();

    // Create exit zone
    this.createExitZone();

    // Start home music
    SoundManager.playMusic('world');
  }

  update(): void {
    // Update gamepad state
    GamepadManager.update();

    // Handle gamepad button actions
    this.handleGamepadButtons();

    this.handlePlayerMovement();
    this.handlePetBehavior();
    this.updateDepthSorting();
    this.updateMoodIndicators();
    this.updateCarriedPet();
    this.checkExitZone();
  }

  private handleGamepadButtons(): void {
    // A button (0) - Interact
    if (GamepadManager.isButtonJustPressed(GAMEPAD_BUTTONS.A)) {
      this.handleInteraction();
    }
    // X button (2) - Feed
    if (GamepadManager.isButtonJustPressed(GAMEPAD_BUTTONS.X)) {
      this.handleFeeding();
    }
    // LB button (4) - Take companion
    if (GamepadManager.isButtonJustPressed(GAMEPAD_BUTTONS.LB)) {
      this.handleTakeWithMe();
    }
    // Y/Triangle button (3) - Go to World
    if (GamepadManager.isButtonJustPressed(GAMEPAD_BUTTONS.Y)) {
      this.goToWorld();
    }
    // Start button - Open menu
    if (GamepadManager.isButtonJustPressed(GAMEPAD_BUTTONS.START)) {
      this.openMenu();
    }
  }

  private createFarm(): void {
    // Set world bounds
    this.physics.world.setBounds(0, 0, FARM_WIDTH * TILE_SIZE, FARM_HEIGHT * TILE_SIZE);

    // Create grass background for entire farm
    for (let y = 0; y < FARM_HEIGHT; y++) {
      for (let x = 0; x < FARM_WIDTH; x++) {
        const grassType = Math.random() > 0.9 ? 'grass_flower' : 'grass';
        const tile = this.add.image(
          x * TILE_SIZE + TILE_SIZE / 2,
          y * TILE_SIZE + TILE_SIZE / 2,
          grassType
        );
        tile.setDepth(-10);
      }
    }

    // Initialize global fences group (for buildings)
    this.globalFences = this.physics.add.staticGroup();

    // Create paths
    this.createPaths();

    // Create buildings
    this.createFarmhouse(10, 5);
    this.createBarn(55, 5);

    // Create the 6 pens (3x larger, spread across bigger farm)
    // Row 1: Meadow and Snow
    this.createPen('meadow', 5, 20, PEN_WIDTH, PEN_HEIGHT);
    this.createPen('snow', 100, 20, PEN_WIDTH, PEN_HEIGHT);

    // Row 2: Pond and Mountain
    this.createPen('pond', 5, 75, PEN_WIDTH, PEN_HEIGHT);
    this.createPen('mountain', 100, 75, PEN_WIDTH, PEN_HEIGHT);

    // Row 3: Beach and Butterfly Garden
    this.createPen('beach', 5, 130, PEN_WIDTH, PEN_HEIGHT);
    this.createPen('butterfly', 100, 130, PEN_WIDTH, PEN_HEIGHT);

    // Row 4: Jungle and vacant space for future biome
    this.createPen('jungle', 5, 185, PEN_WIDTH, PEN_HEIGHT);
    this.createVacantPenFencing(100, 185, PEN_WIDTH, PEN_HEIGHT);
  }

  private createPaths(): void {
    // Main vertical path from top to exit (center of farm at x=80-84)
    for (let y = 3; y < FARM_HEIGHT; y++) {
      for (let x = 80; x < 84; x++) {
        const path = this.add.image(
          x * TILE_SIZE + TILE_SIZE / 2,
          y * TILE_SIZE + TILE_SIZE / 2,
          'path'
        );
        path.setDepth(-5);
      }
    }

    // Horizontal paths to pens - Row 1 (y=19, just before pens at y=20)
    for (let x = 5; x < 80; x++) {
      const path = this.add.image(
        x * TILE_SIZE + TILE_SIZE / 2,
        19 * TILE_SIZE + TILE_SIZE / 2,
        'path'
      );
      path.setDepth(-5);
    }
    for (let x = 84; x < 166; x++) {
      const path = this.add.image(
        x * TILE_SIZE + TILE_SIZE / 2,
        19 * TILE_SIZE + TILE_SIZE / 2,
        'path'
      );
      path.setDepth(-5);
    }

    // Horizontal paths to pens - Row 2 (y=74, just before pens at y=75)
    for (let x = 5; x < 80; x++) {
      const path = this.add.image(
        x * TILE_SIZE + TILE_SIZE / 2,
        74 * TILE_SIZE + TILE_SIZE / 2,
        'path'
      );
      path.setDepth(-5);
    }
    for (let x = 84; x < 166; x++) {
      const path = this.add.image(
        x * TILE_SIZE + TILE_SIZE / 2,
        74 * TILE_SIZE + TILE_SIZE / 2,
        'path'
      );
      path.setDepth(-5);
    }

    // Horizontal paths to pens - Row 3 (y=129, just before pens at y=130)
    for (let x = 5; x < 80; x++) {
      const path = this.add.image(
        x * TILE_SIZE + TILE_SIZE / 2,
        129 * TILE_SIZE + TILE_SIZE / 2,
        'path'
      );
      path.setDepth(-5);
    }
    for (let x = 84; x < 166; x++) {
      const path = this.add.image(
        x * TILE_SIZE + TILE_SIZE / 2,
        129 * TILE_SIZE + TILE_SIZE / 2,
        'path'
      );
      path.setDepth(-5);
    }
  }

  private createFarmhouse(startX: number, startY: number): void {
    const houseWidth = TILE_SIZE * 2.5 * 5; // Same size as world house (200px)
    const houseHeight = TILE_SIZE * 2 * 5; // Same size as world house (160px)
    const x = startX * TILE_SIZE + houseWidth / 2;
    const y = startY * TILE_SIZE + houseHeight / 2;

    // Replace procedural house with sprite
    const house = this.add.image(x, y, 'house');
    const scale = Math.min(houseWidth / 944, houseHeight / 579); // Scale to fit larger area
    house.setScale(scale);
    house.setDepth(startY * TILE_SIZE);

    // Sign
    const sign = this.add.text(x, y - houseHeight / 2 - 10, 'Farmhouse', {
      fontSize: '10px',
      color: '#ffffff',
      backgroundColor: '#5d4e37',
      padding: { x: 4, y: 2 },
    });
    sign.setOrigin(0.5);
    sign.setDepth(startY * TILE_SIZE + 2);

    // Add collision for farmhouse
    for (let tileY = startY; tileY < startY + 6; tileY++) {
      for (let tileX = startX; tileX < startX + 8; tileX++) {
        // Leave door area open
        const isDoorArea = tileY === startY + 5 && (tileX === startX + 3 || tileX === startX + 4);
        if (isDoorArea) continue;

        const colliderX = tileX * TILE_SIZE + TILE_SIZE / 2;
        const colliderY = tileY * TILE_SIZE + TILE_SIZE / 2;

        const collider = this.globalFences.create(colliderX, colliderY, 'grass') as Phaser.Physics.Arcade.Sprite;
        collider.setVisible(false);
        collider.setSize(TILE_SIZE, TILE_SIZE);
        collider.refreshBody();
      }
    }
  }

  private createBarn(startX: number, startY: number): void {
    const barnWidth = 10 * TILE_SIZE;
    const barnHeight = 7 * TILE_SIZE;
    const x = startX * TILE_SIZE + barnWidth / 2;
    const y = startY * TILE_SIZE + barnHeight / 2;

    // Barn base
    const barnBase = this.add.rectangle(x, y + 10, barnWidth, barnHeight - 20, 0x8b4513);
    barnBase.setStrokeStyle(2, 0x5d2e0c);
    barnBase.setDepth(startY * TILE_SIZE);

    // Barn roof
    const roof = this.add.rectangle(x, y - barnHeight / 2 + 15, barnWidth + 10, 30, 0x654321);
    roof.setStrokeStyle(2, 0x3d2817);
    roof.setDepth(startY * TILE_SIZE - 1);

    // Barn doors (large)
    const doorLeft = this.add.rectangle(x - 20, y + 25, 30, 50, PALETTE.WOOD_DARK);
    doorLeft.setDepth(startY * TILE_SIZE + 1);
    const doorRight = this.add.rectangle(x + 20, y + 25, 30, 50, PALETTE.WOOD_DARK);
    doorRight.setDepth(startY * TILE_SIZE + 1);

    // Cross beams on doors
    this.add.line(x - 20, y + 25, -12, -20, 12, 20, 0x3d2817).setDepth(startY * TILE_SIZE + 2);
    this.add.line(x - 20, y + 25, 12, -20, -12, 20, 0x3d2817).setDepth(startY * TILE_SIZE + 2);
    this.add.line(x + 20, y + 25, -12, -20, 12, 20, 0x3d2817).setDepth(startY * TILE_SIZE + 2);
    this.add.line(x + 20, y + 25, 12, -20, -12, 20, 0x3d2817).setDepth(startY * TILE_SIZE + 2);

    // Sign
    const sign = this.add.text(x, y - barnHeight / 2 - 10, 'Barn', {
      fontSize: '10px',
      color: '#ffffff',
      backgroundColor: '#5d4e37',
      padding: { x: 4, y: 2 },
    });
    sign.setOrigin(0.5);
    sign.setDepth(startY * TILE_SIZE + 2);

    // Add collision for barn
    for (let tileY = startY; tileY < startY + 7; tileY++) {
      for (let tileX = startX; tileX < startX + 10; tileX++) {
        // Leave door area open
        const isDoorArea = tileY === startY + 6 && (tileX >= startX + 3 && tileX <= startX + 6);
        if (isDoorArea) continue;

        const colliderX = tileX * TILE_SIZE + TILE_SIZE / 2;
        const colliderY = tileY * TILE_SIZE + TILE_SIZE / 2;

        const collider = this.globalFences.create(colliderX, colliderY, 'grass') as Phaser.Physics.Arcade.Sprite;
        collider.setVisible(false);
        collider.setSize(TILE_SIZE, TILE_SIZE);
        collider.refreshBody();
      }
    }
  }

  private createPen(penId: string, startX: number, startY: number, width: number, height: number): void {
    const penConfig = getPenConfigById(penId);
    if (!penConfig) return;

    // Create pen-specific fence group
    const penFences = this.physics.add.staticGroup();

    // Store pen data
    const penData: PenData = {
      id: penId,
      name: penConfig.name,
      bounds: new Phaser.Geom.Rectangle(
        (startX + 1) * TILE_SIZE,
        (startY + 1) * TILE_SIZE,
        (width - 2) * TILE_SIZE,
        (height - 2) * TILE_SIZE
      ),
      fences: penFences,
      color: penConfig.color,
    };
    this.pens.set(penId, penData);

    // Create ground tiles based on pen type
    this.createPenGround(penId, startX, startY, width, height);

    // Create fences around the pen (with gate at bottom center)
    this.createPenFences(penFences, startX, startY, width, height);

    // Add decorations
    this.createPenDecorations(penId, startX, startY, width, height);

    // Create pen label
    const labelX = (startX + width / 2) * TILE_SIZE;
    const labelY = startY * TILE_SIZE - 8;
    const label = this.add.text(labelX, labelY, penConfig.name, {
      fontSize: '10px',
      color: '#ffffff',
      backgroundColor: '#2d2d44dd',
      padding: { x: 6, y: 3 },
    });
    label.setOrigin(0.5);
    label.setDepth(1000);
    this.penLabels.set(penId, label);
  }

  private createPenGround(penId: string, startX: number, startY: number, width: number, height: number): void {
    const penConfig = getPenConfigById(penId);
    if (!penConfig) return;

    for (let y = startY; y < startY + height; y++) {
      for (let x = startX; x < startX + width; x++) {
        let tileKey = penConfig.groundTile;

        // Add variation based on pen type
        if (penId === 'meadow') {
          tileKey = Math.random() > 0.7 ? 'grass_flower' : 'grass';
        } else if (penId === 'snow') {
          tileKey = Math.random() > 0.8 ? 'snow_sparkle' : 'snow';
        } else if (penId === 'pond') {
          // Water in the center (larger pond for 3x pen)
          const centerX = startX + width / 2;
          const centerY = startY + height / 2;
          const distFromCenter = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
          if (distFromCenter < 12) {
            tileKey = 'water';
          } else {
            tileKey = Math.random() > 0.8 ? 'grass_flower' : 'grass';
          }
        } else if (penId === 'beach') {
          tileKey = Math.random() > 0.85 ? 'sand_shells' : 'sand';
          // Add some shallow water at edge (wider for 3x pen)
          if (x > startX + width - 12) {
            tileKey = Math.random() > 0.5 ? 'shallow_water' : 'sand';
          }
        } else if (penId === 'mountain') {
          tileKey = Math.random() > 0.7 ? 'rock_pebbles' : 'rock';
        } else if (penId === 'butterfly') {
          tileKey = 'grass_flower';
        }

        const tile = this.add.image(
          x * TILE_SIZE + TILE_SIZE / 2,
          y * TILE_SIZE + TILE_SIZE / 2,
          tileKey
        );
        tile.setDepth(-8);
      }
    }
  }

  private createPenFences(fences: Phaser.Physics.Arcade.StaticGroup, startX: number, startY: number, width: number, height: number): void {
    // Gate positions (all gates are 2 tiles wide/tall and centered)
    const horizontalGateStartX = startX + Math.floor(width / 2) - 1;
    const horizontalGateEndX = horizontalGateStartX + 2;
    const verticalGateStartY = startY + Math.floor(height / 2) - 1;
    const verticalGateEndY = verticalGateStartY + 2;

    // Top fence (with gate) - horizontal, spaced
    for (let x = startX; x < startX + width; x += 2) { // Skip every other tile for spacing
      if (x >= horizontalGateStartX && x < horizontalGateEndX) continue; // Skip gate
      this.createFencePost(fences, x, startY, false);
    }

    // Bottom fence (with gate) - horizontal, spaced
    for (let x = startX; x < startX + width; x += 2) { // Skip every other tile for spacing
      if (x >= horizontalGateStartX && x < horizontalGateEndX) continue; // Skip gate
      this.createFencePost(fences, x, startY + height - 1, false);
    }

    // Left fence (with gate) - vertical, spaced
    for (let y = startY + 1; y < startY + height - 1; y += 2) { // Skip every other tile for spacing
      if (y >= verticalGateStartY && y < verticalGateEndY) continue; // Skip gate
      this.createFencePost(fences, startX, y, true);
    }

    // Right fence (with gate) - vertical, spaced
    for (let y = startY + 1; y < startY + height - 1; y += 2) { // Skip every other tile for spacing
      if (y >= verticalGateStartY && y < verticalGateEndY) continue; // Skip gate
      this.createFencePost(fences, startX + width - 1, y, true);
    }
  }

  private createFencePost(fences: Phaser.Physics.Arcade.StaticGroup, tileX: number, tileY: number, isVertical: boolean = false): void {
    const x = tileX * TILE_SIZE + TILE_SIZE / 2;
    const y = tileY * TILE_SIZE + TILE_SIZE / 2;

    // Visual fence post using appropriate sprite based on orientation
    const spriteKey = isVertical ? 'fence_vertical' : 'fence';
    const post = this.add.image(x, y, spriteKey);

    if (isVertical) {
      // Vertical fence: scale to 32px height (2-tile visual span)
      post.setScale(32 / 2304); // Scale 2304px height to 32px (0.014)
    } else {
      // Horizontal fence: scale to 32px width
      post.setScale(32 / 1191); // Scale 1191px sprite to 32px (0.027)
    }

    post.setDepth(tileY * TILE_SIZE);

    // Physics collider - sized to match visual fence dimensions
    const collider = fences.create(x, y, 'grass') as Phaser.Physics.Arcade.Sprite;
    collider.setVisible(false);

    if (isVertical) {
      collider.setSize(32, 32); // Cover full 32px height of vertical fences
    } else {
      collider.setSize(32, TILE_SIZE - 4); // Cover full 32px width of horizontal fences
    }
    collider.refreshBody();
  }

  private isNearGate(x: number, y: number, startX: number, startY: number, width: number, height: number): boolean {
    const centerX = startX + Math.floor(width / 2);
    const centerY = startY + Math.floor(height / 2);
    const gateBuffer = 3; // Keep decorations at least 3 tiles away from gates

    // Check distance from top gate (center X, startY)
    if (Math.abs(x - centerX) <= gateBuffer && Math.abs(y - startY) <= gateBuffer) return true;

    // Check distance from bottom gate (center X, startY + height - 1)
    if (Math.abs(x - centerX) <= gateBuffer && Math.abs(y - (startY + height - 1)) <= gateBuffer) return true;

    // Check distance from left gate (startX, center Y)
    if (Math.abs(x - startX) <= gateBuffer && Math.abs(y - centerY) <= gateBuffer) return true;

    // Check distance from right gate (startX + width - 1, center Y)
    if (Math.abs(x - (startX + width - 1)) <= gateBuffer && Math.abs(y - centerY) <= gateBuffer) return true;

    return false;
  }

  private createPenDecorations(penId: string, startX: number, startY: number, width: number, height: number): void {
    switch (penId) {
      case 'meadow':
        // Add trees (scaled positions for 3x larger pens, avoiding gates, 2x tree scale)
        const treeWidth = TILE_SIZE * 4;
        const treeHeight = TILE_SIZE * 6;

        if (!this.isNearGate(startX + 8, startY + 10, startX, startY, width, height)) {
          this.add.image((startX + 8) * TILE_SIZE + treeWidth/2, (startY + 10) * TILE_SIZE + treeHeight/2, 'tree').setDepth((startY + 10) * TILE_SIZE + treeHeight);
        }
        if (!this.isNearGate(startX + width - 10, startY + 15, startX, startY, width, height)) {
          this.add.image((startX + width - 10) * TILE_SIZE + treeWidth/2, (startY + 15) * TILE_SIZE + treeHeight/2, 'tree').setDepth((startY + 15) * TILE_SIZE + treeHeight);
        }
        if (!this.isNearGate(startX + 20, startY + 30, startX, startY, width, height)) {
          this.add.image((startX + 20) * TILE_SIZE + treeWidth/2, (startY + 30) * TILE_SIZE + treeHeight/2, 'tree').setDepth((startY + 30) * TILE_SIZE + treeHeight);
        }
        // Add flowers (more for larger pen, avoiding gates)
        for (let i = 0; i < 15; i++) {
          let fx, fy, attempts = 0;
          do {
            fx = startX + 4 + Math.random() * (width - 8);
            fy = startY + 4 + Math.random() * (height - 8);
            attempts++;
          } while (this.isNearGate(fx, fy, startX, startY, width, height) && attempts < 20);

          if (attempts < 20) {
            const flowerTypes = ['flower_red', 'flower_yellow', 'flower_blue', 'flower_pink'];
            this.add.image(fx * TILE_SIZE, fy * TILE_SIZE, flowerTypes[Math.floor(Math.random() * 4)]).setDepth(fy * TILE_SIZE);
          }
        }
        break;

      case 'snow':
        // Add pine trees (scaled positions for 3x larger pens, avoiding gates, 2x tree scale)
        const pineTreeWidth = TILE_SIZE * 4;
        const pineTreeHeight = TILE_SIZE * 6;

        if (!this.isNearGate(startX + 8, startY + 10, startX, startY, width, height)) {
          this.add.image((startX + 8) * TILE_SIZE + pineTreeWidth/2, (startY + 10) * TILE_SIZE + pineTreeHeight/2, 'pine_tree').setDepth((startY + 10) * TILE_SIZE + pineTreeHeight);
        }
        if (!this.isNearGate(startX + width - 10, startY + 12, startX, startY, width, height)) {
          this.add.image((startX + width - 10) * TILE_SIZE + pineTreeWidth/2, (startY + 12) * TILE_SIZE + pineTreeHeight/2, 'pine_tree').setDepth((startY + 12) * TILE_SIZE + pineTreeHeight);
        }
        if (!this.isNearGate(startX + 25, startY + 30, startX, startY, width, height)) {
          this.add.image((startX + 25) * TILE_SIZE + pineTreeWidth/2, (startY + 30) * TILE_SIZE + pineTreeHeight/2, 'pine_tree').setDepth((startY + 30) * TILE_SIZE + pineTreeHeight);
        }
        // Add snowman (avoiding gates)
        if (!this.isNearGate(startX + width / 2, startY + height - 10, startX, startY, width, height)) {
          this.add.image((startX + width / 2) * TILE_SIZE, (startY + height - 10) * TILE_SIZE, 'snowman').setDepth((startY + height - 10) * TILE_SIZE);
        }
        break;

      case 'pond':
        // Water is already in the ground tiles
        // Add some trees around the pond (avoiding gates, 2x tree scale)
        const pondTreeWidth = TILE_SIZE * 4;
        const pondTreeHeight = TILE_SIZE * 6;

        if (!this.isNearGate(startX + 8, startY + 8, startX, startY, width, height)) {
          this.add.image((startX + 8) * TILE_SIZE + pondTreeWidth/2, (startY + 8) * TILE_SIZE + pondTreeHeight/2, 'tree').setDepth((startY + 8) * TILE_SIZE + pondTreeHeight);
        }
        if (!this.isNearGate(startX + width - 8, startY + height - 8, startX, startY, width, height)) {
          this.add.image((startX + width - 8) * TILE_SIZE + pondTreeWidth/2, (startY + height - 8) * TILE_SIZE + pondTreeHeight/2, 'tree').setDepth((startY + height - 8) * TILE_SIZE + pondTreeHeight);
        }
        break;

      case 'beach':
        // Add palm trees (scaled positions for 3x larger pens, avoiding gates, 2x tree scale)
        const palmTreeWidth = TILE_SIZE * 4;
        const palmTreeHeight = TILE_SIZE * 6;

        if (!this.isNearGate(startX + 10, startY + 10, startX, startY, width, height)) {
          this.add.image((startX + 10) * TILE_SIZE + palmTreeWidth/2, (startY + 10) * TILE_SIZE + palmTreeHeight/2, 'palm_tree').setDepth((startY + 10) * TILE_SIZE + palmTreeHeight);
        }
        if (!this.isNearGate(startX + 30, startY + 25, startX, startY, width, height)) {
          this.add.image((startX + 30) * TILE_SIZE + palmTreeWidth/2, (startY + 25) * TILE_SIZE + palmTreeHeight/2, 'palm_tree').setDepth((startY + 25) * TILE_SIZE + palmTreeHeight);
        }
        // Add beach umbrellas (avoiding gates)
        if (!this.isNearGate(startX + width / 2, startY + height - 12, startX, startY, width, height)) {
          this.add.image((startX + width / 2) * TILE_SIZE, (startY + height - 12) * TILE_SIZE, 'beach_umbrella').setDepth((startY + height - 12) * TILE_SIZE);
        }
        if (!this.isNearGate(startX + 20, startY + height - 15, startX, startY, width, height)) {
          this.add.image((startX + 20) * TILE_SIZE, (startY + height - 15) * TILE_SIZE, 'beach_umbrella').setDepth((startY + height - 15) * TILE_SIZE);
        }
        break;

      case 'mountain':
        // Add boulders (scaled positions for 3x larger pens, avoiding gates)
        if (!this.isNearGate(startX + 10, startY + 10, startX, startY, width, height)) {
          this.add.image((startX + 10) * TILE_SIZE, (startY + 10) * TILE_SIZE, 'boulder').setDepth((startY + 10) * TILE_SIZE + TILE_SIZE);
        }
        if (!this.isNearGate(startX + width - 12, startY + height - 12, startX, startY, width, height)) {
          this.add.image((startX + width - 12) * TILE_SIZE, (startY + height - 12) * TILE_SIZE, 'boulder').setDepth((startY + height - 12) * TILE_SIZE + TILE_SIZE);
        }
        if (!this.isNearGate(startX + 30, startY + 25, startX, startY, width, height)) {
          this.add.image((startX + 30) * TILE_SIZE, (startY + 25) * TILE_SIZE, 'boulder').setDepth((startY + 25) * TILE_SIZE + TILE_SIZE);
        }
        // Add cave (avoiding gates)
        if (!this.isNearGate(startX + width / 2, startY + 8, startX, startY, width, height)) {
          this.add.image((startX + width / 2) * TILE_SIZE, (startY + 8) * TILE_SIZE, 'cave').setDepth((startY + 8) * TILE_SIZE);
        }
        break;

      case 'butterfly':
        // Add lots of flowers (more for larger pen, avoiding gates)
        for (let i = 0; i < 35; i++) {
          let fx, fy, attempts = 0;
          do {
            fx = startX + 4 + Math.random() * (width - 8);
            fy = startY + 4 + Math.random() * (height - 8);
            attempts++;
          } while (this.isNearGate(fx, fy, startX, startY, width, height) && attempts < 20);

          if (attempts < 20) {
            const flowerTypes = ['flower_red', 'flower_yellow', 'flower_blue', 'flower_pink'];
            this.add.image(fx * TILE_SIZE, fy * TILE_SIZE, flowerTypes[Math.floor(Math.random() * 4)]).setDepth(fy * TILE_SIZE);
          }
        }
        break;
    }
  }

  private createVacantPenFencing(startX: number, startY: number, width: number, height: number): void {
    // Create fencing group for vacant pen (similar to createPenFences but without pen data)
    const fences = this.physics.add.staticGroup();

    // Gate positions (all gates are 2 tiles wide/tall and centered)
    const horizontalGateStartX = startX + Math.floor(width / 2) - 1;
    const horizontalGateEndX = horizontalGateStartX + 2;
    const verticalGateStartY = startY + Math.floor(height / 2) - 1;
    const verticalGateEndY = verticalGateStartY + 2;

    // Top fence (with gate) - horizontal, spaced
    for (let x = startX; x < startX + width; x += 2) { // Skip every other tile for spacing
      if (x >= horizontalGateStartX && x < horizontalGateEndX) continue; // Skip gate
      this.createFencePost(fences, x, startY, false);
    }

    // Bottom fence (with gate) - horizontal, spaced
    for (let x = startX; x < startX + width; x += 2) { // Skip every other tile for spacing
      if (x >= horizontalGateStartX && x < horizontalGateEndX) continue; // Skip gate
      this.createFencePost(fences, x, startY + height - 1, false);
    }

    // Left fence (with gate) - vertical, spaced
    for (let y = startY + 1; y < startY + height - 1; y += 2) { // Skip every other tile for spacing
      if (y >= verticalGateStartY && y < verticalGateEndY) continue; // Skip gate
      this.createFencePost(fences, startX, y, true);
    }

    // Right fence (with gate) - vertical, spaced
    for (let y = startY + 1; y < startY + height - 1; y += 2) { // Skip every other tile for spacing
      if (y >= verticalGateStartY && y < verticalGateEndY) continue; // Skip gate
      this.createFencePost(fences, startX + width - 1, y, true);
    }
  }

  private createPlayer(): void {
    // Start player near the center of the farm
    this.player = this.physics.add.sprite(
      82 * TILE_SIZE + TILE_SIZE / 2,
      15 * TILE_SIZE + PLAYER_HEIGHT / 2,
      'player_down'
    ) as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;

    // Scale will be set by PlayerAnimator
    this.player.setSize(800, 400);
    this.player.setOffset(400, 2400);
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(this.player.y);

    // Initialize player animator
    this.playerAnimator = new PlayerAnimator(this, this.player);

    // Collide with global fences (buildings)
    this.physics.add.collider(this.player, this.globalFences);

    // Collide with all pen fences
    this.pens.forEach(pen => {
      this.physics.add.collider(this.player, pen.fences);
    });
  }

  private createOwnedPets(): void {
    this.pets = this.physics.add.group();

    const caughtPets = PetManager.getCaughtPets();

    if (caughtPets.length === 0) {
      // Show message if no pets
      const noPetsText = this.add.text(
        82 * TILE_SIZE,
        20 * TILE_SIZE,
        'No pets yet!\nGo explore and catch some!',
        {
          fontSize: '12px',
          color: '#666666',
          align: 'center',
        }
      );
      noPetsText.setOrigin(0.5);
      noPetsText.setDepth(100);
      return;
    }

    caughtPets.forEach((petData) => {
      this.spawnPet(petData);
    });

    // Pets collide with global fences
    this.physics.add.collider(this.pets, this.globalFences);

    // Pets collide with all pen fences
    this.pens.forEach(pen => {
      this.physics.add.collider(this.pets, pen.fences);
    });

    // Pets collide with each other
    this.physics.add.collider(this.pets, this.pets);
  }

  private getRandomRoamingPosition(): { x: number; y: number } {
    // Roaming zones spread across the larger farm (avoiding buildings and pens)
    const roamingZones = [
      { x: 5, y: 3, w: 20, h: 14 },     // Top-left (near farmhouse)
      { x: 75, y: 3, w: 30, h: 14 },    // Top-center (between buildings)
      { x: 170, y: 20, w: 25, h: 45 },  // Right of first row pens
      { x: 170, y: 75, w: 25, h: 45 },  // Right of second row pens
      { x: 170, y: 130, w: 25, h: 45 }, // Right of third row pens
      { x: 75, y: 70, w: 20, h: 55 },   // Center between pen rows
    ];
    const zone = roamingZones[Math.floor(Math.random() * roamingZones.length)];
    return {
      x: (zone.x + Math.random() * zone.w) * TILE_SIZE,
      y: (zone.y + Math.random() * zone.h) * TILE_SIZE,
    };
  }

  private spawnPet(petData: CaughtPet): Phaser.Physics.Arcade.Sprite {
    let spawnX: number;
    let spawnY: number;

    if (petData.penId && petData.penPosition) {
      // Spawn in assigned pen at saved position
      const pen = this.pens.get(petData.penId);
      if (pen) {
        spawnX = pen.bounds.x + petData.penPosition.x;
        spawnY = pen.bounds.y + petData.penPosition.y;
      } else {
        // Fallback to roaming position
        const pos = this.getRandomRoamingPosition();
        spawnX = pos.x;
        spawnY = pos.y;
      }
    } else {
      // Roaming pet - spawn across the farm
      const pos = this.getRandomRoamingPosition();
      spawnX = pos.x;
      spawnY = pos.y;
    }

    const petType = petData.type.toLowerCase();
    const spriteKey = getSpriteKey(petType, true);

    const pet = this.pets.create(spawnX, spawnY, spriteKey) as Phaser.Physics.Arcade.Sprite;

    pet.setCollideWorldBounds(true);
    pet.setData('wanderTimer', Math.random() * 2000);
    pet.setData('wanderDirection', { x: 0, y: 0 });
    pet.setData('petData', petData);
    pet.setDepth(spawnY);

    // Apply sprite configuration from centralized config
    applyPetSpriteConfig(pet, petType);
    
    // Store original scale for animations (prevents cumulative scaling issues)
    pet.setData('originalScale', pet.scale);

    // Create mood indicator
    const moodIndicator = this.add.text(pet.x, pet.y - 12, '', { fontSize: '10px' });
    moodIndicator.setOrigin(0.5);
    moodIndicator.setDepth(2000);
    this.moodIndicators.set(petData.id, moodIndicator);

    // Create companion indicator
    const companionIndicator = this.add.text(pet.x, pet.y - 20, '', { fontSize: '8px' });
    companionIndicator.setOrigin(0.5);
    companionIndicator.setDepth(2001);
    this.companionIndicators.set(petData.id, companionIndicator);

    if (PetManager.getCompanionId() === petData.id) {
      companionIndicator.setText('⭐');
    }

    return pet;
  }

  private createExitZone(): void {
    // Exit zone at the bottom center
    this.exitZone = this.add.zone(82 * TILE_SIZE, (FARM_HEIGHT - 1) * TILE_SIZE, 4 * TILE_SIZE, TILE_SIZE);

    // Visual indicator
    const exitText = this.add.text(82 * TILE_SIZE, (FARM_HEIGHT - 2) * TILE_SIZE, 'To World', {
      fontSize: '10px',
      color: '#ffffff',
      backgroundColor: '#2d2d44aa',
      padding: { x: 4, y: 2 },
    });
    exitText.setOrigin(0.5);
    exitText.setDepth(100);

    const arrow = this.add.text(82 * TILE_SIZE, (FARM_HEIGHT - 1.5) * TILE_SIZE, '▼', {
      fontSize: '12px',
      color: '#4ade80',
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

  private createUI(): void {
    this.infoText = this.add.text(16, 16, 'WASD move | SPACE pick up | F feed | T/L1 companion | SHIFT/R1 run | M world', {
      fontSize: '10px',
      color: '#ffffff',
      backgroundColor: '#2d2d44dd',
      padding: { x: 6, y: 3 },
    });
    this.infoText.setScrollFactor(0);
    this.infoText.setDepth(1000);

    const petCount = PetManager.getPetCount();
    const assignedCount = PetManager.getCaughtPets().filter(p => p.penId !== null).length;
    this.petCountText = this.add.text(16, 38, `Pets: ${petCount} | In pens: ${assignedCount}`, {
      fontSize: '10px',
      color: '#4ade80',
      backgroundColor: '#2d2d44dd',
      padding: { x: 6, y: 3 },
    });
    this.petCountText.setScrollFactor(0);
    this.petCountText.setDepth(1000);

    const companion = PetManager.getCompanion();
    const companionLabel = companion ? `Companion: ${companion.name}` : 'No companion';
    this.companionText = this.add.text(16, 60, companionLabel, {
      fontSize: '10px',
      color: companion ? '#f472b6' : '#888888',
      backgroundColor: '#2d2d44dd',
      padding: { x: 6, y: 3 },
    });
    this.companionText.setScrollFactor(0);
    this.companionText.setDepth(1000);

    // Carry status text (hidden initially)
    this.carryText = this.add.text(16, 82, '', {
      fontSize: '10px',
      color: '#fbbf24',
      backgroundColor: '#2d2d44dd',
      padding: { x: 6, y: 3 },
    });
    this.carryText.setScrollFactor(0);
    this.carryText.setDepth(1000);
    this.carryText.setVisible(false);

    // Location indicator
    const locationText = this.add.text(
      this.cameras.main.width - 16,
      16,
      'FARM',
      {
        fontSize: '10px',
        color: '#ffd700',
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
      this.feedKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
      this.takeKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.T);
      this.shiftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
      const worldKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);
      const menuKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

      this.interactKey.on('down', () => this.handleInteraction());
      this.feedKey.on('down', () => this.handleFeeding());
      this.takeKey.on('down', () => this.handleTakeWithMe());
      worldKey.on('down', () => this.goToWorld());
      menuKey.on('down', () => this.openMenu());
    }
  }

  private openMenu(): void {
    this.scene.pause();
    this.scene.launch(SCENES.MENU, { previousScene: SCENES.HOME });
    this.scene.bringToTop(SCENES.MENU);
  }

  private handlePlayerMovement(): void {
    let velocityX = 0;
    let velocityY = 0;
    let newDirection = this.playerDirection;

    // Calculate speed with run multiplier
    const isRunning = this.shiftKey?.isDown || GamepadManager.isButtonDown(GAMEPAD_BUTTONS.RB);
    let speed = PLAYER_SPEED;
    if (isRunning) {
      speed *= PLAYER_RUN_MULTIPLIER;
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

    // For analog stick, use the actual stick values for smoother movement (with run multiplier)
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

    // Handle player animations using unified animator
    const moving = velocityX !== 0 || velocityY !== 0;
    this.playerAnimator.updateAnimation(moving, velocityX, isRunning);

    if (newDirection !== this.playerDirection) {
      this.playerDirection = newDirection;
      // PlayerAnimator handles texture changes automatically
    }
  }

  

  private handlePetBehavior(): void {
    const petSpeed = 15;

    this.pets.children.each((pet: Phaser.GameObjects.GameObject) => {
      const sprite = pet as Phaser.Physics.Arcade.Sprite;
      const petData = sprite.getData('petData') as CaughtPet;

      // Skip if this pet is being carried
      if (this.carriedPetData && petData.id === this.carriedPetData.id) {
        return true;
      }

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
          { x: 0, y: 0 },
        ];

        const newDir = directions[Math.floor(Math.random() * directions.length)];
        sprite.setData('wanderDirection', newDir);
        sprite.setData('wanderTimer', 2000 + Math.random() * 4000);
      } else {
        sprite.setData('wanderTimer', timer);
      }

      const dir = sprite.getData('wanderDirection') as { x: number; y: number };

      // If pet is in a pen, constrain movement to pen bounds
      if (petData.penId) {
        const pen = this.pens.get(petData.penId);
        if (pen) {
          const nextX = sprite.x + dir.x * petSpeed * 0.016;
          const nextY = sprite.y + dir.y * petSpeed * 0.016;

          // Check if next position would be outside pen
          if (!pen.bounds.contains(nextX, nextY)) {
            // Reverse direction
            sprite.setData('wanderDirection', { x: -dir.x, y: -dir.y });
            sprite.setVelocity(-dir.x * petSpeed, -dir.y * petSpeed);
          } else {
            sprite.setVelocity(dir.x * petSpeed, dir.y * petSpeed);
          }
        }
      } else {
        sprite.setVelocity(dir.x * petSpeed, dir.y * petSpeed);
      }

      // Handle sprite direction flipping using centralized config
      const petDataForType = sprite.getData('petData') as { type: string };
      const petType = petDataForType.type.toLowerCase();
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

  private updateCarriedPet(): void {
    if (this.carriedPet && this.isCarryingPet) {
      // Position carried pet above player's head
      this.carriedPet.setPosition(this.player.x, this.player.y - 30);
      this.carriedPet.setDepth(this.player.depth + 100);
      this.carriedPet.setVelocity(0, 0);

      // Update highlight position if carrying
      this.updatePenHighlight();
    }
  }

  private updatePenHighlight(): void {
    if (!this.carriedPetData) return;

    const correctPenId = getCorrectPenForPet(this.carriedPetData.type);
    const correctPen = this.pens.get(correctPenId);

    if (correctPen) {
      if (!this.penHighlight) {
        this.penHighlight = this.add.rectangle(
          correctPen.bounds.x + correctPen.bounds.width / 2,
          correctPen.bounds.y + correctPen.bounds.height / 2,
          correctPen.bounds.width,
          correctPen.bounds.height,
          correctPen.color,
          0.3
        );
        this.penHighlight.setStrokeStyle(3, correctPen.color);
        this.penHighlight.setDepth(500);

        // Pulse animation
        this.tweens.add({
          targets: this.penHighlight,
          alpha: { from: 0.3, to: 0.5 },
          duration: 500,
          yoyo: true,
          repeat: -1,
        });
      }
    }
  }

  private clearPenHighlight(): void {
    if (this.penHighlight) {
      this.tweens.killTweensOf(this.penHighlight);
      this.penHighlight.destroy();
      this.penHighlight = null;
    }
  }

  private handleInteraction(): void {
    if (this.isCarryingPet) {
      // Drop the pet
      this.dropPet();
    } else {
      // Try to pick up or pet nearby pet
      const nearestPet = this.findNearestPet();
      if (nearestPet) {
        this.pickUpPet(nearestPet);
      }
    }
  }

  private findNearestPet(): Phaser.Physics.Arcade.Sprite | null {
    let nearestPet: Phaser.Physics.Arcade.Sprite | null = null;
    let nearestDistance = TILE_SIZE * 3;

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

    return nearestPet;
  }

  private pickUpPet(pet: Phaser.Physics.Arcade.Sprite): void {
    const petData = pet.getData('petData') as CaughtPet;

    // Store carried pet reference
    this.carriedPet = pet;
    this.carriedPetData = petData;
    this.isCarryingPet = true;

    // Remove from pen if assigned
    if (petData.penId) {
      PetManager.removePetFromPen(petData.id);
      petData.penId = null;
      petData.penPosition = null;
      pet.setData('petData', petData);
    }

    // Visual feedback
    SoundManager.playPet();

    // Update UI
    this.carryText.setText(`Carrying: ${petData.name}`);
    this.carryText.setVisible(true);

    // Show which pen this pet belongs in
    const correctPenId = getCorrectPenForPet(petData.type);
    const penConfig = getPenConfigById(correctPenId);
    if (penConfig) {
      this.showMessage(`Belongs in: ${penConfig.name}`, '#4ade80');
    }

    // Update pen highlight
    this.updatePenHighlight();

    // Hide mood indicator while carrying
    const moodIndicator = this.moodIndicators.get(petData.id);
    if (moodIndicator) moodIndicator.setVisible(false);

    const companionIndicator = this.companionIndicators.get(petData.id);
    if (companionIndicator) companionIndicator.setVisible(false);
  }

  private dropPet(): void {
    if (!this.carriedPet || !this.carriedPetData) return;

    const dropX = this.player.x;
    const dropY = this.player.y + 20;

    // Check which pen (if any) the player is in
    const penId = this.getPenAtPosition(dropX, dropY);

    if (penId) {
      // Assign pet to this pen
      const pen = this.pens.get(penId);
      if (pen) {
        const relativeX = dropX - pen.bounds.x;
        const relativeY = dropY - pen.bounds.y;

        PetManager.assignPetToPen(this.carriedPetData.id, penId, { x: relativeX, y: relativeY });

        // Update local pet data
        this.carriedPetData.penId = penId;
        this.carriedPetData.penPosition = { x: relativeX, y: relativeY };
        this.carriedPet.setData('petData', this.carriedPetData);

        // Check if correct pen
        const correctPenId = getCorrectPenForPet(this.carriedPetData.type);
        if (penId === correctPenId) {
          this.showMessage(`${this.carriedPetData.name} loves this pen!`, '#4ade80');
          // Happy bounce
          this.tweens.add({
            targets: this.carriedPet,
            y: dropY - 10,
            duration: 150,
            yoyo: true,
            repeat: 2,
          });
        } else {
          this.showMessage(`${this.carriedPetData.name} seems uncomfortable...`, '#f59e0b');
        }
      }
    } else {
      // Dropped outside a pen - pet roams freely
      this.showMessage(`${this.carriedPetData.name} is roaming freely`, '#888888');
    }

    // Position the pet at drop location
    this.carriedPet.setPosition(dropX, dropY);

    // Show indicators again
    const moodIndicator = this.moodIndicators.get(this.carriedPetData.id);
    if (moodIndicator) moodIndicator.setVisible(true);

    const companionIndicator = this.companionIndicators.get(this.carriedPetData.id);
    if (companionIndicator) companionIndicator.setVisible(true);

    // Clear carried state
    this.carriedPet = null;
    this.carriedPetData = null;
    this.isCarryingPet = false;

    // Update UI
    this.carryText.setVisible(false);
    this.clearPenHighlight();

    // Update pet count display
    const petCount = PetManager.getPetCount();
    const assignedCount = PetManager.getCaughtPets().filter(p => p.penId !== null).length;
    this.petCountText.setText(`Pets: ${petCount} | In pens: ${assignedCount}`);

    SoundManager.playClick();
  }

  private getPenAtPosition(x: number, y: number): string | null {
    for (const [penId, pen] of this.pens) {
      if (pen.bounds.contains(x, y)) {
        return penId;
      }
    }
    return null;
  }

  private checkExitZone(): void {
    // Don't allow exit while carrying a pet
    if (this.isCarryingPet) return;

    const playerBounds = this.player.getBounds();
    const zoneBounds = this.exitZone.getBounds();

    if (Phaser.Geom.Rectangle.Overlaps(playerBounds, zoneBounds)) {
      this.goToWorld();
    }
  }

  private goToWorld(): void {
    this.cameras.main.fadeOut(300, 0, 0, 0);

    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(SCENES.WORLD);
    });
  }

  private updateMoodIndicators(): void {
    this.pets.children.each((pet: Phaser.GameObjects.GameObject) => {
      const sprite = pet as Phaser.Physics.Arcade.Sprite;
      const petData = sprite.getData('petData') as CaughtPet;

      if (petData) {
        const indicator = this.moodIndicators.get(petData.id);
        if (indicator && indicator.visible) {
          indicator.setPosition(sprite.x, sprite.y - 14);

          const mood = PetManager.getPetMood(petData);
          let emoji = '';
          switch (mood) {
            case 'happy': emoji = '😊'; break;
            case 'content': emoji = ''; break;
            case 'hungry': emoji = '🍽️'; break;
            case 'sad': emoji = '😢'; break;
          }

          // Show wrong pen indicator if in wrong pen
          if (petData.penId && !PetManager.isPetInCorrectPen(petData.id)) {
            emoji = emoji || '😕';
          }

          indicator.setText(emoji);
        }

        const companionIndicator = this.companionIndicators.get(petData.id);
        if (companionIndicator && companionIndicator.visible) {
          companionIndicator.setPosition(sprite.x, sprite.y - 22);
        }
      }
      return true;
    });
  }

  private handleTakeWithMe(): void {
    if (this.isCarryingPet) return;

    const nearestPet = this.findNearestPet();
    if (!nearestPet) return;

    const petData = nearestPet.getData('petData') as CaughtPet;
    if (!petData) return;

    const currentCompanionId = PetManager.getCompanionId();

    if (currentCompanionId === petData.id) {
      PetManager.clearCompanion();
      this.showMessage(`${petData.name} will stay home`, '#888888');
      this.companionIndicators.forEach(indicator => indicator.setText(''));
    } else {
      PetManager.setCompanion(petData.id);
      this.showMessage(`${petData.name} will follow you!`, '#f472b6');
      this.companionIndicators.forEach((indicator, id) => {
        indicator.setText(id === petData.id ? '⭐' : '');
      });
    }

    const companion = PetManager.getCompanion();
    const companionLabel = companion ? `Companion: ${companion.name}` : 'No companion';
    this.companionText.setText(companionLabel);
    this.companionText.setColor(companion ? '#f472b6' : '#888888');

    SoundManager.playClick();
  }

  private handleFeeding(): void {
    if (this.isCarryingPet) return;

    const nearestPet = this.findNearestPet();
    if (!nearestPet) return;

    const petData = nearestPet.getData('petData') as CaughtPet;
    if (!petData) return;

    SoundManager.playPet();
    PetManager.feedPet(petData.id);

    const updatedPet = PetManager.getPetById(petData.id);
    if (updatedPet) {
      nearestPet.setData('petData', updatedPet);
    }

    const foodEmoji = this.add.text(nearestPet.x, nearestPet.y - 20, '🍖', { fontSize: '14px' });
    foodEmoji.setOrigin(0.5);
    foodEmoji.setDepth(2000);

    this.tweens.add({
      targets: foodEmoji,
      y: foodEmoji.y - 15,
      alpha: 0,
      duration: 600,
      ease: 'Quad.easeOut',
      onComplete: () => foodEmoji.destroy(),
    });

    // Use stored original scale to prevent cumulative scaling from rapid feeds
    const originalScale = nearestPet.getData('originalScale') || nearestPet.scale;
    this.tweens.add({
      targets: nearestPet,
      scaleX: originalScale * 1.1,
      scaleY: originalScale * 0.9,
      duration: 100,
      yoyo: true,
      repeat: 2,
      onComplete: () => {
        nearestPet.setScale(originalScale);
      },
    });

    this.showPetStats(nearestPet, updatedPet || petData);
  }

  private showMessage(text: string, color: string): void {
    const message = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 - 40,
      text,
      {
        fontSize: '12px',
        color: color,
        backgroundColor: '#2d2d44ee',
        padding: { x: 10, y: 6 },
      }
    );
    message.setOrigin(0.5);
    message.setScrollFactor(0);
    message.setDepth(2000);

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

  private showPetStats(pet: Phaser.Physics.Arcade.Sprite, petData: CaughtPet): void {
    const statsContainer = this.add.container(pet.x, pet.y + 24);
    statsContainer.setDepth(2000);

    const bg = this.add.rectangle(0, 0, 80, 50, 0x2d2d44, 0.9);
    bg.setStrokeStyle(1, 0x4a4a6a);
    statsContainer.add(bg);

    const nameText = this.add.text(0, -18, petData.name, { fontSize: '8px', color: '#ffffff' });
    nameText.setOrigin(0.5);
    statsContainer.add(nameText);

    // Show pen status
    const correctPenId = getCorrectPenForPet(petData.type);
    const penStatus = petData.penId === correctPenId ? '✓ Correct pen' :
                      petData.penId ? '✗ Wrong pen' : 'Roaming';
    const penColor = petData.penId === correctPenId ? '#4ade80' :
                     petData.penId ? '#f59e0b' : '#888888';

    const penText = this.add.text(0, -8, penStatus, { fontSize: '7px', color: penColor });
    penText.setOrigin(0.5);
    statsContainer.add(penText);

    // Hunger bar
    const hungerLabel = this.add.text(-35, 3, '🍖', { fontSize: '8px' });
    hungerLabel.setOrigin(0, 0.5);
    statsContainer.add(hungerLabel);

    const hungerBg = this.add.rectangle(5, 3, 40, 6, 0x333333);
    statsContainer.add(hungerBg);

    const hungerFill = this.add.rectangle(
      5 - 20 + (petData.hunger / 100) * 20,
      3,
      (petData.hunger / 100) * 40,
      6,
      petData.hunger > 30 ? 0xf59e0b : 0xef4444
    );
    statsContainer.add(hungerFill);

    // Happiness bar
    const happyLabel = this.add.text(-35, 13, '❤️', { fontSize: '8px' });
    happyLabel.setOrigin(0, 0.5);
    statsContainer.add(happyLabel);

    const happyBg = this.add.rectangle(5, 13, 40, 6, 0x333333);
    statsContainer.add(happyBg);

    const happyFill = this.add.rectangle(
      5 - 20 + (petData.happiness / 100) * 20,
      13,
      (petData.happiness / 100) * 40,
      6,
      petData.happiness > 30 ? 0xec4899 : 0xef4444
    );
    statsContainer.add(happyFill);

    this.tweens.add({
      targets: statsContainer,
      alpha: 0,
      y: statsContainer.y + 10,
      duration: 500,
      delay: 2000,
      onComplete: () => statsContainer.destroy(),
    });
  }
}
