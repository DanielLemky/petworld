# AGENTS.md

## Build Commands
- `npm run dev` - Start Vite dev server
- `npm run build` - TypeScript check + production build (runs `tsc && vite build`)
- No test framework configured; no linter configured

## Code Style
- **TypeScript**: Strict mode enabled (`noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`)
- **Imports**: Phaser first, then local imports using relative paths; prefer named exports
- **Naming**: PascalCase for classes/interfaces, camelCase for functions/variables, SCREAMING_SNAKE_CASE for constants
- **Files**: Scene classes in `src/scenes/`, systems in `src/systems/`, utilities in `src/utils/`
- **Classes**: Scenes extend `Phaser.Scene`; use `private` fields with `!` assertion for Phaser-initialized properties
- **Singletons**: Manager classes exported as singleton instances (e.g., `export const PetManager = new PetManagerClass()`)
- **Types**: Use `interface` for data structures; use `keyof typeof` for object-based enums
- **Error handling**: Use try/catch with `console.error`; return boolean for success/failure

## Project Structure
- Assets in `public/assets/` (sprites, audio) - copied to build output
- Game config in `src/config.ts`, constants in `src/utils/constants.ts`
- Data persisted to localStorage with `petworld_` prefix
