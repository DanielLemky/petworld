import Phaser from 'phaser';
import { SCENES, PALETTE } from '../utils/constants';
import { AccountManager } from '../systems/AccountManager';
import { GamepadManager, GAMEPAD_BUTTONS } from '../systems/GamepadManager';

export class MenuScene extends Phaser.Scene {
  private menuButtons: Phaser.GameObjects.Container[] = [];
  private selectedIndex: number = 0;
  private previousScene: string = SCENES.WORLD;

  constructor() {
    super({ key: SCENES.MENU });
  }

  init(data: { previousScene?: string }): void {
    this.previousScene = data.previousScene || SCENES.WORLD;
  }

  create(): void {
    // Reset camera to defaults to ensure menu displays correctly when launched over other scenes
    this.cameras.main.setZoom(1);
    this.cameras.main.setScroll(0, 0);

    const { width, height } = this.cameras.main;

    // Semi-transparent background overlay
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
      .setDepth(5000);

    // Menu title
    this.add.text(width / 2, height / 2 - 120, 'Menu', {
      fontSize: '36px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(5000);

    // Show current player name
    const account = AccountManager.getActiveAccount();
    if (account) {
      this.add.text(width / 2, height / 2 - 80, `Player: ${account.name}`, {
        fontSize: '18px',
        color: '#aaaaaa',
      }).setOrigin(0.5).setDepth(5000);
    }

    // Create menu buttons
    this.createMenuButtons();

    // Set up keyboard input
    this.setupInput();

    // Initialize gamepad
    GamepadManager.setScene(this);
  }

  update(): void {
    GamepadManager.update();
    this.handleGamepadInput();
  }

  private createMenuButtons(): void {
    const { width, height } = this.cameras.main;
    const startY = height / 2 - 20;
    const buttonSpacing = 60;

    this.menuButtons = [];

    // Continue button
    const continueBtn = this.createMenuButton(width / 2, startY, 'Continue', () => {
      this.resumeGame();
    });
    this.menuButtons.push(continueBtn);

    // Switch Account button
    const switchBtn = this.createMenuButton(width / 2, startY + buttonSpacing, 'Switch Player', () => {
      this.switchAccount();
    });
    this.menuButtons.push(switchBtn);

    // Update initial selection
    this.updateSelection();
  }

  private createMenuButton(x: number, y: number, text: string, onClick: () => void): Phaser.GameObjects.Container {
    const buttonWidth = 200;
    const buttonHeight = 45;

    const container = this.add.container(x, y);
    container.setDepth(5000);

    // Background
    const bg = this.add.rectangle(0, 0, buttonWidth, buttonHeight, PALETTE.UI_BORDER)
      .setStrokeStyle(2, PALETTE.UI_TEXT);
    container.add(bg);

    // Text
    const label = this.add.text(0, 0, text, {
      fontSize: '20px',
      color: '#ffffff',
    }).setOrigin(0.5);
    container.add(label);

    // Make interactive
    bg.setInteractive({ useHandCursor: true })
      .on('pointerover', () => {
        this.selectedIndex = this.menuButtons.indexOf(container);
        this.updateSelection();
      })
      .on('pointerdown', onClick);

    // Store references
    container.setData('bg', bg);
    container.setData('onClick', onClick);

    return container;
  }

  private updateSelection(): void {
    this.menuButtons.forEach((btn, index) => {
      const bg = btn.getData('bg') as Phaser.GameObjects.Rectangle;
      if (index === this.selectedIndex) {
        bg.setFillStyle(0x6a6a8a);
        bg.setStrokeStyle(3, 0xffffff);
      } else {
        bg.setFillStyle(PALETTE.UI_BORDER);
        bg.setStrokeStyle(2, PALETTE.UI_TEXT);
      }
    });
  }

  private setupInput(): void {
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
          this.selectedIndex = Math.max(0, this.selectedIndex - 1);
          this.updateSelection();
          break;
        case 'ArrowDown':
        case 'KeyS':
          this.selectedIndex = Math.min(this.menuButtons.length - 1, this.selectedIndex + 1);
          this.updateSelection();
          break;
        case 'Enter':
        case 'Space':
          this.activateSelected();
          break;
        case 'Escape':
          this.resumeGame();
          break;
      }
    });
  }

  private handleGamepadInput(): void {
    if (GamepadManager.isButtonJustPressed(GAMEPAD_BUTTONS.DPAD_UP)) {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      this.updateSelection();
    }
    if (GamepadManager.isButtonJustPressed(GAMEPAD_BUTTONS.DPAD_DOWN)) {
      this.selectedIndex = Math.min(this.menuButtons.length - 1, this.selectedIndex + 1);
      this.updateSelection();
    }
    if (GamepadManager.isButtonJustPressed(GAMEPAD_BUTTONS.A)) {
      this.activateSelected();
    }
    if (GamepadManager.isButtonJustPressed(GAMEPAD_BUTTONS.B) ||
        GamepadManager.isButtonJustPressed(GAMEPAD_BUTTONS.START)) {
      this.resumeGame();
    }
  }

  private activateSelected(): void {
    const onClick = this.menuButtons[this.selectedIndex]?.getData('onClick') as (() => void) | undefined;
    if (onClick) onClick();
  }

  private resumeGame(): void {
    this.scene.stop();
    this.scene.resume(this.previousScene);
  }

  private switchAccount(): void {
    // Stop the menu and the game scene
    this.scene.stop();
    this.scene.stop(this.previousScene);
    
    // Clear active account
    AccountManager.clearActiveAccount();
    
    // Go to account select
    this.scene.start(SCENES.ACCOUNT_SELECT);
  }
}
