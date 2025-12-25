import { AccountManager } from './AccountManager';

const BASE_INVENTORY_STORAGE_KEY = 'petworld_inventory';

// Tool types
export type ToolType = 'NET' | 'FISHING_ROD' | 'TRAP' | 'TREATS';

// Define which tool is needed for each pet type
export const PET_TOOL_REQUIREMENTS: Record<string, ToolType | null> = {
  // World pets
  BUNNY: 'TRAP',
  KITTY: 'TREATS',
  PUPPY: 'TREATS',
  CHICK: null,  // Easy to catch
  FROG: null,   // Easy to catch

  // Butterflies need net
  BUTTERFLY_BLUE: 'NET',
  BUTTERFLY_PINK: 'NET',
  BUTTERFLY_YELLOW: 'NET',
  BUTTERFLY_PURPLE: 'NET',

  // Snow pets
  PENGUIN: null,        // Friendly
  POLAR_BEAR: 'TREATS',
  SNOW_BUNNY: 'TRAP',
  SEAL: 'FISHING_ROD',
  REINDEER: 'TREATS',

  // Beach pets
  CRAB: 'FISHING_ROD',
  SEAGULL: 'NET',
  TURTLE: 'FISHING_ROD',
  STARFISH: 'FISHING_ROD',

  // Mountain pets
  GOAT: null,           // Friendly
  EAGLE: 'NET',
  FOX: 'TRAP',
  BEAR_CUB: 'TREATS',
};

// Tool display info
export const TOOL_INFO: Record<ToolType, { name: string; description: string; color: number }> = {
  NET: {
    name: 'Bug Net',
    description: 'Catches flying creatures',
    color: 0x90caf9,
  },
  FISHING_ROD: {
    name: 'Fishing Rod',
    description: 'Catches water creatures',
    color: 0x8d6e63,
  },
  TRAP: {
    name: 'Humane Trap',
    description: 'Catches quick, shy animals',
    color: 0xa5d6a7,
  },
  TREATS: {
    name: 'Treats Bag',
    description: 'Lures friendly animals',
    color: 0xffcc80,
  },
};

interface InventorySaveData {
  tools: ToolType[];
  savedAt: number;
}

class InventoryManagerClass {
  private tools: Set<ToolType> = new Set();

  constructor() {
    // Don't auto-load - wait for account selection
  }

  // Get the storage key for the current account
  private getStorageKey(): string {
    if (!AccountManager.hasActiveAccount()) {
      return BASE_INVENTORY_STORAGE_KEY; // Fallback (shouldn't happen in normal flow)
    }
    return AccountManager.getStorageKey(BASE_INVENTORY_STORAGE_KEY);
  }

  // Reload data for current account (call after account selection)
  reload(): void {
    this.tools.clear();
    this.load();
  }

  // Add a tool to inventory
  addTool(tool: ToolType): boolean {
    if (this.tools.has(tool)) {
      return false; // Already have it
    }
    this.tools.add(tool);
    this.save();
    return true;
  }

  // Check if player has a specific tool
  hasTool(tool: ToolType): boolean {
    return this.tools.has(tool);
  }

  // Get all owned tools
  getTools(): ToolType[] {
    return Array.from(this.tools);
  }

  // Get the tool required for a pet (or null if none needed)
  getRequiredTool(petType: string): ToolType | null {
    const upperType = petType.toUpperCase();
    return PET_TOOL_REQUIREMENTS[upperType] ?? null;
  }

  // Check if player can catch a specific pet
  canCatchPet(petType: string): { canCatch: boolean; requiredTool: ToolType | null; hasTool: boolean } {
    const requiredTool = this.getRequiredTool(petType);

    if (requiredTool === null) {
      return { canCatch: true, requiredTool: null, hasTool: true };
    }

    const hasTool = this.hasTool(requiredTool);
    return { canCatch: hasTool, requiredTool, hasTool };
  }

  // Get count of tools owned
  getToolCount(): number {
    return this.tools.size;
  }

  // Save to localStorage
  save(): boolean {
    try {
      const saveData: InventorySaveData = {
        tools: Array.from(this.tools),
        savedAt: Date.now(),
      };
      localStorage.setItem(this.getStorageKey(), JSON.stringify(saveData));
      return true;
    } catch (error) {
      console.error('Failed to save inventory:', error);
      return false;
    }
  }

  // Load from localStorage
  load(): boolean {
    try {
      const saved = localStorage.getItem(this.getStorageKey());
      if (!saved) {
        return false;
      }

      const saveData: InventorySaveData = JSON.parse(saved);
      this.tools = new Set(saveData.tools || []);
      console.log(`Inventory loaded! ${this.tools.size} tools.`);
      return true;
    } catch (error) {
      console.error('Failed to load inventory:', error);
      return false;
    }
  }

  // Clear inventory (for testing/reset)
  clearInventory(): void {
    localStorage.removeItem(this.getStorageKey());
    this.tools.clear();
  }
}

// Singleton instance
export const InventoryManager = new InventoryManagerClass();
