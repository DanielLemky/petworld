import Phaser from 'phaser';
import { SCENES, PALETTE } from '../utils/constants';
import { AccountManager, type Account } from '../systems/AccountManager';
import { PetManager } from '../systems/PetManager';
import { InventoryManager } from '../systems/InventoryManager';
import { GamepadManager, GAMEPAD_BUTTONS } from '../systems/GamepadManager';

const MAX_NAME_LENGTH = 12;

export class AccountSelectScene extends Phaser.Scene {
  private accountButtons: Phaser.GameObjects.Container[] = [];
  private newAccountButton!: Phaser.GameObjects.Container;
  private selectedIndex: number = 0;
  private isCreatingAccount: boolean = false;
  private inputText: string = '';
  private inputDisplay!: Phaser.GameObjects.Text;
  private inputContainer!: Phaser.GameObjects.Container;
  private confirmButton!: Phaser.GameObjects.Container;
  private cancelButton!: Phaser.GameObjects.Container;
  private cursorBlink: Phaser.Time.TimerEvent | null = null;
  private showCursor: boolean = true;

  constructor() {
    super({ key: SCENES.ACCOUNT_SELECT });
  }

  create(): void {
    const { width } = this.cameras.main;

    // Background
    this.cameras.main.setBackgroundColor(PALETTE.UI_BACKGROUND);

    // Title
    this.add.text(width / 2, 60, 'Pet World', {
      fontSize: '48px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Subtitle
    this.add.text(width / 2, 110, 'Select Player', {
      fontSize: '24px',
      color: '#aaaaaa',
    }).setOrigin(0.5);

    // Create account buttons
    this.createAccountList();

    // Create input container (hidden initially)
    this.createInputUI();

    // Set up keyboard input
    this.setupKeyboardInput();

    // Initialize gamepad
    if (!GamepadManager.isInitialized()) {
      GamepadManager.init(this);
    } else {
      GamepadManager.setScene(this);
    }
  }

  update(): void {
    GamepadManager.update();

    if (this.isCreatingAccount) {
      this.handleCreateModeInput();
    } else {
      this.handleSelectModeInput();
    }
  }

  private createAccountList(): void {
    const { width } = this.cameras.main;
    const accounts = AccountManager.getAccounts();
    const startY = 180;
    const buttonHeight = 50;
    const buttonSpacing = 10;

    // Clear existing buttons
    this.accountButtons.forEach(btn => btn.destroy());
    this.accountButtons = [];

    // Create buttons for existing accounts
    accounts.forEach((account, index) => {
      const y = startY + index * (buttonHeight + buttonSpacing);
      const button = this.createAccountButton(width / 2, y, account.name, () => {
        this.selectAccount(account);
      });
      this.accountButtons.push(button);
    });

    // Create "New Account" button
    const newAccountY = startY + accounts.length * (buttonHeight + buttonSpacing);
    this.newAccountButton = this.createAccountButton(width / 2, newAccountY, '+ New Player', () => {
      this.showCreateAccountUI();
    });
    this.accountButtons.push(this.newAccountButton);

    // Update visual selection
    this.updateSelection();
  }

  private createAccountButton(x: number, y: number, text: string, onClick: () => void): Phaser.GameObjects.Container {
    const buttonWidth = 250;
    const buttonHeight = 45;

    const container = this.add.container(x, y);

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
        this.selectedIndex = this.accountButtons.indexOf(container);
        this.updateSelection();
      })
      .on('pointerdown', onClick);

    // Store reference to bg for selection highlight
    container.setData('bg', bg);
    container.setData('onClick', onClick);

    return container;
  }

  private updateSelection(): void {
    this.accountButtons.forEach((btn, index) => {
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

  private createInputUI(): void {
    const { width, height } = this.cameras.main;

    this.inputContainer = this.add.container(width / 2, height / 2);
    this.inputContainer.setVisible(false);

    // Dark overlay background
    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.7);
    this.inputContainer.add(overlay);

    // Input box background
    const inputBg = this.add.rectangle(0, -20, 300, 50, PALETTE.UI_BORDER)
      .setStrokeStyle(2, PALETTE.UI_TEXT);
    this.inputContainer.add(inputBg);

    // Label
    const label = this.add.text(0, -70, 'Enter Player Name:', {
      fontSize: '20px',
      color: '#ffffff',
    }).setOrigin(0.5);
    this.inputContainer.add(label);

    // Input text display
    this.inputDisplay = this.add.text(0, -20, '', {
      fontSize: '24px',
      color: '#ffffff',
    }).setOrigin(0.5);
    this.inputContainer.add(this.inputDisplay);

    // Create button
    this.confirmButton = this.add.container(0, 50);
    const confirmBg = this.add.rectangle(0, 0, 120, 40, 0x4a8a4a)
      .setStrokeStyle(2, 0xffffff);
    const confirmText = this.add.text(0, 0, 'Create', {
      fontSize: '18px',
      color: '#ffffff',
    }).setOrigin(0.5);
    this.confirmButton.add([confirmBg, confirmText]);
    this.confirmButton.setData('bg', confirmBg);
    confirmBg.setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.confirmCreateAccount());
    this.inputContainer.add(this.confirmButton);

    // Cancel button
    this.cancelButton = this.add.container(0, 100);
    const cancelBg = this.add.rectangle(0, 0, 120, 40, 0x8a4a4a)
      .setStrokeStyle(2, 0xffffff);
    const cancelText = this.add.text(0, 0, 'Cancel', {
      fontSize: '18px',
      color: '#ffffff',
    }).setOrigin(0.5);
    this.cancelButton.add([cancelBg, cancelText]);
    this.cancelButton.setData('bg', cancelBg);
    cancelBg.setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.hideCreateAccountUI());
    this.inputContainer.add(this.cancelButton);
  }

  private showCreateAccountUI(): void {
    this.isCreatingAccount = true;
    this.inputText = '';
    this.updateInputDisplay();
    this.inputContainer.setVisible(true);
    this.selectedIndex = 0; // 0 = Create button, 1 = Cancel button

    // Start cursor blink
    this.showCursor = true;
    this.cursorBlink = this.time.addEvent({
      delay: 500,
      callback: () => {
        this.showCursor = !this.showCursor;
        this.updateInputDisplay();
      },
      loop: true,
    });

    this.updateCreateModeSelection();
  }

  private hideCreateAccountUI(): void {
    this.isCreatingAccount = false;
    this.inputContainer.setVisible(false);
    this.selectedIndex = 0;

    // Stop cursor blink
    if (this.cursorBlink) {
      this.cursorBlink.destroy();
      this.cursorBlink = null;
    }

    this.updateSelection();
  }

  private updateInputDisplay(): void {
    const cursor = this.showCursor ? '|' : '';
    this.inputDisplay.setText(this.inputText + cursor);
  }

  private updateCreateModeSelection(): void {
    const confirmBg = this.confirmButton.getData('bg') as Phaser.GameObjects.Rectangle;
    const cancelBg = this.cancelButton.getData('bg') as Phaser.GameObjects.Rectangle;

    if (this.selectedIndex === 0) {
      confirmBg.setFillStyle(0x5a9a5a);
      confirmBg.setStrokeStyle(3, 0xffffff);
      cancelBg.setFillStyle(0x8a4a4a);
      cancelBg.setStrokeStyle(2, 0xffffff);
    } else {
      confirmBg.setFillStyle(0x4a8a4a);
      confirmBg.setStrokeStyle(2, 0xffffff);
      cancelBg.setFillStyle(0x9a5a5a);
      cancelBg.setStrokeStyle(3, 0xffffff);
    }
  }

  private setupKeyboardInput(): void {
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (this.isCreatingAccount) {
        this.handleCreateModeKeydown(event);
      } else {
        this.handleSelectModeKeydown(event);
      }
    });
  }

  private handleSelectModeKeydown(event: KeyboardEvent): void {
    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW':
        this.selectedIndex = Math.max(0, this.selectedIndex - 1);
        this.updateSelection();
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.selectedIndex = Math.min(this.accountButtons.length - 1, this.selectedIndex + 1);
        this.updateSelection();
        break;
      case 'Enter':
      case 'Space':
        const onClick = this.accountButtons[this.selectedIndex]?.getData('onClick') as (() => void) | undefined;
        if (onClick) onClick();
        break;
    }
  }

  private handleSelectModeInput(): void {
    // Gamepad navigation
    if (GamepadManager.isButtonJustPressed(GAMEPAD_BUTTONS.DPAD_UP)) {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      this.updateSelection();
    }
    if (GamepadManager.isButtonJustPressed(GAMEPAD_BUTTONS.DPAD_DOWN)) {
      this.selectedIndex = Math.min(this.accountButtons.length - 1, this.selectedIndex + 1);
      this.updateSelection();
    }
    if (GamepadManager.isButtonJustPressed(GAMEPAD_BUTTONS.A)) {
      const onClick = this.accountButtons[this.selectedIndex]?.getData('onClick') as (() => void) | undefined;
      if (onClick) onClick();
    }
  }

  private handleCreateModeKeydown(event: KeyboardEvent): void {
    // Handle text input
    if (event.key === 'Backspace') {
      this.inputText = this.inputText.slice(0, -1);
      this.updateInputDisplay();
      return;
    }

    if (event.key === 'Enter') {
      if (this.selectedIndex === 0) {
        this.confirmCreateAccount();
      } else {
        this.hideCreateAccountUI();
      }
      return;
    }

    if (event.key === 'Escape') {
      this.hideCreateAccountUI();
      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      this.selectedIndex = this.selectedIndex === 0 ? 1 : 0;
      this.updateCreateModeSelection();
      return;
    }

    // Allow alphanumeric and space
    if (event.key.length === 1 && /[a-zA-Z0-9 ]/.test(event.key)) {
      if (this.inputText.length < MAX_NAME_LENGTH) {
        this.inputText += event.key;
        this.updateInputDisplay();
      }
    }
  }

  private handleCreateModeInput(): void {
    // Gamepad navigation between Create/Cancel buttons
    if (GamepadManager.isButtonJustPressed(GAMEPAD_BUTTONS.DPAD_UP) ||
        GamepadManager.isButtonJustPressed(GAMEPAD_BUTTONS.DPAD_DOWN)) {
      this.selectedIndex = this.selectedIndex === 0 ? 1 : 0;
      this.updateCreateModeSelection();
    }

    if (GamepadManager.isButtonJustPressed(GAMEPAD_BUTTONS.A)) {
      if (this.selectedIndex === 0) {
        this.confirmCreateAccount();
      } else {
        this.hideCreateAccountUI();
      }
    }

    if (GamepadManager.isButtonJustPressed(GAMEPAD_BUTTONS.B)) {
      this.hideCreateAccountUI();
    }
  }

  private confirmCreateAccount(): void {
    const name = this.inputText.trim();
    if (name.length === 0) {
      // Flash the input box red briefly
      const inputBg = this.inputContainer.list.find(
        obj => obj instanceof Phaser.GameObjects.Rectangle && (obj as Phaser.GameObjects.Rectangle).width === 300
      ) as Phaser.GameObjects.Rectangle;
      if (inputBg) {
        inputBg.setFillStyle(0x8a4a4a);
        this.time.delayedCall(200, () => {
          inputBg.setFillStyle(PALETTE.UI_BORDER);
        });
      }
      return;
    }

    // Create the account
    const account = AccountManager.createAccount(name);
    this.hideCreateAccountUI();
    this.selectAccount(account);
  }

  private selectAccount(account: Account): void {
    // Select the account
    AccountManager.selectAccount(account.id);

    // Reload game data for this account
    PetManager.reload();
    InventoryManager.reload();

    // Start the game
    this.scene.start(SCENES.WORLD);
  }
}
