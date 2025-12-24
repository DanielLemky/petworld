export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;
export const TILE_SIZE = 16;
export const PLAYER_WIDTH = 16;
export const PLAYER_HEIGHT = 32;
export const PLAYER_SPEED = 150;
export const PLAYER_RUN_MULTIPLIER = 2; // 2x speed when running

// Horse riding speeds
export const HORSE_RIDE_SPEED = 225; // 1.5x walk speed
export const HORSE_GALLOP_MULTIPLIER = 2; // 2x riding speed = 450 (faster than run at 300)

// Seasonal features
export function isChristmasSeason(): boolean {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed: 0 = Jan, 11 = Dec
  const day = now.getDate();

  // Dec 1 - Jan 6
  return (month === 11) || (month === 0 && day <= 6);
}

// Snow accumulation tracking (persists across scene changes)
let snowAccumulationLevel = 0;
const SNOW_TARGET_LEVEL = 0.9;
const SNOW_DURATION = 300000; // 5 minutes

export function getSnowAccumulation(): number {
  return snowAccumulationLevel;
}

export function setSnowAccumulation(level: number): void {
  snowAccumulationLevel = Math.min(Math.max(level, 0), SNOW_TARGET_LEVEL);
}

export function createSnowAccumulation(scene: Phaser.Scene): void {
  const width = scene.cameras.main.width;
  const height = scene.cameras.main.height;
  const currentLevel = getSnowAccumulation();

  const snowOverlay = scene.add.rectangle(
    width / 2,
    height / 2,
    width,
    height,
    0xffffff,
    currentLevel
  );
  snowOverlay.setScrollFactor(0);
  snowOverlay.setDepth(-9);

  if (currentLevel < SNOW_TARGET_LEVEL) {
    const remainingDuration = SNOW_DURATION * (1 - currentLevel / SNOW_TARGET_LEVEL);
    scene.tweens.add({
      targets: snowOverlay,
      fillAlpha: SNOW_TARGET_LEVEL,
      duration: remainingDuration,
      ease: 'Sine.easeOut',
      onUpdate: () => {
        setSnowAccumulation(snowOverlay.fillAlpha);
      }
    });
  }
}

// Stardew Valley inspired color palette
export const PALETTE = {
  // Grass colors
  GRASS_LIGHT: 0x7ec850,
  GRASS_MID: 0x5daa32,
  GRASS_DARK: 0x3d8b24,

  // Dirt/path colors
  DIRT_LIGHT: 0xc4a77d,
  DIRT_MID: 0xa68b5c,
  DIRT_DARK: 0x8b7355,

  // Wood colors
  WOOD_LIGHT: 0x8b6914,
  WOOD_MID: 0x6b4e0a,
  WOOD_DARK: 0x4a3506,

  // Water colors
  WATER_LIGHT: 0x5b9bd5,
  WATER_MID: 0x4a8ac4,
  WATER_DARK: 0x3a79b3,

  // Sky
  SKY_LIGHT: 0x87ceeb,
  SKY_DARK: 0x6bb3d9,

  // Skin tones
  SKIN_LIGHT: 0xffd5b4,
  SKIN_MID: 0xe6b896,
  SKIN_DARK: 0xc49a78,

  // Clothing/accent colors
  BLUE_SHIRT: 0x4a90d9,
  RED_ACCENT: 0xe74c3c,
  BROWN_HAIR: 0x6b4423,

  // UI
  UI_BACKGROUND: 0x2d2d44,
  UI_BORDER: 0x4a4a6a,
  UI_TEXT: 0xffffff,

  // Shadow
  SHADOW: 0x000000,

  // Snow colors
  SNOW_LIGHT: 0xffffff,
  SNOW_MID: 0xe8f4f8,
  SNOW_DARK: 0xc9e4ed,
  ICE_LIGHT: 0xadd8e6,
  ICE_MID: 0x87ceeb,
  ICE_DARK: 0x5f9ea0,

  // Beach/sand colors
  SAND_LIGHT: 0xf4e4bc,
  SAND_MID: 0xe8d4a8,
  SAND_DARK: 0xdcc496,
  OCEAN_LIGHT: 0x40c4ff,
  OCEAN_MID: 0x00b0ff,
  OCEAN_DARK: 0x0091ea,

  // Mountain/rock colors
  ROCK_LIGHT: 0x9e9e9e,
  ROCK_MID: 0x757575,
  ROCK_DARK: 0x616161,
  SLATE_LIGHT: 0x78909c,
  SLATE_MID: 0x607d8b,
  SLATE_DARK: 0x455a64,
  CLIFF_BROWN: 0x8d6e63,
};

export const SCENES = {
  BOOT: 'BootScene',
  ACCOUNT_SELECT: 'AccountSelectScene',
  MENU: 'MenuScene',
  WORLD: 'WorldScene',
  HOME: 'HomeScene',
  SNOW: 'SnowScene',
  BEACH: 'BeachScene',
  MOUNTAIN: 'MountainScene',
  JUNGLE: 'JungleScene',
};

// Pet types with their colors and catching difficulty (1=very easy, 4=hard)
export const PET_TYPES = {
  BUNNY: { primary: 0xffd5b4, secondary: 0xffb6c1, name: 'Bunny', difficulty: 2 },
  KITTY: { primary: 0xffa500, secondary: 0xffd700, name: 'Kitty', difficulty: 2 },
  PUPPY: { primary: 0x8b4513, secondary: 0xdeb887, name: 'Puppy', difficulty: 2 },
  CHICK: { primary: 0xffff00, secondary: 0xffa500, name: 'Chick', difficulty: 1 },
  FROG: { primary: 0x32cd32, secondary: 0x228b22, name: 'Frog', difficulty: 2 },
  // Butterflies (medium - they fly)
  BUTTERFLY_BLUE: { primary: 0x60a5fa, secondary: 0x3b82f6, name: 'Blue Butterfly', difficulty: 3 },
  BUTTERFLY_PINK: { primary: 0xf472b6, secondary: 0xec4899, name: 'Pink Butterfly', difficulty: 3 },
  BUTTERFLY_YELLOW: { primary: 0xfbbf24, secondary: 0xf59e0b, name: 'Yellow Butterfly', difficulty: 3 },
  BUTTERFLY_PURPLE: { primary: 0xa78bfa, secondary: 0x8b5cf6, name: 'Purple Butterfly', difficulty: 3 },
  // Snow pets
  PENGUIN: { primary: 0x1a1a2e, secondary: 0xffffff, name: 'Penguin', difficulty: 2 },
  POLAR_BEAR: { primary: 0xffffff, secondary: 0xe8e8e8, name: 'Polar Bear', difficulty: 3 },
  SNOW_BUNNY: { primary: 0xffffff, secondary: 0xffb6c1, name: 'Snow Bunny', difficulty: 2 },
  SEAL: { primary: 0x708090, secondary: 0xa9a9a9, name: 'Seal', difficulty: 1 },
  // Beach pets
  CRAB: { primary: 0xff6347, secondary: 0xff4500, name: 'Crab', difficulty: 2 },
  SEAGULL: { primary: 0xffffff, secondary: 0x808080, name: 'Seagull', difficulty: 3 },
  TURTLE: { primary: 0x2e8b57, secondary: 0x8fbc8f, name: 'Turtle', difficulty: 2 },
  STARFISH: { primary: 0xffa07a, secondary: 0xff7f50, name: 'Starfish', difficulty: 1 },
  // Mountain pets
   GOAT: { primary: 0xd7ccc8, secondary: 0x8d6e63, name: 'Mountain Goat', difficulty: 3 },
   HORSE: { primary: 0x8b4513, secondary: 0xd2691e, name: 'Horse', difficulty: 5 }, // Hardest to catch
   EAGLE: { primary: 0x5d4037, secondary: 0xffd54f, name: 'Eagle', difficulty: 4 },
  FOX: { primary: 0xff7043, secondary: 0xffffff, name: 'Fox', difficulty: 4 },
  BEAR_CUB: { primary: 0x6d4c41, secondary: 0x4e342e, name: 'Bear Cub', difficulty: 4 },
  // Jungle pets
  PARROT: { primary: 0x00c853, secondary: 0xff5252, name: 'Parrot', difficulty: 3 },
  MONKEY: { primary: 0x8d6e63, secondary: 0xd7ccc8, name: 'Monkey', difficulty: 3 },
  TOUCAN: { primary: 0x1a1a1a, secondary: 0xffab00, name: 'Toucan', difficulty: 2 },
  SLOTH: { primary: 0x795548, secondary: 0xa1887f, name: 'Sloth', difficulty: 4 },
  JAGUAR: { primary: 0xffb300, secondary: 0x1a1a1a, name: 'Jaguar', difficulty: 4 },
};

// Farm pen types for the home area
export const PEN_TYPES = {
  MEADOW: {
    id: 'meadow',
    name: 'Meadow Pen',
    pets: ['BUNNY', 'KITTY', 'PUPPY', 'CHICK'],
    color: 0x5daa32,
    groundTile: 'grass',
  },
  POND: {
    id: 'pond',
    name: 'Pond Pen',
    pets: ['FROG', 'TURTLE', 'STARFISH', 'CRAB'],
    color: 0x4a8ac4,
    groundTile: 'grass',
  },
  SNOW: {
    id: 'snow',
    name: 'Snow Pen',
    pets: ['PENGUIN', 'POLAR_BEAR', 'SNOW_BUNNY', 'SEAL'],
    color: 0xe8f4f8,
    groundTile: 'snow',
  },
  BEACH: {
    id: 'beach',
    name: 'Beach Pen',
    pets: ['SEAGULL'],
    color: 0xe8d4a8,
    groundTile: 'sand',
  },
  MOUNTAIN: {
    id: 'mountain',
    name: 'Mountain Pen',
    pets: ['GOAT', 'EAGLE', 'FOX', 'BEAR_CUB', 'HORSE'],
    color: 0x757575,
    groundTile: 'rock',
  },
  BUTTERFLY_GARDEN: {
    id: 'butterfly',
    name: 'Butterfly Garden',
    pets: ['BUTTERFLY_BLUE', 'BUTTERFLY_PINK', 'BUTTERFLY_YELLOW', 'BUTTERFLY_PURPLE'],
    color: 0xf472b6,
    groundTile: 'grass_flower',
  },
  JUNGLE: {
    id: 'jungle',
    name: 'Jungle Pen',
    pets: ['PARROT', 'MONKEY', 'TOUCAN', 'SLOTH', 'JAGUAR'],
    color: 0x2e5a32,
    groundTile: 'jungle_floor',
  },
};

// Get the correct pen for a pet type
export function getCorrectPenForPet(petType: string): string {
  const upperType = petType.toUpperCase();
  for (const penConfig of Object.values(PEN_TYPES)) {
    if (penConfig.pets.includes(upperType)) {
      return penConfig.id;
    }
  }
  return 'meadow'; // Default fallback
}

// Get pen config by id
export function getPenConfigById(penId: string): typeof PEN_TYPES[keyof typeof PEN_TYPES] | null {
  for (const penConfig of Object.values(PEN_TYPES)) {
    if (penConfig.id === penId) {
      return penConfig;
    }
  }
  return null;
}
