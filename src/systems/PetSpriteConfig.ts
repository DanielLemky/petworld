import Phaser from 'phaser';

export interface PetSpriteInfo {
  left: string;
  right: string;
  scale: number;
  offset: { x: number; y: number };
}

// Central configuration for all pet sprites
// Maps pet type (lowercase) to sprite configuration
export const PET_SPRITE_CONFIG: Record<string, PetSpriteInfo> = {
  // World pets
  bunny: { left: 'bunny_left', right: 'bunny_right', scale: 0.021, offset: { x: 160, y: 470 } },
  kitty: { left: 'cat_left', right: 'cat_right', scale: 0.018, offset: { x: 180, y: 500 } },
  puppy: { left: 'puppy_left', right: 'puppy_right', scale: 0.018, offset: { x: 200, y: 500 } },
  chick: { left: 'chick_left', right: 'chick_right', scale: 0.012, offset: { x: 170, y: 450 } },
  frog: { left: 'frog_left', right: 'frog_right', scale: 0.018, offset: { x: 170, y: 400 } },
  
  // Butterflies (all variants use same sprite)
  butterfly_blue: { left: 'butterfly_left', right: 'butterfly_right', scale: 0.018, offset: { x: 170, y: 280 } },
  butterfly_pink: { left: 'butterfly_left', right: 'butterfly_right', scale: 0.018, offset: { x: 170, y: 280 } },
  butterfly_yellow: { left: 'butterfly_left', right: 'butterfly_right', scale: 0.018, offset: { x: 170, y: 280 } },
  butterfly_purple: { left: 'butterfly_left', right: 'butterfly_right', scale: 0.018, offset: { x: 170, y: 280 } },
  
  // Snow pets
  penguin: { left: 'penguin_left', right: 'penguin_right', scale: 0.018, offset: { x: 160, y: 480 } },
  polar_bear: { left: 'polar_bear_left', right: 'polar_bear_right', scale: 0.036, offset: { x: 170, y: 330 } },
  snow_bunny: { left: 'snow_bunny_left', right: 'snow_bunny_right', scale: 0.042, offset: { x: 80, y: 230 } },
  seal: { left: 'seal_left', right: 'seal_right', scale: 0.03, offset: { x: 170, y: 260 } },
  reindeer: { left: 'reindeer_left', right: 'reindeer_right', scale: 0.04, offset: { x: 180, y: 350 } },

  // Beach pets
  crab: { left: 'crab_left', right: 'crab_right', scale: 0.018, offset: { x: 200, y: 350 } },
  seagull: { left: 'seagull_left', right: 'seagull_right', scale: 0.018, offset: { x: 170, y: 420 } },
  turtle: { left: 'turtle_left', right: 'turtle_right', scale: 0.027, offset: { x: 200, y: 280 } },
  starfish: { left: 'starfish_left', right: 'starfish_right', scale: 0.018, offset: { x: 170, y: 350 } },
  
   // Mountain pets
   goat: { left: 'mountain_goat_left', right: 'mountain_goat_right', scale: 0.027, offset: { x: 180, y: 470 } },
   horse: { left: 'horse_left', right: 'horse_right', scale: 0.045, offset: { x: 180, y: 400 } },
   eagle: { left: 'eagle_left', right: 'eagle_right', scale: 0.018, offset: { x: 160, y: 490 } },
  fox: { left: 'fox_left', right: 'fox_right', scale: 0.024, offset: { x: 200, y: 420 } },
  bear_cub: { left: 'bear_left', right: 'bear_right', scale: 0.036, offset: { x: 170, y: 330 } },
  
  // Jungle pets
  parrot: { left: 'parrot_left', right: 'parrot_right', scale: 0.018, offset: { x: 170, y: 400 } },
  monkey: { left: 'monkey_left', right: 'monkey_right', scale: 0.032, offset: { x: 170, y: 350 } },
  toucan: { left: 'toucan_left', right: 'toucan_right', scale: 0.021, offset: { x: 170, y: 380 } },
  sloth: { left: 'sloth_left', right: 'sloth_right', scale: 0.024, offset: { x: 170, y: 320 } },
  jaguar: { left: 'jaguar_left', right: 'jaguar_right', scale: 0.04, offset: { x: 180, y: 350 } },
};

// Fallback blob sprite for any pets without custom sprites
export const BLOB_SPRITE: PetSpriteInfo = {
  left: 'blob_left',
  right: 'blob_right',
  scale: 0.027,
  offset: { x: 150, y: 240 },
};

/**
 * Get sprite configuration for a pet type
 * Returns blob config if no custom sprite exists
 */
export function getPetSpriteConfig(petType: string): PetSpriteInfo {
  const lowerType = petType.toLowerCase();
  return PET_SPRITE_CONFIG[lowerType] || BLOB_SPRITE;
}

/**
 * Check if a pet type has a custom sprite (not using blob)
 */
export function hasCustomSprite(petType: string): boolean {
  const lowerType = petType.toLowerCase();
  return lowerType in PET_SPRITE_CONFIG;
}

/**
 * Get the sprite texture key for a pet
 */
export function getSpriteKey(petType: string, facingRight: boolean = true): string {
  const config = getPetSpriteConfig(petType);
  return facingRight ? config.right : config.left;
}

/**
 * Apply sprite configuration to a pet sprite (texture, scale, size, offset)
 */
export function applyPetSpriteConfig(
  pet: Phaser.Physics.Arcade.Sprite,
  petType: string
): void {
  const config = getPetSpriteConfig(petType);
  
  pet.setTexture(config.right);
  pet.setScale(config.scale);
  pet.setSize(400, 200);
  pet.setOffset(config.offset.x, config.offset.y);
  pet.setData('facingRight', true);
}

/**
 * Update pet sprite direction based on movement
 */
export function updatePetSpriteDirection(
  pet: Phaser.Physics.Arcade.Sprite,
  petType: string,
  directionX: number
): void {
  if (directionX === 0) return;
  
  const config = getPetSpriteConfig(petType);
  const facingRight = pet.getData('facingRight') as boolean;
  
  if (directionX > 0 && !facingRight) {
    pet.setTexture(config.right);
    pet.setData('facingRight', true);
  } else if (directionX < 0 && facingRight) {
    pet.setTexture(config.left);
    pet.setData('facingRight', false);
  }
}

/**
 * Get all unique sprite keys that need to be loaded
 * Used by BootScene for auto-loading sprites
 */
export function getAllSpriteKeys(): string[] {
  const keys = new Set<string>();
  
  // Add blob placeholder
  keys.add(BLOB_SPRITE.left);
  keys.add(BLOB_SPRITE.right);
  
  // Add all pet sprites
  Object.values(PET_SPRITE_CONFIG).forEach(config => {
    keys.add(config.left);
    keys.add(config.right);
  });
  
  return Array.from(keys);
}
