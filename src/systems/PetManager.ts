import { PET_TYPES, getCorrectPenForPet } from '../utils/constants';
import { AccountManager } from './AccountManager';

const BASE_STORAGE_KEY = 'petworld_save';

// Decay rates (per minute in real time for faster gameplay)
const HUNGER_DECAY_PER_MINUTE = 2;
const HAPPINESS_DECAY_PER_MINUTE = 1.5;

export interface CaughtPet {
  id: string;
  type: keyof typeof PET_TYPES;
  name: string;
  caughtAt: number;
  happiness: number;
  hunger: number;
  lastUpdated: number;
  penId: string | null;                          // Which pen the pet is assigned to
  penPosition: { x: number; y: number } | null;  // Position within the pen (tile coords)
}

interface SaveData {
  pets: CaughtPet[];
  nextId: number;
  savedAt: number;
  companionId: string | null;
}

class PetManagerClass {
  private caughtPets: CaughtPet[] = [];
  private nextId: number = 1;
  private companionId: string | null = null;

  constructor() {
    // Don't auto-load - wait for account selection
  }

  // Get the storage key for the current account
  private getStorageKey(): string {
    if (!AccountManager.hasActiveAccount()) {
      return BASE_STORAGE_KEY; // Fallback (shouldn't happen in normal flow)
    }
    return AccountManager.getStorageKey(BASE_STORAGE_KEY);
  }

  // Reload data for current account (call after account selection)
  reload(): void {
    this.caughtPets = [];
    this.nextId = 1;
    this.companionId = null;
    this.load();
  }

  catchPet(type: string): CaughtPet {
    const petType = type.toUpperCase() as keyof typeof PET_TYPES;
    const petConfig = PET_TYPES[petType];

    const newPet: CaughtPet = {
      id: `pet_${this.nextId++}`,
      type: petType,
      name: petConfig?.name || 'Pet',
      caughtAt: Date.now(),
      happiness: 30, // Scared from being caught!
      hunger: 40,    // A bit hungry
      lastUpdated: Date.now(),
      penId: null,        // Not assigned to a pen yet
      penPosition: null,  // No position in pen yet
    };

    this.caughtPets.push(newPet);

    // Auto-save after catching
    this.save();

    return newPet;
  }

  // Update all pets' stats based on time elapsed
  updatePetStats(): void {
    const now = Date.now();

    this.caughtPets.forEach(pet => {
      const minutesPassed = (now - (pet.lastUpdated || pet.caughtAt)) / (1000 * 60);

      if (minutesPassed > 0) {
        // Decay hunger and happiness
        pet.hunger = Math.max(0, pet.hunger - minutesPassed * HUNGER_DECAY_PER_MINUTE);
        pet.happiness = Math.max(0, pet.happiness - minutesPassed * HAPPINESS_DECAY_PER_MINUTE);

        // Unhappy pets lose happiness faster when hungry
        if (pet.hunger < 30) {
          pet.happiness = Math.max(0, pet.happiness - minutesPassed * 1);
        }

        pet.lastUpdated = now;
      }
    });

    this.save();
  }

  // Feed a pet
  feedPet(petId: string): boolean {
    const pet = this.caughtPets.find(p => p.id === petId);
    if (!pet) return false;

    pet.hunger = Math.min(100, pet.hunger + 30);
    // Feeding also makes them a little happy
    pet.happiness = Math.min(100, pet.happiness + 5);
    pet.lastUpdated = Date.now();

    this.save();
    return true;
  }

  // Play with / pet a pet
  playWithPet(petId: string): boolean {
    const pet = this.caughtPets.find(p => p.id === petId);
    if (!pet) return false;

    pet.happiness = Math.min(100, pet.happiness + 20);
    // Playing makes them a tiny bit hungry
    pet.hunger = Math.max(0, pet.hunger - 2);
    pet.lastUpdated = Date.now();

    this.save();
    return true;
  }

  // Get pet mood based on stats
  getPetMood(pet: CaughtPet): 'happy' | 'content' | 'hungry' | 'sad' {
    if (pet.hunger < 20) return 'hungry';
    if (pet.happiness < 30) return 'sad';
    if (pet.happiness > 70 && pet.hunger > 50) return 'happy';
    return 'content';
  }

  getCaughtPets(): CaughtPet[] {
    return [...this.caughtPets];
  }

  getPetCount(): number {
    return this.caughtPets.length;
  }

  getPetById(id: string): CaughtPet | undefined {
    return this.caughtPets.find(pet => pet.id === id);
  }

  hasCaughtAny(): boolean {
    return this.caughtPets.length > 0;
  }

  // Companion management
  setCompanion(petId: string | null): boolean {
    if (petId === null) {
      this.companionId = null;
      this.save();
      return true;
    }

    const pet = this.caughtPets.find(p => p.id === petId);
    if (!pet) return false;

    this.companionId = petId;
    this.save();
    return true;
  }

  getCompanion(): CaughtPet | null {
    if (!this.companionId) return null;
    return this.caughtPets.find(p => p.id === this.companionId) || null;
  }

  getCompanionId(): string | null {
    return this.companionId;
  }

  hasCompanion(): boolean {
    return this.companionId !== null && this.getCompanion() !== null;
  }

  clearCompanion(): void {
    this.companionId = null;
    this.save();
  }

  // Pen management

  // Assign a pet to a pen with a specific position
  assignPetToPen(petId: string, penId: string, position: { x: number; y: number }): boolean {
    const pet = this.caughtPets.find(p => p.id === petId);
    if (!pet) return false;

    pet.penId = penId;
    pet.penPosition = position;
    this.save();
    return true;
  }

  // Remove a pet from its pen (when picking up)
  removePetFromPen(petId: string): void {
    const pet = this.caughtPets.find(p => p.id === petId);
    if (pet) {
      pet.penId = null;
      pet.penPosition = null;
      this.save();
    }
  }

  // Get all pets assigned to a specific pen
  getPetsInPen(penId: string): CaughtPet[] {
    return this.caughtPets.filter(p => p.penId === penId);
  }

  // Get all pets not assigned to any pen (roaming)
  getUnassignedPets(): CaughtPet[] {
    return this.caughtPets.filter(p => p.penId === null);
  }

  // Check if a pet is in its correct pen
  isPetInCorrectPen(petId: string): boolean {
    const pet = this.caughtPets.find(p => p.id === petId);
    if (!pet || !pet.penId) return false;

    const correctPen = getCorrectPenForPet(pet.type);
    return pet.penId === correctPen;
  }

  // Get the correct pen id for a pet
  getCorrectPenForPet(petId: string): string | null {
    const pet = this.caughtPets.find(p => p.id === petId);
    if (!pet) return null;

    return getCorrectPenForPet(pet.type);
  }

  // Update pet's position within its pen
  updatePetPenPosition(petId: string, position: { x: number; y: number }): void {
    const pet = this.caughtPets.find(p => p.id === petId);
    if (pet && pet.penId) {
      pet.penPosition = position;
      // Don't save on every position update - too frequent
    }
  }

  // Save to localStorage
  save(): boolean {
    try {
      const saveData: SaveData = {
        pets: this.caughtPets,
        nextId: this.nextId,
        savedAt: Date.now(),
        companionId: this.companionId,
      };
      localStorage.setItem(this.getStorageKey(), JSON.stringify(saveData));
      console.log(`Game saved! ${this.caughtPets.length} pets.`);
      return true;
    } catch (error) {
      console.error('Failed to save game:', error);
      return false;
    }
  }

  // Load from localStorage
  load(): boolean {
    try {
      const saved = localStorage.getItem(this.getStorageKey());
      if (!saved) {
        console.log('No save data found, starting fresh.');
        return false;
      }

      const saveData: SaveData = JSON.parse(saved);
      this.caughtPets = saveData.pets || [];
      this.nextId = saveData.nextId || this.caughtPets.length + 1;
      this.companionId = saveData.companionId || null;

      console.log(`Game loaded! ${this.caughtPets.length} pets restored.`);
      return true;
    } catch (error) {
      console.error('Failed to load game:', error);
      return false;
    }
  }

  // Clear save data (for testing or reset)
  clearSave(): void {
    localStorage.removeItem(this.getStorageKey());
    this.caughtPets = [];
    this.nextId = 1;
    this.companionId = null;
    console.log('Save data cleared.');
  }

  // Check if save exists
  hasSaveData(): boolean {
    return localStorage.getItem(this.getStorageKey()) !== null;
  }

  // For manual export/import
  exportData(): CaughtPet[] {
    return this.caughtPets;
  }

  importData(pets: CaughtPet[]): void {
    this.caughtPets = pets;
    this.nextId = pets.length + 1;
    this.save();
  }
}

// Singleton instance
export const PetManager = new PetManagerClass();
