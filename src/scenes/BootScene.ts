import Phaser from 'phaser';
import { SCENES, TILE_SIZE, PLAYER_WIDTH, PLAYER_HEIGHT, PALETTE, PET_TYPES } from '../utils/constants';
import { SoundManager } from '../systems/SoundManager';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENES.BOOT });
  }

  preload(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Loading text
    const loadingText = this.add.text(width / 2, height / 2, 'Loading Pet World...', {
      fontSize: '24px',
      color: '#ffffff',
    });
    loadingText.setOrigin(0.5, 0.5);

    // Load player sprites from image files
    this.load.image('player_down', '/assets/sprites/player_down.png');
    this.load.image('player_up', '/assets/sprites/player_up.png');
    this.load.image('player_left', '/assets/sprites/player_left.png');
    this.load.image('player_right', '/assets/sprites/player_right.png');
    this.load.image('player', '/assets/sprites/player_down.png');

    // Load puppy companion sprites
    this.load.image('puppy_left', '/assets/sprites/puppy_left.png');
    this.load.image('puppy_right', '/assets/sprites/puppy_right.png');
    this.load.image('puppy_left_ball', '/assets/sprites/puppy_left_ball.png');
    this.load.image('puppy_right_ball', '/assets/sprites/puppy_right_ball.png');

    // Load cat/kitty sprites
    this.load.image('cat_left', '/assets/sprites/cat_left.png');
    this.load.image('cat_right', '/assets/sprites/cat_right.png');

    // Load chick sprites
    this.load.image('chick_left', '/assets/sprites/chick_left.png');
    this.load.image('chick_right', '/assets/sprites/chick_right.png');

    // Load frog sprites
    this.load.image('frog_left', '/assets/sprites/frog_left.png');
    this.load.image('frog_right', '/assets/sprites/frog_right.png');

    // Load penguin sprites
    this.load.image('penguin_left', '/assets/sprites/penguin_left.png');
    this.load.image('penguin_right', '/assets/sprites/penguin_right.png');

    // Load starfish sprites
    this.load.image('starfish_left', '/assets/sprites/starfish_left.png');
    this.load.image('starfish_right', '/assets/sprites/starfish_right.png');

    // Load turtle sprites
    this.load.image('turtle_left', '/assets/sprites/turtle_left.png');
    this.load.image('turtle_right', '/assets/sprites/turtle_right.png');

    // Load bunny sprites
    this.load.image('bunny_left', '/assets/sprites/bunny_left.png');
    this.load.image('bunny_right', '/assets/sprites/bunny_right.png');

    // Load bear (bear_cub) sprites
    this.load.image('bear_left', '/assets/sprites/bear_left.png');
    this.load.image('bear_right', '/assets/sprites/bear_right.png');

    // Load crab sprites
    this.load.image('crab_left', '/assets/sprites/crab_left.png');
    this.load.image('crab_right', '/assets/sprites/crab_right.png');

    // Load eagle sprites
    this.load.image('eagle_left', '/assets/sprites/eagle_left.png');
    this.load.image('eagle_right', '/assets/sprites/eagle_right.png');

    // Load fox sprites
    this.load.image('fox_left', '/assets/sprites/fox_left.png');
    this.load.image('fox_right', '/assets/sprites/fox_right.png');

    // Load polar bear sprites
    this.load.image('polar_bear_left', '/assets/sprites/polar_bear_left.png');
    this.load.image('polar_bear_right', '/assets/sprites/polar_bear_right.png');

    // Load seagull sprites
    this.load.image('seagull_left', '/assets/sprites/seagull_left.png');
    this.load.image('seagull_right', '/assets/sprites/seagull_right.png');

    // Load seal sprites
    this.load.image('seal_left', '/assets/sprites/seal_left.png');
    this.load.image('seal_right', '/assets/sprites/seal_right.png');

    // Load snow bunny sprites
    this.load.image('snow_bunny_left', '/assets/sprites/snow_bunny_left.png');
    this.load.image('snow_bunny_right', '/assets/sprites/snow_bunny_right.png');

    // Generate other sprites programmatically
    this.createPetSprites();
    this.createEnvironmentSprites();

    this.load.on('complete', () => {
      loadingText.destroy();
    });
  }

  create(): void {
    // Initialize sound system (sets up listeners for user interaction)
    // Audio will actually start after user clicks/presses a key (browser requirement)
    SoundManager.init();

    // Start the game immediately
    this.scene.start(SCENES.WORLD);
  }

  private createPlayerSprites(): void {
    // Create player facing down (front view - default)
    this.createPlayerDirection('player_down', 'front');
    this.createPlayerDirection('player_up', 'back');
    this.createPlayerDirection('player_left', 'left');
    this.createPlayerDirection('player_right', 'right');

    // Default player texture
    this.createPlayerDirection('player', 'front');
  }

  private createPlayerDirection(key: string, direction: string): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    const w = PLAYER_WIDTH;
    const h = PLAYER_HEIGHT;

    // Shadow
    g.fillStyle(PALETTE.SHADOW, 0.3);
    g.fillEllipse(w / 2, h - 2, 12, 4);

    if (direction === 'front' || direction === 'back') {
      // Body (shirt)
      g.fillStyle(PALETTE.BLUE_SHIRT, 1);
      g.fillRect(3, 14, 10, 14);

      // Body shading
      g.fillStyle(0x3a7bc4, 1);
      g.fillRect(3, 14, 2, 14);

      // Arms
      g.fillStyle(PALETTE.SKIN_MID, 1);
      g.fillRect(1, 16, 2, 6);
      g.fillRect(13, 16, 2, 6);

      // Legs
      g.fillStyle(PALETTE.DIRT_MID, 1);
      g.fillRect(4, 28, 3, 4);
      g.fillRect(9, 28, 3, 4);

      if (direction === 'front') {
        // Head
        g.fillStyle(PALETTE.SKIN_LIGHT, 1);
        g.fillRect(3, 4, 10, 11);

        // Head shading
        g.fillStyle(PALETTE.SKIN_MID, 1);
        g.fillRect(3, 4, 2, 11);

        // Hair
        g.fillStyle(PALETTE.BROWN_HAIR, 1);
        g.fillRect(2, 2, 12, 4);
        g.fillRect(2, 4, 2, 4);
        g.fillRect(12, 4, 2, 4);

        // Eyes
        g.fillStyle(0x000000, 1);
        g.fillRect(5, 8, 2, 3);
        g.fillRect(9, 8, 2, 3);

        // Eye shine
        g.fillStyle(0xffffff, 1);
        g.fillRect(5, 8, 1, 1);
        g.fillRect(9, 8, 1, 1);

        // Mouth
        g.fillStyle(0x000000, 1);
        g.fillRect(7, 12, 2, 1);

        // Blush
        g.fillStyle(0xffaaaa, 0.5);
        g.fillRect(3, 10, 2, 2);
        g.fillRect(11, 10, 2, 2);
      } else {
        // Back of head
        g.fillStyle(PALETTE.BROWN_HAIR, 1);
        g.fillRect(2, 2, 12, 13);

        // Hair detail
        g.fillStyle(0x5a3418, 1);
        g.fillRect(4, 4, 2, 8);
        g.fillRect(10, 4, 2, 8);
      }
    } else {
      // Side view (left or right)
      const flip = direction === 'right';

      // Body
      g.fillStyle(PALETTE.BLUE_SHIRT, 1);
      g.fillRect(4, 14, 8, 14);

      // Arm (visible one)
      g.fillStyle(PALETTE.SKIN_MID, 1);
      if (flip) {
        g.fillRect(11, 16, 3, 6);
      } else {
        g.fillRect(2, 16, 3, 6);
      }

      // Legs
      g.fillStyle(PALETTE.DIRT_MID, 1);
      g.fillRect(5, 28, 3, 4);
      g.fillRect(9, 28, 2, 4);

      // Head
      g.fillStyle(PALETTE.SKIN_LIGHT, 1);
      g.fillRect(4, 4, 8, 11);

      // Hair
      g.fillStyle(PALETTE.BROWN_HAIR, 1);
      g.fillRect(3, 2, 10, 5);
      if (flip) {
        g.fillRect(3, 4, 3, 6);
      } else {
        g.fillRect(10, 4, 3, 6);
      }

      // Eye (one visible)
      g.fillStyle(0x000000, 1);
      if (flip) {
        g.fillRect(9, 8, 2, 3);
      } else {
        g.fillRect(5, 8, 2, 3);
      }
    }

    g.generateTexture(key, w, h);
    g.destroy();
  }

  private createPetSprites(): void {
    // Create different pet types
    Object.entries(PET_TYPES).forEach(([key, config]) => {
      this.createPetSprite(`pet_${key.toLowerCase()}`, config.primary, config.secondary);
    });

    // Default pet (bunny)
    this.createPetSprite('pet', PET_TYPES.BUNNY.primary, PET_TYPES.BUNNY.secondary);
  }

  private createPetSprite(key: string, primaryColor: number, secondaryColor: number): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    const size = TILE_SIZE;

    // Shadow
    g.fillStyle(PALETTE.SHADOW, 0.3);
    g.fillEllipse(size / 2, size - 2, 10, 3);

    // Body
    g.fillStyle(primaryColor, 1);
    g.fillRect(3, 6, 10, 8);

    // Body highlight
    g.fillStyle(secondaryColor, 1);
    g.fillRect(4, 7, 3, 3);

    // Head
    g.fillStyle(primaryColor, 1);
    g.fillRect(2, 2, 12, 6);

    // Ears (bunny style - can vary per pet type)
    g.fillStyle(primaryColor, 1);
    g.fillRect(3, 0, 3, 3);
    g.fillRect(10, 0, 3, 3);

    // Inner ear
    g.fillStyle(secondaryColor, 1);
    g.fillRect(4, 1, 1, 2);
    g.fillRect(11, 1, 1, 2);

    // Eyes
    g.fillStyle(0x000000, 1);
    g.fillRect(4, 4, 2, 2);
    g.fillRect(10, 4, 2, 2);

    // Eye shine
    g.fillStyle(0xffffff, 1);
    g.fillRect(4, 4, 1, 1);
    g.fillRect(10, 4, 1, 1);

    // Nose
    g.fillStyle(secondaryColor, 1);
    g.fillRect(7, 6, 2, 1);

    // Blush
    g.fillStyle(0xffaaaa, 0.4);
    g.fillRect(2, 5, 2, 2);
    g.fillRect(12, 5, 2, 2);

    // Feet
    g.fillStyle(primaryColor, 1);
    g.fillRect(4, 13, 3, 2);
    g.fillRect(9, 13, 3, 2);

    g.generateTexture(key, size, size);
    g.destroy();
  }

  private createEnvironmentSprites(): void {
    this.createGrassSprite();
    this.createGrassVariants();
    this.createWaterSprite();
    this.createTreeSprite();
    this.createPathSprite();
    this.createFlowerSprites();
    this.createBridgeSprite();
    this.createButterflySprites();
    this.createSnowSprites();
    this.createSnowPetSprites();
    this.createBeachSprites();
    this.createBeachPetSprites();
    this.createMountainSprites();
    this.createMountainPetSprites();
    this.createToolSprites();
    this.createBallSprite();
  }

  private createGrassSprite(): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    const size = TILE_SIZE;

    // Base grass
    g.fillStyle(PALETTE.GRASS_MID, 1);
    g.fillRect(0, 0, size, size);

    // Lighter patches
    g.fillStyle(PALETTE.GRASS_LIGHT, 1);
    g.fillRect(2, 2, 3, 2);
    g.fillRect(10, 8, 4, 3);
    g.fillRect(4, 12, 2, 2);

    // Darker patches
    g.fillStyle(PALETTE.GRASS_DARK, 1);
    g.fillRect(8, 3, 2, 2);
    g.fillRect(1, 10, 3, 2);
    g.fillRect(12, 13, 3, 2);

    // Small grass blades
    g.fillStyle(PALETTE.GRASS_DARK, 1);
    g.fillRect(6, 1, 1, 2);
    g.fillRect(14, 6, 1, 2);
    g.fillRect(3, 14, 1, 2);

    g.generateTexture('grass', size, size);
    g.destroy();
  }

  private createGrassVariants(): void {
    // Grass with flowers
    const g = this.make.graphics({ x: 0, y: 0 });
    const size = TILE_SIZE;

    // Base grass
    g.fillStyle(PALETTE.GRASS_MID, 1);
    g.fillRect(0, 0, size, size);

    // Grass variation
    g.fillStyle(PALETTE.GRASS_LIGHT, 1);
    g.fillRect(1, 5, 2, 2);
    g.fillRect(11, 2, 3, 2);

    g.fillStyle(PALETTE.GRASS_DARK, 1);
    g.fillRect(6, 10, 2, 2);
    g.fillRect(13, 12, 2, 2);

    // Small flower
    g.fillStyle(0xffff00, 1);
    g.fillRect(4, 3, 2, 2);
    g.fillStyle(0xffffff, 1);
    g.fillRect(3, 4, 1, 1);
    g.fillRect(6, 4, 1, 1);
    g.fillRect(4, 2, 1, 1);
    g.fillRect(5, 5, 1, 1);

    g.generateTexture('grass_flower', size, size);
    g.destroy();
  }

  private createWaterSprite(): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    const size = TILE_SIZE;

    // Base water
    g.fillStyle(PALETTE.WATER_MID, 1);
    g.fillRect(0, 0, size, size);

    // Lighter ripples
    g.fillStyle(PALETTE.WATER_LIGHT, 1);
    g.fillRect(2, 3, 5, 1);
    g.fillRect(9, 7, 4, 1);
    g.fillRect(1, 12, 6, 1);

    // Darker depth
    g.fillStyle(PALETTE.WATER_DARK, 1);
    g.fillRect(7, 1, 3, 1);
    g.fillRect(3, 9, 4, 1);
    g.fillRect(10, 14, 5, 1);

    // Sparkle
    g.fillStyle(0xffffff, 0.6);
    g.fillRect(4, 5, 1, 1);
    g.fillRect(11, 10, 1, 1);

    g.generateTexture('water', size, size);
    g.destroy();
  }

  private createTreeSprite(): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    const treeWidth = TILE_SIZE * 2;
    const treeHeight = TILE_SIZE * 3;

    // Shadow on ground
    g.fillStyle(PALETTE.SHADOW, 0.3);
    g.fillEllipse(treeWidth / 2, treeHeight - 4, 20, 8);

    // Trunk
    g.fillStyle(PALETTE.WOOD_MID, 1);
    g.fillRect(12, 28, 8, 20);

    // Trunk shading (left side darker)
    g.fillStyle(PALETTE.WOOD_DARK, 1);
    g.fillRect(12, 28, 3, 20);

    // Trunk highlight (right side lighter)
    g.fillStyle(PALETTE.WOOD_LIGHT, 1);
    g.fillRect(17, 30, 2, 16);

    // Foliage layers (bottom to top for depth)
    // Bottom layer
    g.fillStyle(PALETTE.GRASS_DARK, 1);
    g.fillRect(4, 20, 24, 12);

    // Middle layer
    g.fillStyle(PALETTE.GRASS_MID, 1);
    g.fillRect(6, 12, 20, 12);

    // Top layer
    g.fillStyle(PALETTE.GRASS_LIGHT, 1);
    g.fillRect(8, 4, 16, 12);

    // Top point
    g.fillStyle(PALETTE.GRASS_MID, 1);
    g.fillRect(12, 0, 8, 6);

    // Foliage highlights
    g.fillStyle(0x90d870, 1);
    g.fillRect(10, 6, 3, 3);
    g.fillRect(18, 10, 4, 3);
    g.fillRect(8, 18, 3, 4);

    // Foliage shadows
    g.fillStyle(0x2d7a14, 1);
    g.fillRect(6, 14, 4, 4);
    g.fillRect(20, 22, 6, 4);
    g.fillRect(14, 8, 3, 3);

    g.generateTexture('tree', treeWidth, treeHeight);
    g.destroy();
  }

  private createPathSprite(): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    const size = TILE_SIZE;

    // Base path
    g.fillStyle(PALETTE.DIRT_MID, 1);
    g.fillRect(0, 0, size, size);

    // Lighter patches
    g.fillStyle(PALETTE.DIRT_LIGHT, 1);
    g.fillRect(3, 2, 4, 3);
    g.fillRect(10, 9, 3, 4);
    g.fillRect(1, 12, 5, 2);

    // Darker patches/pebbles
    g.fillStyle(PALETTE.DIRT_DARK, 1);
    g.fillRect(8, 2, 2, 2);
    g.fillRect(2, 7, 3, 2);
    g.fillRect(12, 5, 2, 2);
    g.fillRect(6, 13, 2, 2);

    g.generateTexture('path', size, size);
    g.destroy();
  }

  private createFlowerSprites(): void {
    // Red flower
    this.createFlower('flower_red', 0xe74c3c, 0xc0392b);
    // Yellow flower
    this.createFlower('flower_yellow', 0xf1c40f, 0xf39c12);
    // Blue flower
    this.createFlower('flower_blue', 0x3498db, 0x2980b9);
    // Pink flower
    this.createFlower('flower_pink', 0xff69b4, 0xff1493);
  }

  private createFlower(key: string, petalColor: number, centerColor: number): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    const size = TILE_SIZE;

    // Stem
    g.fillStyle(PALETTE.GRASS_DARK, 1);
    g.fillRect(7, 8, 2, 8);

    // Leaves
    g.fillStyle(PALETTE.GRASS_MID, 1);
    g.fillRect(5, 10, 2, 3);
    g.fillRect(9, 12, 2, 3);

    // Petals
    g.fillStyle(petalColor, 1);
    g.fillRect(6, 2, 4, 3);  // top
    g.fillRect(6, 7, 4, 3);  // bottom
    g.fillRect(3, 4, 3, 4);  // left
    g.fillRect(10, 4, 3, 4); // right

    // Center
    g.fillStyle(centerColor, 1);
    g.fillRect(6, 4, 4, 4);

    g.generateTexture(key, size, size);
    g.destroy();
  }

  private createBridgeSprite(): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    const size = TILE_SIZE;

    // Wooden planks (horizontal bridge piece)
    g.fillStyle(PALETTE.WOOD_MID, 1);
    g.fillRect(0, 2, size, size - 4);

    // Plank lines (gaps between planks)
    g.fillStyle(PALETTE.WOOD_DARK, 1);
    g.fillRect(0, 5, size, 1);
    g.fillRect(0, 10, size, 1);

    // Lighter wood highlights
    g.fillStyle(PALETTE.WOOD_LIGHT, 1);
    g.fillRect(2, 3, 4, 1);
    g.fillRect(10, 7, 4, 1);
    g.fillRect(4, 12, 5, 1);

    // Nail details
    g.fillStyle(0x444444, 1);
    g.fillRect(1, 3, 1, 1);
    g.fillRect(14, 3, 1, 1);
    g.fillRect(1, 8, 1, 1);
    g.fillRect(14, 8, 1, 1);
    g.fillRect(1, 12, 1, 1);
    g.fillRect(14, 12, 1, 1);

    // Side rails
    g.fillStyle(PALETTE.WOOD_DARK, 1);
    g.fillRect(0, 0, size, 2);
    g.fillRect(0, size - 2, size, 2);

    g.generateTexture('bridge', size, size);
    g.destroy();
  }

  private createButterflySprites(): void {
    // Create different colored butterflies
    this.createButterfly('butterfly_blue', 0x60a5fa, 0x3b82f6);
    this.createButterfly('butterfly_pink', 0xf472b6, 0xec4899);
    this.createButterfly('butterfly_yellow', 0xfbbf24, 0xf59e0b);
    this.createButterfly('butterfly_purple', 0xa78bfa, 0x8b5cf6);
  }

  private createButterfly(key: string, wingColor: number, accentColor: number): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    const size = TILE_SIZE;

    // Left wing (top)
    g.fillStyle(wingColor, 1);
    g.fillRect(2, 3, 5, 4);

    // Left wing (bottom)
    g.fillRect(3, 7, 4, 3);

    // Right wing (top)
    g.fillRect(9, 3, 5, 4);

    // Right wing (bottom)
    g.fillRect(9, 7, 4, 3);

    // Wing patterns
    g.fillStyle(accentColor, 1);
    g.fillRect(3, 4, 2, 2);
    g.fillRect(11, 4, 2, 2);
    g.fillRect(4, 8, 1, 1);
    g.fillRect(11, 8, 1, 1);

    // Wing edges (white spots)
    g.fillStyle(0xffffff, 0.7);
    g.fillRect(2, 3, 1, 1);
    g.fillRect(6, 3, 1, 1);
    g.fillRect(9, 3, 1, 1);
    g.fillRect(13, 3, 1, 1);

    // Body
    g.fillStyle(0x1a1a1a, 1);
    g.fillRect(7, 2, 2, 9);

    // Head
    g.fillStyle(0x2a2a2a, 1);
    g.fillRect(7, 1, 2, 2);

    // Antennae
    g.fillStyle(0x1a1a1a, 1);
    g.fillRect(6, 0, 1, 2);
    g.fillRect(9, 0, 1, 2);

    g.generateTexture(key, size, size);
    g.destroy();
  }

  private createSnowSprites(): void {
    const size = TILE_SIZE;

    // Snow ground tile
    const g1 = this.make.graphics({ x: 0, y: 0 });
    g1.fillStyle(PALETTE.SNOW_MID, 1);
    g1.fillRect(0, 0, size, size);

    // Snow texture
    g1.fillStyle(PALETTE.SNOW_LIGHT, 1);
    g1.fillRect(2, 2, 3, 2);
    g1.fillRect(10, 6, 4, 2);
    g1.fillRect(5, 12, 3, 2);

    g1.fillStyle(PALETTE.SNOW_DARK, 1);
    g1.fillRect(8, 2, 2, 2);
    g1.fillRect(1, 8, 3, 2);
    g1.fillRect(12, 12, 3, 2);

    g1.generateTexture('snow', size, size);
    g1.destroy();

    // Snow with sparkle
    const g2 = this.make.graphics({ x: 0, y: 0 });
    g2.fillStyle(PALETTE.SNOW_MID, 1);
    g2.fillRect(0, 0, size, size);

    g2.fillStyle(PALETTE.SNOW_LIGHT, 1);
    g2.fillRect(3, 4, 2, 2);
    g2.fillRect(11, 10, 3, 2);

    g2.fillStyle(PALETTE.SNOW_DARK, 1);
    g2.fillRect(7, 8, 2, 2);
    g2.fillRect(2, 12, 2, 2);

    // Sparkles
    g2.fillStyle(0xffffff, 1);
    g2.fillRect(5, 3, 1, 1);
    g2.fillRect(10, 7, 1, 1);
    g2.fillRect(3, 11, 1, 1);
    g2.fillStyle(PALETTE.ICE_LIGHT, 1);
    g2.fillRect(12, 4, 1, 1);
    g2.fillRect(7, 13, 1, 1);

    g2.generateTexture('snow_sparkle', size, size);
    g2.destroy();

    // Ice/frozen pond
    const g3 = this.make.graphics({ x: 0, y: 0 });
    g3.fillStyle(PALETTE.ICE_MID, 1);
    g3.fillRect(0, 0, size, size);

    g3.fillStyle(PALETTE.ICE_LIGHT, 1);
    g3.fillRect(2, 2, 5, 1);
    g3.fillRect(9, 6, 4, 1);
    g3.fillRect(1, 11, 6, 1);

    g3.fillStyle(PALETTE.ICE_DARK, 1);
    g3.fillRect(7, 3, 3, 1);
    g3.fillRect(4, 9, 4, 1);

    // Ice cracks
    g3.fillStyle(PALETTE.SNOW_DARK, 0.5);
    g3.fillRect(5, 5, 1, 4);
    g3.fillRect(6, 8, 3, 1);
    g3.fillRect(10, 10, 1, 3);

    // Shine
    g3.fillStyle(0xffffff, 0.8);
    g3.fillRect(3, 4, 2, 1);
    g3.fillRect(11, 8, 2, 1);

    g3.generateTexture('ice', size, size);
    g3.destroy();

    // Snowy pine tree
    const g4 = this.make.graphics({ x: 0, y: 0 });
    const treeWidth = TILE_SIZE * 2;
    const treeHeight = TILE_SIZE * 3;

    // Shadow
    g4.fillStyle(PALETTE.SHADOW, 0.3);
    g4.fillEllipse(treeWidth / 2, treeHeight - 4, 18, 6);

    // Trunk
    g4.fillStyle(PALETTE.WOOD_MID, 1);
    g4.fillRect(13, 36, 6, 12);
    g4.fillStyle(PALETTE.WOOD_DARK, 1);
    g4.fillRect(13, 36, 2, 12);

    // Pine tree layers (triangular shape)
    // Bottom layer
    g4.fillStyle(0x2d5a27, 1);
    g4.fillRect(4, 28, 24, 10);

    // Middle layer
    g4.fillStyle(0x3d7a37, 1);
    g4.fillRect(6, 18, 20, 12);

    // Top layer
    g4.fillStyle(0x4d8a47, 1);
    g4.fillRect(8, 8, 16, 12);

    // Tip
    g4.fillStyle(0x3d7a37, 1);
    g4.fillRect(12, 2, 8, 8);
    g4.fillRect(14, 0, 4, 4);

    // Snow on branches
    g4.fillStyle(PALETTE.SNOW_LIGHT, 1);
    g4.fillRect(4, 28, 24, 3);
    g4.fillRect(6, 18, 20, 2);
    g4.fillRect(8, 8, 16, 2);
    g4.fillRect(12, 2, 8, 2);
    g4.fillRect(14, 0, 4, 2);

    // Snow details
    g4.fillStyle(PALETTE.SNOW_MID, 1);
    g4.fillRect(8, 30, 4, 2);
    g4.fillRect(20, 30, 4, 2);
    g4.fillRect(10, 19, 3, 2);
    g4.fillRect(18, 20, 3, 2);

    g4.generateTexture('pine_tree', treeWidth, treeHeight);
    g4.destroy();

    // Snowman decoration
    const g5 = this.make.graphics({ x: 0, y: 0 });
    g5.fillStyle(PALETTE.SHADOW, 0.3);
    g5.fillEllipse(size / 2, size - 2, 10, 3);

    // Bottom ball
    g5.fillStyle(PALETTE.SNOW_LIGHT, 1);
    g5.fillRect(4, 10, 8, 6);

    // Middle ball
    g5.fillRect(5, 5, 6, 6);

    // Head
    g5.fillRect(6, 1, 4, 5);

    // Eyes
    g5.fillStyle(0x000000, 1);
    g5.fillRect(7, 2, 1, 1);
    g5.fillRect(9, 2, 1, 1);

    // Nose (carrot)
    g5.fillStyle(0xffa500, 1);
    g5.fillRect(8, 3, 2, 1);

    // Buttons
    g5.fillStyle(0x000000, 1);
    g5.fillRect(8, 6, 1, 1);
    g5.fillRect(8, 8, 1, 1);
    g5.fillRect(8, 11, 1, 1);

    // Arms (sticks)
    g5.fillStyle(PALETTE.WOOD_DARK, 1);
    g5.fillRect(1, 7, 4, 1);
    g5.fillRect(11, 7, 4, 1);

    g5.generateTexture('snowman', size, size);
    g5.destroy();
  }

  private createSnowPetSprites(): void {
    const size = TILE_SIZE;

    // Penguin
    const g1 = this.make.graphics({ x: 0, y: 0 });
    g1.fillStyle(PALETTE.SHADOW, 0.3);
    g1.fillEllipse(size / 2, size - 2, 10, 3);

    // Body (black back)
    g1.fillStyle(0x1a1a2e, 1);
    g1.fillRect(4, 4, 8, 10);

    // White belly
    g1.fillStyle(0xffffff, 1);
    g1.fillRect(5, 5, 6, 8);

    // Head
    g1.fillStyle(0x1a1a2e, 1);
    g1.fillRect(4, 1, 8, 5);

    // White face
    g1.fillStyle(0xffffff, 1);
    g1.fillRect(5, 2, 6, 3);

    // Eyes
    g1.fillStyle(0x000000, 1);
    g1.fillRect(5, 3, 2, 2);
    g1.fillRect(9, 3, 2, 2);
    g1.fillStyle(0xffffff, 1);
    g1.fillRect(5, 3, 1, 1);
    g1.fillRect(9, 3, 1, 1);

    // Beak
    g1.fillStyle(0xffa500, 1);
    g1.fillRect(7, 5, 2, 2);

    // Feet
    g1.fillStyle(0xffa500, 1);
    g1.fillRect(4, 13, 3, 2);
    g1.fillRect(9, 13, 3, 2);

    // Wings
    g1.fillStyle(0x1a1a2e, 1);
    g1.fillRect(2, 6, 2, 6);
    g1.fillRect(12, 6, 2, 6);

    g1.generateTexture('pet_penguin', size, size);
    g1.destroy();

    // Polar Bear
    const g2 = this.make.graphics({ x: 0, y: 0 });
    g2.fillStyle(PALETTE.SHADOW, 0.3);
    g2.fillEllipse(size / 2, size - 2, 10, 3);

    // Body
    g2.fillStyle(0xffffff, 1);
    g2.fillRect(3, 6, 10, 8);

    // Body shading
    g2.fillStyle(0xe8e8e8, 1);
    g2.fillRect(3, 6, 3, 8);

    // Head
    g2.fillStyle(0xffffff, 1);
    g2.fillRect(2, 1, 12, 7);

    // Ears
    g2.fillStyle(0xffffff, 1);
    g2.fillRect(2, 0, 3, 3);
    g2.fillRect(11, 0, 3, 3);
    g2.fillStyle(0xe8e8e8, 1);
    g2.fillRect(3, 1, 1, 1);
    g2.fillRect(12, 1, 1, 1);

    // Eyes
    g2.fillStyle(0x000000, 1);
    g2.fillRect(4, 3, 2, 2);
    g2.fillRect(10, 3, 2, 2);
    g2.fillStyle(0xffffff, 1);
    g2.fillRect(4, 3, 1, 1);
    g2.fillRect(10, 3, 1, 1);

    // Nose
    g2.fillStyle(0x000000, 1);
    g2.fillRect(7, 5, 2, 2);

    // Feet
    g2.fillStyle(0xe8e8e8, 1);
    g2.fillRect(4, 13, 3, 2);
    g2.fillRect(9, 13, 3, 2);

    g2.generateTexture('pet_polar_bear', size, size);
    g2.destroy();

    // Snow Bunny (white bunny)
    const g3 = this.make.graphics({ x: 0, y: 0 });
    g3.fillStyle(PALETTE.SHADOW, 0.3);
    g3.fillEllipse(size / 2, size - 2, 10, 3);

    // Body
    g3.fillStyle(0xffffff, 1);
    g3.fillRect(3, 6, 10, 8);

    g3.fillStyle(0xe8e8e8, 1);
    g3.fillRect(4, 7, 3, 3);

    // Head
    g3.fillStyle(0xffffff, 1);
    g3.fillRect(2, 2, 12, 6);

    // Ears (long bunny ears)
    g3.fillStyle(0xffffff, 1);
    g3.fillRect(3, 0, 3, 4);
    g3.fillRect(10, 0, 3, 4);

    // Inner ear (pink)
    g3.fillStyle(0xffb6c1, 1);
    g3.fillRect(4, 1, 1, 2);
    g3.fillRect(11, 1, 1, 2);

    // Eyes
    g3.fillStyle(0x000000, 1);
    g3.fillRect(4, 4, 2, 2);
    g3.fillRect(10, 4, 2, 2);
    g3.fillStyle(0xffffff, 1);
    g3.fillRect(4, 4, 1, 1);
    g3.fillRect(10, 4, 1, 1);

    // Nose
    g3.fillStyle(0xffb6c1, 1);
    g3.fillRect(7, 6, 2, 1);

    // Blush
    g3.fillStyle(0xffaaaa, 0.4);
    g3.fillRect(2, 5, 2, 2);
    g3.fillRect(12, 5, 2, 2);

    // Feet
    g3.fillStyle(0xffffff, 1);
    g3.fillRect(4, 13, 3, 2);
    g3.fillRect(9, 13, 3, 2);

    g3.generateTexture('pet_snow_bunny', size, size);
    g3.destroy();

    // Seal
    const g4 = this.make.graphics({ x: 0, y: 0 });
    g4.fillStyle(PALETTE.SHADOW, 0.3);
    g4.fillEllipse(size / 2, size - 2, 10, 3);

    // Body (elongated)
    g4.fillStyle(0x708090, 1);
    g4.fillRect(2, 7, 12, 6);

    // Body highlight
    g4.fillStyle(0xa9a9a9, 1);
    g4.fillRect(4, 8, 6, 3);

    // Head
    g4.fillStyle(0x708090, 1);
    g4.fillRect(3, 2, 10, 7);

    // Face highlight
    g4.fillStyle(0xa9a9a9, 1);
    g4.fillRect(5, 3, 6, 4);

    // Eyes
    g4.fillStyle(0x000000, 1);
    g4.fillRect(5, 4, 2, 2);
    g4.fillRect(9, 4, 2, 2);
    g4.fillStyle(0xffffff, 1);
    g4.fillRect(5, 4, 1, 1);
    g4.fillRect(9, 4, 1, 1);

    // Nose
    g4.fillStyle(0x000000, 1);
    g4.fillRect(7, 6, 2, 2);

    // Whiskers
    g4.fillStyle(0x505050, 1);
    g4.fillRect(2, 6, 3, 1);
    g4.fillRect(11, 6, 3, 1);

    // Flippers
    g4.fillStyle(0x607080, 1);
    g4.fillRect(1, 9, 2, 4);
    g4.fillRect(13, 9, 2, 4);

    // Tail
    g4.fillRect(6, 12, 4, 3);

    g4.generateTexture('pet_seal', size, size);
    g4.destroy();
  }

  private createBeachSprites(): void {
    const size = TILE_SIZE;

    // Sand tile
    const g1 = this.make.graphics({ x: 0, y: 0 });
    g1.fillStyle(PALETTE.SAND_MID, 1);
    g1.fillRect(0, 0, size, size);

    g1.fillStyle(PALETTE.SAND_LIGHT, 1);
    g1.fillRect(2, 3, 3, 2);
    g1.fillRect(10, 8, 4, 2);
    g1.fillRect(5, 12, 3, 2);

    g1.fillStyle(PALETTE.SAND_DARK, 1);
    g1.fillRect(8, 2, 2, 2);
    g1.fillRect(1, 9, 3, 2);
    g1.fillRect(12, 13, 3, 2);

    g1.generateTexture('sand', size, size);
    g1.destroy();

    // Sand with shells
    const g2 = this.make.graphics({ x: 0, y: 0 });
    g2.fillStyle(PALETTE.SAND_MID, 1);
    g2.fillRect(0, 0, size, size);

    g2.fillStyle(PALETTE.SAND_LIGHT, 1);
    g2.fillRect(3, 5, 2, 2);
    g2.fillRect(11, 11, 3, 2);

    g2.fillStyle(PALETTE.SAND_DARK, 1);
    g2.fillRect(7, 9, 2, 2);

    // Shell
    g2.fillStyle(0xffe4c4, 1);
    g2.fillRect(5, 3, 3, 2);
    g2.fillStyle(0xffdab9, 1);
    g2.fillRect(6, 4, 1, 1);

    // Another shell
    g2.fillStyle(0xffb6c1, 1);
    g2.fillRect(10, 6, 2, 2);

    g2.generateTexture('sand_shells', size, size);
    g2.destroy();

    // Ocean/wave tile
    const g3 = this.make.graphics({ x: 0, y: 0 });
    g3.fillStyle(PALETTE.OCEAN_MID, 1);
    g3.fillRect(0, 0, size, size);

    g3.fillStyle(PALETTE.OCEAN_LIGHT, 1);
    g3.fillRect(0, 2, size, 2);
    g3.fillRect(0, 10, size, 2);

    g3.fillStyle(PALETTE.OCEAN_DARK, 1);
    g3.fillRect(0, 6, size, 1);
    g3.fillRect(0, 14, size, 1);

    // Foam
    g3.fillStyle(0xffffff, 0.6);
    g3.fillRect(2, 3, 4, 1);
    g3.fillRect(10, 11, 5, 1);

    g3.generateTexture('ocean', size, size);
    g3.destroy();

    // Shallow water (transition)
    const g4 = this.make.graphics({ x: 0, y: 0 });
    g4.fillStyle(0x7dd3fc, 1);
    g4.fillRect(0, 0, size, size);

    g4.fillStyle(0xa5f3fc, 1);
    g4.fillRect(2, 2, 5, 2);
    g4.fillRect(9, 8, 4, 2);

    g4.fillStyle(PALETTE.OCEAN_MID, 1);
    g4.fillRect(6, 5, 3, 1);
    g4.fillRect(1, 12, 5, 1);

    g4.generateTexture('shallow_water', size, size);
    g4.destroy();

    // Palm tree
    const g5 = this.make.graphics({ x: 0, y: 0 });
    const treeWidth = TILE_SIZE * 2;
    const treeHeight = TILE_SIZE * 3;

    // Shadow
    g5.fillStyle(PALETTE.SHADOW, 0.3);
    g5.fillEllipse(treeWidth / 2, treeHeight - 4, 18, 6);

    // Trunk (curved)
    g5.fillStyle(0x8b7355, 1);
    g5.fillRect(14, 20, 5, 28);
    g5.fillRect(13, 25, 2, 20);
    g5.fillStyle(0x6b5344, 1);
    g5.fillRect(14, 20, 2, 28);

    // Trunk texture lines
    g5.fillStyle(0x5a4535, 1);
    for (let i = 0; i < 6; i++) {
      g5.fillRect(13, 22 + i * 5, 6, 1);
    }

    // Palm fronds
    g5.fillStyle(0x228b22, 1);
    // Left frond
    g5.fillRect(2, 8, 12, 4);
    g5.fillRect(0, 10, 8, 3);
    // Right frond
    g5.fillRect(18, 8, 12, 4);
    g5.fillRect(24, 10, 8, 3);
    // Top fronds
    g5.fillRect(10, 2, 12, 4);
    g5.fillRect(8, 4, 16, 6);
    // Down fronds
    g5.fillRect(6, 14, 6, 4);
    g5.fillRect(20, 14, 6, 4);

    g5.fillStyle(0x32cd32, 1);
    g5.fillRect(12, 4, 8, 3);
    g5.fillRect(4, 9, 6, 2);
    g5.fillRect(22, 9, 6, 2);

    g5.generateTexture('palm_tree', treeWidth, treeHeight);
    g5.destroy();

    // Beach umbrella decoration
    const g6 = this.make.graphics({ x: 0, y: 0 });
    g6.fillStyle(PALETTE.SHADOW, 0.3);
    g6.fillEllipse(size / 2, size - 2, 10, 3);

    // Pole
    g6.fillStyle(PALETTE.WOOD_MID, 1);
    g6.fillRect(7, 6, 2, 10);

    // Umbrella top
    g6.fillStyle(0xff6347, 1);
    g6.fillRect(2, 2, 12, 5);
    g6.fillStyle(0xffffff, 1);
    g6.fillRect(4, 2, 3, 5);
    g6.fillRect(10, 2, 3, 5);

    g6.generateTexture('beach_umbrella', size, size);
    g6.destroy();
  }

  private createBeachPetSprites(): void {
    const size = TILE_SIZE;

    // Crab
    const g1 = this.make.graphics({ x: 0, y: 0 });
    g1.fillStyle(PALETTE.SHADOW, 0.3);
    g1.fillEllipse(size / 2, size - 2, 10, 3);

    // Body
    g1.fillStyle(0xff6347, 1);
    g1.fillRect(4, 6, 8, 6);

    // Body highlight
    g1.fillStyle(0xff7f50, 1);
    g1.fillRect(5, 7, 4, 3);

    // Eyes on stalks
    g1.fillStyle(0xff6347, 1);
    g1.fillRect(5, 3, 2, 4);
    g1.fillRect(9, 3, 2, 4);
    g1.fillStyle(0x000000, 1);
    g1.fillRect(5, 3, 2, 2);
    g1.fillRect(9, 3, 2, 2);
    g1.fillStyle(0xffffff, 1);
    g1.fillRect(5, 3, 1, 1);
    g1.fillRect(9, 3, 1, 1);

    // Claws
    g1.fillStyle(0xff4500, 1);
    g1.fillRect(0, 6, 4, 4);
    g1.fillRect(12, 6, 4, 4);
    g1.fillRect(0, 5, 2, 2);
    g1.fillRect(14, 5, 2, 2);

    // Legs
    g1.fillStyle(0xff6347, 1);
    g1.fillRect(3, 11, 2, 3);
    g1.fillRect(6, 12, 1, 3);
    g1.fillRect(9, 12, 1, 3);
    g1.fillRect(11, 11, 2, 3);

    g1.generateTexture('pet_crab', size, size);
    g1.destroy();

    // Seagull
    const g2 = this.make.graphics({ x: 0, y: 0 });
    g2.fillStyle(PALETTE.SHADOW, 0.3);
    g2.fillEllipse(size / 2, size - 2, 10, 3);

    // Body
    g2.fillStyle(0xffffff, 1);
    g2.fillRect(4, 7, 8, 5);

    // Wings
    g2.fillStyle(0xd3d3d3, 1);
    g2.fillRect(2, 6, 4, 4);
    g2.fillRect(10, 6, 4, 4);
    g2.fillStyle(0x808080, 1);
    g2.fillRect(2, 6, 2, 2);
    g2.fillRect(12, 6, 2, 2);

    // Head
    g2.fillStyle(0xffffff, 1);
    g2.fillRect(5, 2, 6, 6);

    // Eye
    g2.fillStyle(0x000000, 1);
    g2.fillRect(9, 4, 2, 2);
    g2.fillStyle(0xffffff, 1);
    g2.fillRect(9, 4, 1, 1);

    // Beak
    g2.fillStyle(0xffa500, 1);
    g2.fillRect(11, 5, 3, 2);
    g2.fillStyle(0xff8c00, 1);
    g2.fillRect(13, 6, 1, 1);

    // Legs
    g2.fillStyle(0xffa500, 1);
    g2.fillRect(6, 12, 1, 3);
    g2.fillRect(9, 12, 1, 3);

    g2.generateTexture('pet_seagull', size, size);
    g2.destroy();

    // Turtle
    const g3 = this.make.graphics({ x: 0, y: 0 });
    g3.fillStyle(PALETTE.SHADOW, 0.3);
    g3.fillEllipse(size / 2, size - 2, 10, 3);

    // Shell
    g3.fillStyle(0x2e8b57, 1);
    g3.fillRect(3, 5, 10, 8);

    // Shell pattern
    g3.fillStyle(0x3cb371, 1);
    g3.fillRect(5, 6, 3, 3);
    g3.fillRect(9, 6, 2, 3);
    g3.fillRect(6, 10, 4, 2);

    g3.fillStyle(0x228b22, 1);
    g3.fillRect(3, 5, 2, 8);
    g3.fillRect(11, 5, 2, 8);

    // Head
    g3.fillStyle(0x8fbc8f, 1);
    g3.fillRect(6, 2, 4, 4);

    // Eyes
    g3.fillStyle(0x000000, 1);
    g3.fillRect(6, 3, 1, 1);
    g3.fillRect(9, 3, 1, 1);

    // Flippers
    g3.fillStyle(0x8fbc8f, 1);
    g3.fillRect(1, 7, 3, 3);
    g3.fillRect(12, 7, 3, 3);
    g3.fillRect(5, 12, 2, 2);
    g3.fillRect(9, 12, 2, 2);

    g3.generateTexture('pet_turtle', size, size);
    g3.destroy();

    // Starfish
    const g4 = this.make.graphics({ x: 0, y: 0 });
    g4.fillStyle(PALETTE.SHADOW, 0.3);
    g4.fillEllipse(size / 2, size - 2, 8, 2);

    // Star shape - center
    g4.fillStyle(0xffa07a, 1);
    g4.fillRect(6, 5, 4, 6);

    // Arms
    g4.fillRect(7, 1, 2, 5);  // Top
    g4.fillRect(7, 10, 2, 4); // Bottom
    g4.fillRect(2, 6, 5, 3);  // Left
    g4.fillRect(9, 6, 5, 3);  // Right
    g4.fillRect(3, 3, 3, 3);  // Top-left
    g4.fillRect(10, 3, 3, 3); // Top-right

    // Highlight
    g4.fillStyle(0xff7f50, 1);
    g4.fillRect(7, 6, 2, 3);
    g4.fillRect(7, 2, 2, 2);
    g4.fillRect(3, 7, 2, 1);
    g4.fillRect(11, 7, 2, 1);

    // Eyes (cute!)
    g4.fillStyle(0x000000, 1);
    g4.fillRect(6, 6, 1, 1);
    g4.fillRect(9, 6, 1, 1);

    g4.generateTexture('pet_starfish', size, size);
    g4.destroy();
  }

  private createMountainSprites(): void {
    const size = TILE_SIZE;

    // Rocky ground tile
    const g1 = this.make.graphics({ x: 0, y: 0 });
    g1.fillStyle(PALETTE.ROCK_MID, 1);
    g1.fillRect(0, 0, size, size);

    g1.fillStyle(PALETTE.ROCK_LIGHT, 1);
    g1.fillRect(2, 2, 3, 3);
    g1.fillRect(10, 7, 4, 3);
    g1.fillRect(4, 12, 3, 2);

    g1.fillStyle(PALETTE.ROCK_DARK, 1);
    g1.fillRect(7, 3, 3, 2);
    g1.fillRect(1, 8, 3, 2);
    g1.fillRect(12, 12, 3, 3);

    g1.generateTexture('rock', size, size);
    g1.destroy();

    // Rocky ground with pebbles
    const g2 = this.make.graphics({ x: 0, y: 0 });
    g2.fillStyle(PALETTE.ROCK_MID, 1);
    g2.fillRect(0, 0, size, size);

    g2.fillStyle(PALETTE.ROCK_LIGHT, 1);
    g2.fillRect(3, 4, 2, 2);
    g2.fillRect(11, 10, 3, 2);

    g2.fillStyle(PALETTE.ROCK_DARK, 1);
    g2.fillRect(8, 8, 2, 2);

    // Pebbles
    g2.fillStyle(PALETTE.SLATE_MID, 1);
    g2.fillRect(5, 2, 2, 2);
    g2.fillRect(2, 10, 2, 2);
    g2.fillRect(10, 5, 2, 2);

    g2.generateTexture('rock_pebbles', size, size);
    g2.destroy();

    // Mountain cliff/wall tile
    const g3 = this.make.graphics({ x: 0, y: 0 });
    g3.fillStyle(PALETTE.SLATE_MID, 1);
    g3.fillRect(0, 0, size, size);

    g3.fillStyle(PALETTE.SLATE_LIGHT, 1);
    g3.fillRect(0, 0, size, 3);
    g3.fillRect(2, 3, 4, 2);
    g3.fillRect(10, 5, 5, 2);

    g3.fillStyle(PALETTE.SLATE_DARK, 1);
    g3.fillRect(0, 12, size, 4);
    g3.fillRect(6, 8, 4, 3);

    // Cracks
    g3.fillStyle(PALETTE.ROCK_DARK, 0.6);
    g3.fillRect(4, 4, 1, 6);
    g3.fillRect(5, 9, 3, 1);
    g3.fillRect(11, 7, 1, 5);

    g3.generateTexture('cliff', size, size);
    g3.destroy();

    // Mountain path
    const g4 = this.make.graphics({ x: 0, y: 0 });
    g4.fillStyle(PALETTE.CLIFF_BROWN, 1);
    g4.fillRect(0, 0, size, size);

    g4.fillStyle(0x9d7e6d, 1);
    g4.fillRect(3, 2, 4, 3);
    g4.fillRect(10, 9, 3, 4);

    g4.fillStyle(0x7d5e53, 1);
    g4.fillRect(8, 3, 2, 2);
    g4.fillRect(2, 8, 3, 2);
    g4.fillRect(12, 5, 2, 2);

    g4.generateTexture('mountain_path', size, size);
    g4.destroy();

    // Large boulder
    const g5 = this.make.graphics({ x: 0, y: 0 });
    const boulderSize = TILE_SIZE * 2;

    g5.fillStyle(PALETTE.SHADOW, 0.3);
    g5.fillEllipse(boulderSize / 2, boulderSize - 4, 20, 6);

    // Boulder body
    g5.fillStyle(PALETTE.ROCK_MID, 1);
    g5.fillRect(4, 8, 24, 20);
    g5.fillRect(6, 4, 20, 6);

    // Shading
    g5.fillStyle(PALETTE.ROCK_DARK, 1);
    g5.fillRect(4, 8, 6, 20);
    g5.fillRect(4, 22, 24, 6);

    // Highlights
    g5.fillStyle(PALETTE.ROCK_LIGHT, 1);
    g5.fillRect(10, 6, 10, 4);
    g5.fillRect(14, 10, 8, 6);

    // Cracks
    g5.fillStyle(PALETTE.SLATE_DARK, 0.5);
    g5.fillRect(12, 12, 1, 8);
    g5.fillRect(13, 18, 4, 1);
    g5.fillRect(20, 8, 1, 10);

    g5.generateTexture('boulder', boulderSize, boulderSize);
    g5.destroy();

    // Cave entrance
    const g6 = this.make.graphics({ x: 0, y: 0 });
    const caveWidth = TILE_SIZE * 2;
    const caveHeight = TILE_SIZE * 2;

    // Rock frame
    g6.fillStyle(PALETTE.SLATE_DARK, 1);
    g6.fillRect(0, 0, caveWidth, caveHeight);

    // Cave opening (dark)
    g6.fillStyle(0x1a1a1a, 1);
    g6.fillRect(6, 8, 20, 24);

    // Rock detail
    g6.fillStyle(PALETTE.SLATE_MID, 1);
    g6.fillRect(0, 0, caveWidth, 8);
    g6.fillRect(0, 8, 6, 24);
    g6.fillRect(26, 8, 6, 24);

    g6.fillStyle(PALETTE.SLATE_LIGHT, 1);
    g6.fillRect(2, 2, 8, 4);
    g6.fillRect(22, 2, 8, 4);

    // Depth shading in cave
    g6.fillStyle(0x0a0a0a, 1);
    g6.fillRect(10, 12, 12, 20);

    g6.generateTexture('cave', caveWidth, caveHeight);
    g6.destroy();

    // Mountain peak (background decoration)
    const g7 = this.make.graphics({ x: 0, y: 0 });
    const peakWidth = TILE_SIZE * 3;
    const peakHeight = TILE_SIZE * 2;

    // Mountain shape
    g7.fillStyle(PALETTE.SLATE_MID, 1);
    g7.beginPath();
    g7.moveTo(0, peakHeight);
    g7.lineTo(peakWidth / 2, 0);
    g7.lineTo(peakWidth, peakHeight);
    g7.closePath();
    g7.fill();

    // Snow cap
    g7.fillStyle(PALETTE.SNOW_LIGHT, 1);
    g7.beginPath();
    g7.moveTo(peakWidth / 2 - 8, 10);
    g7.lineTo(peakWidth / 2, 0);
    g7.lineTo(peakWidth / 2 + 8, 10);
    g7.closePath();
    g7.fill();

    // Shading
    g7.fillStyle(PALETTE.SLATE_DARK, 0.5);
    g7.fillRect(0, peakHeight - 8, peakWidth / 2 - 4, 8);

    g7.generateTexture('mountain_peak', peakWidth, peakHeight);
    g7.destroy();
  }

  private createMountainPetSprites(): void {
    const size = TILE_SIZE;

    // Mountain Goat
    const g1 = this.make.graphics({ x: 0, y: 0 });
    g1.fillStyle(PALETTE.SHADOW, 0.3);
    g1.fillEllipse(size / 2, size - 2, 10, 3);

    // Body
    g1.fillStyle(0xd7ccc8, 1);
    g1.fillRect(3, 7, 10, 6);

    // Body shading
    g1.fillStyle(0xbcaaa4, 1);
    g1.fillRect(3, 7, 3, 6);

    // Head
    g1.fillStyle(0xd7ccc8, 1);
    g1.fillRect(2, 2, 8, 6);

    // Beard
    g1.fillStyle(0xbcaaa4, 1);
    g1.fillRect(3, 7, 3, 2);

    // Horns
    g1.fillStyle(0x8d6e63, 1);
    g1.fillRect(2, 0, 2, 4);
    g1.fillRect(8, 0, 2, 4);
    g1.fillStyle(0x6d4c41, 1);
    g1.fillRect(1, 1, 1, 2);
    g1.fillRect(10, 1, 1, 2);

    // Eyes
    g1.fillStyle(0x000000, 1);
    g1.fillRect(4, 4, 2, 2);
    g1.fillStyle(0xffffff, 1);
    g1.fillRect(4, 4, 1, 1);

    // Nose
    g1.fillStyle(0x8d6e63, 1);
    g1.fillRect(3, 6, 2, 1);

    // Legs
    g1.fillStyle(0xbcaaa4, 1);
    g1.fillRect(4, 12, 2, 3);
    g1.fillRect(10, 12, 2, 3);

    // Hooves
    g1.fillStyle(0x5d4037, 1);
    g1.fillRect(4, 14, 2, 1);
    g1.fillRect(10, 14, 2, 1);

    g1.generateTexture('pet_goat', size, size);
    g1.destroy();

    // Eagle
    const g2 = this.make.graphics({ x: 0, y: 0 });
    g2.fillStyle(PALETTE.SHADOW, 0.3);
    g2.fillEllipse(size / 2, size - 2, 10, 3);

    // Body
    g2.fillStyle(0x5d4037, 1);
    g2.fillRect(5, 7, 6, 6);

    // Wings spread
    g2.fillStyle(0x5d4037, 1);
    g2.fillRect(0, 5, 5, 5);
    g2.fillRect(11, 5, 5, 5);

    // Wing tips
    g2.fillStyle(0x3e2723, 1);
    g2.fillRect(0, 5, 2, 3);
    g2.fillRect(14, 5, 2, 3);

    // Head (white like bald eagle)
    g2.fillStyle(0xffffff, 1);
    g2.fillRect(5, 2, 6, 6);

    // Eye
    g2.fillStyle(0x000000, 1);
    g2.fillRect(8, 4, 2, 2);
    g2.fillStyle(0xffd54f, 1);
    g2.fillRect(8, 4, 1, 1);

    // Beak
    g2.fillStyle(0xffd54f, 1);
    g2.fillRect(10, 5, 3, 2);
    g2.fillStyle(0xffb300, 1);
    g2.fillRect(12, 6, 1, 1);

    // Tail feathers
    g2.fillStyle(0x3e2723, 1);
    g2.fillRect(6, 12, 4, 3);

    // Talons
    g2.fillStyle(0xffd54f, 1);
    g2.fillRect(6, 13, 1, 2);
    g2.fillRect(9, 13, 1, 2);

    g2.generateTexture('pet_eagle', size, size);
    g2.destroy();

    // Fox
    const g3 = this.make.graphics({ x: 0, y: 0 });
    g3.fillStyle(PALETTE.SHADOW, 0.3);
    g3.fillEllipse(size / 2, size - 2, 10, 3);

    // Body
    g3.fillStyle(0xff7043, 1);
    g3.fillRect(3, 7, 10, 6);

    // Body shading
    g3.fillStyle(0xf4511e, 1);
    g3.fillRect(3, 7, 3, 6);

    // White belly
    g3.fillStyle(0xffffff, 1);
    g3.fillRect(6, 9, 5, 4);

    // Head
    g3.fillStyle(0xff7043, 1);
    g3.fillRect(2, 2, 10, 7);

    // White muzzle
    g3.fillStyle(0xffffff, 1);
    g3.fillRect(4, 5, 5, 4);

    // Ears (pointy)
    g3.fillStyle(0xff7043, 1);
    g3.fillRect(2, 0, 3, 4);
    g3.fillRect(9, 0, 3, 4);

    // Inner ears
    g3.fillStyle(0xffccbc, 1);
    g3.fillRect(3, 1, 1, 2);
    g3.fillRect(10, 1, 1, 2);

    // Eyes
    g3.fillStyle(0x000000, 1);
    g3.fillRect(4, 4, 2, 2);
    g3.fillRect(8, 4, 2, 2);
    g3.fillStyle(0xffffff, 1);
    g3.fillRect(4, 4, 1, 1);
    g3.fillRect(8, 4, 1, 1);

    // Nose
    g3.fillStyle(0x000000, 1);
    g3.fillRect(6, 6, 2, 1);

    // Legs
    g3.fillStyle(0x4e342e, 1);
    g3.fillRect(4, 12, 2, 3);
    g3.fillRect(10, 12, 2, 3);

    // Tail (bushy)
    g3.fillStyle(0xff7043, 1);
    g3.fillRect(12, 8, 3, 4);
    g3.fillStyle(0xffffff, 1);
    g3.fillRect(14, 10, 1, 2);

    g3.generateTexture('pet_fox', size, size);
    g3.destroy();

    // Bear Cub
    const g4 = this.make.graphics({ x: 0, y: 0 });
    g4.fillStyle(PALETTE.SHADOW, 0.3);
    g4.fillEllipse(size / 2, size - 2, 10, 3);

    // Body
    g4.fillStyle(0x6d4c41, 1);
    g4.fillRect(3, 6, 10, 8);

    // Body shading
    g4.fillStyle(0x5d4037, 1);
    g4.fillRect(3, 6, 3, 8);

    // Belly
    g4.fillStyle(0x8d6e63, 1);
    g4.fillRect(6, 8, 4, 5);

    // Head
    g4.fillStyle(0x6d4c41, 1);
    g4.fillRect(2, 1, 12, 7);

    // Muzzle
    g4.fillStyle(0x8d6e63, 1);
    g4.fillRect(5, 4, 6, 4);

    // Ears (round)
    g4.fillStyle(0x6d4c41, 1);
    g4.fillRect(2, 0, 3, 3);
    g4.fillRect(11, 0, 3, 3);
    g4.fillStyle(0x5d4037, 1);
    g4.fillRect(3, 1, 1, 1);
    g4.fillRect(12, 1, 1, 1);

    // Eyes
    g4.fillStyle(0x000000, 1);
    g4.fillRect(4, 3, 2, 2);
    g4.fillRect(10, 3, 2, 2);
    g4.fillStyle(0xffffff, 1);
    g4.fillRect(4, 3, 1, 1);
    g4.fillRect(10, 3, 1, 1);

    // Nose
    g4.fillStyle(0x000000, 1);
    g4.fillRect(7, 5, 2, 2);

    // Mouth
    g4.fillStyle(0x4e342e, 1);
    g4.fillRect(7, 7, 2, 1);

    // Feet
    g4.fillStyle(0x5d4037, 1);
    g4.fillRect(4, 13, 3, 2);
    g4.fillRect(9, 13, 3, 2);

    g4.generateTexture('pet_bear_cub', size, size);
    g4.destroy();
  }

  private createToolSprites(): void {
    const size = TILE_SIZE;

    // Bug Net
    const g1 = this.make.graphics({ x: 0, y: 0 });
    // Handle
    g1.fillStyle(0x8d6e63, 1);
    g1.fillRect(7, 8, 2, 8);
    // Net frame (circle)
    g1.fillStyle(0x90caf9, 1);
    g1.fillRect(3, 1, 10, 2);
    g1.fillRect(2, 3, 2, 4);
    g1.fillRect(12, 3, 2, 4);
    g1.fillRect(3, 7, 10, 2);
    // Net mesh
    g1.fillStyle(0xbbdefb, 0.7);
    g1.fillRect(4, 3, 8, 4);
    // Mesh lines
    g1.fillStyle(0x90caf9, 0.5);
    g1.fillRect(7, 3, 1, 4);
    g1.fillRect(4, 5, 8, 1);
    g1.generateTexture('tool_net', size, size);
    g1.destroy();

    // Fishing Rod
    const g2 = this.make.graphics({ x: 0, y: 0 });
    // Rod
    g2.fillStyle(0x5d4037, 1);
    g2.fillRect(2, 12, 12, 2);
    g2.fillRect(12, 2, 2, 12);
    // Rod tip
    g2.fillStyle(0x8d6e63, 1);
    g2.fillRect(13, 1, 1, 3);
    // Reel
    g2.fillStyle(0x757575, 1);
    g2.fillRect(4, 10, 3, 3);
    // Line
    g2.fillStyle(0x90caf9, 1);
    g2.fillRect(14, 1, 1, 1);
    g2.fillRect(15, 2, 1, 4);
    // Hook
    g2.fillStyle(0xbdbdbd, 1);
    g2.fillRect(14, 5, 2, 1);
    g2.fillRect(14, 6, 1, 2);
    g2.generateTexture('tool_fishing_rod', size, size);
    g2.destroy();

    // Humane Trap
    const g3 = this.make.graphics({ x: 0, y: 0 });
    // Cage base
    g3.fillStyle(0x795548, 1);
    g3.fillRect(2, 10, 12, 4);
    // Cage bars
    g3.fillStyle(0xa5d6a7, 1);
    g3.fillRect(2, 4, 2, 10);
    g3.fillRect(6, 4, 1, 10);
    g3.fillRect(9, 4, 1, 10);
    g3.fillRect(12, 4, 2, 10);
    // Top
    g3.fillRect(2, 4, 12, 2);
    // Door opening
    g3.fillStyle(0x4e342e, 1);
    g3.fillRect(4, 6, 4, 4);
    // Trigger plate
    g3.fillStyle(0xffcc80, 1);
    g3.fillRect(10, 8, 2, 2);
    g3.generateTexture('tool_trap', size, size);
    g3.destroy();

    // Treats Bag
    const g4 = this.make.graphics({ x: 0, y: 0 });
    // Bag body
    g4.fillStyle(0xffcc80, 1);
    g4.fillRect(4, 5, 8, 9);
    // Bag shading
    g4.fillStyle(0xffb74d, 1);
    g4.fillRect(4, 5, 2, 9);
    // Bag top (gathered)
    g4.fillStyle(0xffcc80, 1);
    g4.fillRect(5, 3, 6, 3);
    // Tie
    g4.fillStyle(0xe57373, 1);
    g4.fillRect(6, 4, 4, 2);
    // Treats peeking out
    g4.fillStyle(0x8d6e63, 1);
    g4.fillRect(6, 2, 2, 2);
    g4.fillRect(9, 3, 1, 1);
    // Heart decoration
    g4.fillStyle(0xe57373, 1);
    g4.fillRect(7, 9, 2, 2);
    g4.fillRect(6, 8, 1, 1);
    g4.fillRect(9, 8, 1, 1);
    g4.generateTexture('tool_treats', size, size);
    g4.destroy();

    // Collectible sparkle/glow effect
    const g5 = this.make.graphics({ x: 0, y: 0 });
    g5.fillStyle(0xffffff, 0.9);
    g5.fillRect(7, 2, 2, 4);
    g5.fillRect(2, 7, 4, 2);
    g5.fillRect(10, 7, 4, 2);
    g5.fillRect(7, 10, 2, 4);
    // Center glow
    g5.fillStyle(0xffeb3b, 0.8);
    g5.fillRect(6, 6, 4, 4);
    g5.fillStyle(0xffffff, 1);
    g5.fillRect(7, 7, 2, 2);
    g5.generateTexture('collectible_sparkle', size, size);
    g5.destroy();
  }

  private createBallSprite(): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    const size = 6;

    // Red ball
    g.fillStyle(0xe74c3c, 1);
    g.fillCircle(size / 2, size / 2, size / 2 - 1);

    // Highlight
    g.fillStyle(0xffffff, 0.6);
    g.fillCircle(size / 2 - 1, size / 2 - 1, 1);

    // Darker edge
    g.lineStyle(1, 0xc0392b, 1);
    g.strokeCircle(size / 2, size / 2, size / 2 - 1);

    g.generateTexture('ball', size, size);
    g.destroy();
  }
}
