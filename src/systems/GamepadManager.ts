import Phaser from 'phaser';

// Standard gamepad button indices (matches Xbox/PS4/Switch Pro controllers)
export const GAMEPAD_BUTTONS = {
  A: 0,        // A (Xbox) / X (PS4) / B (Switch) - Primary action
  B: 1,        // B (Xbox) / O (PS4) / A (Switch) - Secondary/Cancel
  X: 2,        // X (Xbox) / Square (PS4) / Y (Switch)
  Y: 3,        // Y (Xbox) / Triangle (PS4) / X (Switch)
  LB: 4,       // Left Bumper / L1
  RB: 5,       // Right Bumper / R1
  LT: 6,       // Left Trigger / L2
  RT: 7,       // Right Trigger / R2
  SELECT: 8,   // Back / Share / Minus
  START: 9,    // Start / Options / Plus
  L3: 10,      // Left Stick Click
  R3: 11,      // Right Stick Click
  DPAD_UP: 12,
  DPAD_DOWN: 13,
  DPAD_LEFT: 14,
  DPAD_RIGHT: 15,
};

// Stick axis indices
const AXIS = {
  LEFT_X: 0,
  LEFT_Y: 1,
  RIGHT_X: 2,
  RIGHT_Y: 3,
};

const DEADZONE = 0.2;

interface StickState {
  x: number;
  y: number;
}

/**
 * GamepadManager - Singleton class for handling gamepad input across all scenes.
 * 
 * Usage:
 * - Call GamepadManager.init(scene) once in your first scene
 * - Call GamepadManager.update() in each scene's update() method
 * - Use GamepadManager.getLeftStick(), getRightStick() for analog input
 * - Use GamepadManager.isButtonDown(index), isButtonJustPressed(index) for buttons
 */
class GamepadManagerClass {
  private scene: Phaser.Scene | null = null;
  private previousButtonStates: boolean[] = [];
  private currentButtonStates: boolean[] = [];
  private initialized: boolean = false;

  /**
   * Initialize the GamepadManager with a scene reference.
   * Should be called once when the game starts.
   */
  init(scene: Phaser.Scene): void {
    this.scene = scene;
    this.initialized = true;
    
    // Initialize button state arrays
    for (let i = 0; i < 16; i++) {
      this.previousButtonStates[i] = false;
      this.currentButtonStates[i] = false;
    }

    // Listen for gamepad connection events
    if (scene.input.gamepad) {
      scene.input.gamepad.once('connected', (pad: Phaser.Input.Gamepad.Gamepad) => {
        console.log('Gamepad connected:', pad.id);
      });
    }
  }

  /**
   * Update the scene reference (call this when switching scenes).
   */
  setScene(scene: Phaser.Scene): void {
    this.scene = scene;
  }

  /**
   * Update button states for "just pressed" detection.
   * Call this once per frame in the scene's update() method.
   */
  update(): void {
    const pad = this.getPad();
    if (!pad) return;

    // Store previous states and update current states
    for (let i = 0; i < 16; i++) {
      this.previousButtonStates[i] = this.currentButtonStates[i];
      this.currentButtonStates[i] = pad.buttons[i]?.pressed ?? false;
    }
  }

  /**
   * Get the first connected gamepad, or null if none connected.
   */
  getPad(): Phaser.Input.Gamepad.Gamepad | null {
    if (!this.scene || !this.scene.input.gamepad) return null;
    
    // Try to get pad1 first (most common)
    const pad = this.scene.input.gamepad.pad1;
    if (pad) return pad;

    // Fall back to checking all gamepads
    const gamepads = this.scene.input.gamepad.gamepads;
    if (gamepads && gamepads.length > 0) {
      return gamepads[0];
    }

    return null;
  }

  /**
   * Check if a gamepad is currently connected.
   */
  isConnected(): boolean {
    return this.getPad() !== null;
  }

  /**
   * Get the left analog stick state with deadzone applied.
   * Returns { x: -1 to 1, y: -1 to 1 }
   */
  getLeftStick(): StickState {
    const pad = this.getPad();
    if (!pad) return { x: 0, y: 0 };

    let x = pad.axes[AXIS.LEFT_X]?.getValue() ?? 0;
    let y = pad.axes[AXIS.LEFT_Y]?.getValue() ?? 0;

    // Apply deadzone
    if (Math.abs(x) < DEADZONE) x = 0;
    if (Math.abs(y) < DEADZONE) y = 0;

    return { x, y };
  }

  /**
   * Get the right analog stick state with deadzone applied.
   * Returns { x: -1 to 1, y: -1 to 1 }
   */
  getRightStick(): StickState {
    const pad = this.getPad();
    if (!pad) return { x: 0, y: 0 };

    let x = pad.axes[AXIS.RIGHT_X]?.getValue() ?? 0;
    let y = pad.axes[AXIS.RIGHT_Y]?.getValue() ?? 0;

    // Apply deadzone
    if (Math.abs(x) < DEADZONE) x = 0;
    if (Math.abs(y) < DEADZONE) y = 0;

    return { x, y };
  }

  /**
   * Check if a button is currently held down.
   */
  isButtonDown(buttonIndex: number): boolean {
    const pad = this.getPad();
    if (!pad) return false;
    return pad.buttons[buttonIndex]?.pressed ?? false;
  }

  /**
   * Check if a button was just pressed this frame (not held from previous frame).
   */
  isButtonJustPressed(buttonIndex: number): boolean {
    return this.currentButtonStates[buttonIndex] && !this.previousButtonStates[buttonIndex];
  }

  /**
   * Check if a button was just released this frame.
   */
  isButtonJustReleased(buttonIndex: number): boolean {
    return !this.currentButtonStates[buttonIndex] && this.previousButtonStates[buttonIndex];
  }

  /**
   * Get D-pad state as a direction vector.
   */
  getDPad(): StickState {
    const pad = this.getPad();
    if (!pad) return { x: 0, y: 0 };

    let x = 0;
    let y = 0;

    if (pad.buttons[GAMEPAD_BUTTONS.DPAD_LEFT]?.pressed) x = -1;
    if (pad.buttons[GAMEPAD_BUTTONS.DPAD_RIGHT]?.pressed) x = 1;
    if (pad.buttons[GAMEPAD_BUTTONS.DPAD_UP]?.pressed) y = -1;
    if (pad.buttons[GAMEPAD_BUTTONS.DPAD_DOWN]?.pressed) y = 1;

    return { x, y };
  }

  /**
   * Check if the gamepad manager has been initialized.
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

// Export singleton instance
export const GamepadManager = new GamepadManagerClass();
