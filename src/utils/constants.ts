export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;
export const TILE_SIZE = 16;
export const PLAYER_WIDTH = 16;
export const PLAYER_HEIGHT = 32;
export const PLAYER_SPEED = 100;

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
  MENU: 'MenuScene',
  WORLD: 'WorldScene',
  HOME: 'HomeScene',
  SNOW: 'SnowScene',
  BEACH: 'BeachScene',
  MOUNTAIN: 'MountainScene',
};

// Pet types with their colors
export const PET_TYPES = {
  BUNNY: { primary: 0xffd5b4, secondary: 0xffb6c1, name: 'Bunny' },
  KITTY: { primary: 0xffa500, secondary: 0xffd700, name: 'Kitty' },
  PUPPY: { primary: 0x8b4513, secondary: 0xdeb887, name: 'Puppy' },
  CHICK: { primary: 0xffff00, secondary: 0xffa500, name: 'Chick' },
  FROG: { primary: 0x32cd32, secondary: 0x228b22, name: 'Frog' },
  // Butterflies
  BUTTERFLY_BLUE: { primary: 0x60a5fa, secondary: 0x3b82f6, name: 'Blue Butterfly' },
  BUTTERFLY_PINK: { primary: 0xf472b6, secondary: 0xec4899, name: 'Pink Butterfly' },
  BUTTERFLY_YELLOW: { primary: 0xfbbf24, secondary: 0xf59e0b, name: 'Yellow Butterfly' },
  BUTTERFLY_PURPLE: { primary: 0xa78bfa, secondary: 0x8b5cf6, name: 'Purple Butterfly' },
  // Snow pets
  PENGUIN: { primary: 0x1a1a2e, secondary: 0xffffff, name: 'Penguin' },
  POLAR_BEAR: { primary: 0xffffff, secondary: 0xe8e8e8, name: 'Polar Bear' },
  SNOW_BUNNY: { primary: 0xffffff, secondary: 0xffb6c1, name: 'Snow Bunny' },
  SEAL: { primary: 0x708090, secondary: 0xa9a9a9, name: 'Seal' },
  // Beach pets
  CRAB: { primary: 0xff6347, secondary: 0xff4500, name: 'Crab' },
  SEAGULL: { primary: 0xffffff, secondary: 0x808080, name: 'Seagull' },
  TURTLE: { primary: 0x2e8b57, secondary: 0x8fbc8f, name: 'Turtle' },
  STARFISH: { primary: 0xffa07a, secondary: 0xff7f50, name: 'Starfish' },
  // Mountain pets
  GOAT: { primary: 0xd7ccc8, secondary: 0x8d6e63, name: 'Mountain Goat' },
  EAGLE: { primary: 0x5d4037, secondary: 0xffd54f, name: 'Eagle' },
  FOX: { primary: 0xff7043, secondary: 0xffffff, name: 'Fox' },
  BEAR_CUB: { primary: 0x6d4c41, secondary: 0x4e342e, name: 'Bear Cub' },
};
