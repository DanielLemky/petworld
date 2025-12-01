# Pet World

A kids game combining Stardew Valley and Pokemon mechanics, built with Phaser 3 and TypeScript.

## Project Overview

- **Framework**: Phaser 3 with TypeScript
- **Build Tool**: Vite
- **Target Audience**: Kids

## Game Features

### Areas (Scenes)
- **WorldScene**: Main grassy area with pond, trees, butterflies
- **SnowScene**: Winter area with ice physics (sliding), snowfall particles
- **BeachScene**: Coastal area with ocean, palm trees, sand
- **MountainScene**: Rocky terrain with wind particles, cave, boulders
- **HomeScene**: Player's home to view and feed collected pets

### Pets by Area
- **World**: Bunny, Kitty, Puppy, Chick, Frog, Butterflies (4 colors)
- **Snow**: Penguin, Polar Bear, Snow Bunny, Seal
- **Beach**: Crab, Seagull, Turtle, Starfish
- **Mountain**: Goat, Eagle, Fox, Bear Cub

### Tools/Inventory System
Tools must be collected before catching certain pets:
- **Bug Net** (World) - catches butterflies, seagull, eagle
- **Fishing Rod** (Beach) - catches seal, turtle, starfish, crab
- **Humane Trap** (Snow) - catches bunny, fox, snow_bunny
- **Treats Bag** (Mountain) - catches puppy, kitty, bear_cub, polar_bear
- Some pets (chick, frog, penguin, goat) don't need tools

### Audio
- Each area has its own background music (`public/assets/audio/song-1.wav` to `song-4.wav`)
- Home scene uses programmatic melody
- SFX: success, failure, splash, pet/feed, footstep, click

### Graphics
- Player sprites: AI-generated images in `public/assets/sprites/`
- Environment/pets: Programmatically generated in `BootScene.ts`
- Player has walk animation (squash/stretch tween)

## Key Files

- `src/scenes/BootScene.ts` - Asset loading, sprite generation
- `src/scenes/WorldScene.ts` - Main gameplay area
- `src/systems/PetManager.ts` - Pet collection, stats, persistence
- `src/systems/InventoryManager.ts` - Tools/inventory system
- `src/systems/SoundManager.ts` - Audio playback
- `src/ui/CatchingUI.ts` - Catching minigame (timing-based)
- `src/utils/constants.ts` - Colors, pet types, scene keys

## Data Persistence

Uses localStorage:
- `petworld_pets` - Collected pets and their stats
- `petworld_inventory` - Collected tools

## Running the Game

```bash
npm install
npm run dev
```

## Controls

- **WASD/Arrows**: Move
- **Space**: Interact/catch pet
- **E**: Feed pet (in Home)
- **H**: Go home (from World)
- **ESC**: Cancel catching
