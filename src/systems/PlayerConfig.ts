export const PLAYER_CONFIG = {
  // Base scaling values
  NORMAL_SCALE: 0.0225,              // Current player scale (1.5x from original 0.015)
  WALK_SCALE_Y_MIN: 0.02025,          // 10% reduction for squash effect
  WALK_SCALE_Y_MAX: 0.0225,           // Normal scale
  WALK_SCALE_X_MIN: 0.0225,           // Normal scale  
  WALK_SCALE_X_MAX: 0.02475,          // 10% increase for stretch effect
  
  // Animation timing
  WALK_ANIMATION_DURATION: 100,         // ms for one squash/stretch cycle
  WALK_ANIMATION_EASE: 'Sine.easeInOut' as const,
  
  // Animation frame constants (for future use)
  IDLE_FRAME: 0,
  WALK_START_FRAME: 1,
  WALK_END_FRAME: 3,
  
  // Animation names
  ANIM_IDLE: 'idle' as const,
  ANIM_WALK: 'walk' as const,
};