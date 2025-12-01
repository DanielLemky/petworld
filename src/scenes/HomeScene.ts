import Phaser from 'phaser';
import { SCENES, TILE_SIZE, PLAYER_SPEED, PLAYER_HEIGHT, PALETTE } from '../utils/constants';
import { PetManager } from '../systems/PetManager';
import type { CaughtPet } from '../systems/PetManager';
import { SoundManager } from '../systems/SoundManager';

export class HomeScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private playerDirection: string = 'down';
  private pets!: Phaser.Physics.Arcade.Group;
  private fences!: Phaser.Physics.Arcade.StaticGroup;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private exitZone!: Phaser.GameObjects.Zone;
  private infoText!: Phaser.GameObjects.Text;
  private petCountText!: Phaser.GameObjects.Text;
  private feedKey!: Phaser.Input.Keyboard.Key;
  private takeKey!: Phaser.Input.Keyboard.Key;
  private moodIndicators: Map<string, Phaser.GameObjects.Text> = new Map();
  private companionIndicators: Map<string, Phaser.GameObjects.Text> = new Map();
  private walkTween: Phaser.Tweens.Tween | null = null;
  private isWalking: boolean = false;
  private companionText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: SCENES.HOME });
  }

  create(): void {
    // Update pet stats based on time elapsed
    PetManager.updatePetStats();

    // Create the home environment
    this.createHome();

    // Create the player
    this.createPlayer();

    // Create pets from the player's collection
    this.createOwnedPets();

    // Set up input
    this.setupInput();

    // Set up camera
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(2.5);

    // Create UI
    this.createUI();

    // Create exit zone
    this.createExitZone();

    // Start home music
    SoundManager.playMusic('home');
  }

  update(): void {
    this.handlePlayerMovement();
    this.handlePetBehavior();
    this.updateDepthSorting();
    this.updateMoodIndicators();
    this.checkExitZone();
  }

  private createHome(): void {
    const homeWidth = 25;
    const homeHeight = 20;

    // Set world bounds
    this.physics.world.setBounds(0, 0, homeWidth * TILE_SIZE, homeHeight * TILE_SIZE);

    // Create grass background
    for (let y = 0; y < homeHeight; y++) {
      for (let x = 0; x < homeWidth; x++) {
        const grassType = Math.random() > 0.85 ? 'grass_flower' : 'grass';
        const tile = this.add.image(
          x * TILE_SIZE + TILE_SIZE / 2,
          y * TILE_SIZE + TILE_SIZE / 2,
          grassType
        );
        tile.setDepth(-10);
      }
    }

    // Create path to exit
    for (let y = 16; y < homeHeight; y++) {
      for (let x = 11; x < 14; x++) {
        const path = this.add.image(
          x * TILE_SIZE + TILE_SIZE / 2,
          y * TILE_SIZE + TILE_SIZE / 2,
          'path'
        );
        path.setDepth(-5);
      }
    }

    // Create house (simple representation)
    this.createHouse(3, 2);

    // Create fenced yard area
    this.createFence();

    // Add decorative elements
    this.addDecorations();
  }

  private createHouse(startX: number, startY: number): void {
    // House is just decorative for now - draw it with graphics
    const houseWidth = 6 * TILE_SIZE;
    const houseHeight = 5 * TILE_SIZE;
    const x = startX * TILE_SIZE + houseWidth / 2;
    const y = startY * TILE_SIZE + houseHeight / 2;

    // House base
    const houseBase = this.add.rectangle(x, y + 10, houseWidth, houseHeight - 20, PALETTE.WOOD_MID);
    houseBase.setStrokeStyle(2, PALETTE.WOOD_DARK);
    houseBase.setDepth(startY * TILE_SIZE);

    // Roof
    const roof = this.add.triangle(
      x, y - houseHeight / 2 + 15,
      0, 40,
      houseWidth / 2, 0,
      houseWidth, 40,
      0xc0392b
    );
    roof.setStrokeStyle(2, 0x922b21);
    roof.setDepth(startY * TILE_SIZE - 1);

    // Door
    const door = this.add.rectangle(x, y + 25, 20, 35, PALETTE.WOOD_DARK);
    door.setDepth(startY * TILE_SIZE + 1);

    // Windows
    const window1 = this.add.rectangle(x - 25, y, 15, 15, PALETTE.WATER_LIGHT);
    window1.setStrokeStyle(2, PALETTE.WOOD_DARK);
    window1.setDepth(startY * TILE_SIZE + 1);

    const window2 = this.add.rectangle(x + 25, y, 15, 15, PALETTE.WATER_LIGHT);
    window2.setStrokeStyle(2, PALETTE.WOOD_DARK);
    window2.setDepth(startY * TILE_SIZE + 1);

    // "Your Home" sign
    const sign = this.add.text(x, y - houseHeight / 2 - 10, 'Your Home', {
      fontSize: '10px',
      color: '#ffffff',
      backgroundColor: '#5d4e37',
      padding: { x: 4, y: 2 },
    });
    sign.setOrigin(0.5);
    sign.setDepth(startY * TILE_SIZE + 2);
  }

  private createFence(): void {
    this.fences = this.physics.add.staticGroup();

    // Fence posts positions (surrounding the yard)
    const fencePositions: { x: number; y: number }[] = [];

    // Top fence (leaving gap for house)
    for (let x = 10; x < 24; x++) {
      fencePositions.push({ x, y: 3 });
    }

    // Bottom fence (with gap for exit)
    for (let x = 1; x < 11; x++) {
      fencePositions.push({ x, y: 16 });
    }
    for (let x = 14; x < 24; x++) {
      fencePositions.push({ x, y: 16 });
    }

    // Left fence
    for (let y = 4; y < 16; y++) {
      fencePositions.push({ x: 1, y });
    }

    // Right fence
    for (let y = 3; y < 16; y++) {
      fencePositions.push({ x: 23, y });
    }

    fencePositions.forEach(pos => {
      this.createFencePost(pos.x, pos.y);
    });
  }

  private createFencePost(tileX: number, tileY: number): void {
    const x = tileX * TILE_SIZE + TILE_SIZE / 2;
    const y = tileY * TILE_SIZE + TILE_SIZE / 2;

    // Visual fence post
    const post = this.add.rectangle(x, y, TILE_SIZE - 4, TILE_SIZE - 4, PALETTE.WOOD_LIGHT);
    post.setStrokeStyle(2, PALETTE.WOOD_DARK);
    post.setDepth(tileY * TILE_SIZE);

    // Create invisible sprite for physics collision (use grass texture but make invisible)
    const collider = this.fences.create(x, y, 'grass') as Phaser.Physics.Arcade.Sprite;
    collider.setVisible(false);
    collider.setSize(TILE_SIZE - 4, TILE_SIZE - 4);
    collider.refreshBody();
  }

  private addDecorations(): void {
    // Add some trees around the edges
    const treePositions = [
      { x: 20, y: 5 },
      { x: 18, y: 8 },
      { x: 21, y: 12 },
    ];

    treePositions.forEach(pos => {
      const tree = this.add.image(
        pos.x * TILE_SIZE + TILE_SIZE,
        pos.y * TILE_SIZE + TILE_SIZE * 1.5,
        'tree'
      );
      tree.setDepth(pos.y * TILE_SIZE + TILE_SIZE * 3);
    });

    // Add flowers
    const flowerPositions = [
      { x: 5, y: 10 }, { x: 8, y: 12 }, { x: 15, y: 6 },
      { x: 18, y: 14 }, { x: 12, y: 8 }, { x: 6, y: 14 },
    ];
    const flowerTypes = ['flower_red', 'flower_yellow', 'flower_blue', 'flower_pink'];

    flowerPositions.forEach((pos, i) => {
      const flower = this.add.image(
        pos.x * TILE_SIZE + TILE_SIZE / 2,
        pos.y * TILE_SIZE + TILE_SIZE / 2,
        flowerTypes[i % flowerTypes.length]
      );
      flower.setDepth(pos.y * TILE_SIZE);
    });

    // Water bowl for pets
    const bowl = this.add.ellipse(10 * TILE_SIZE, 10 * TILE_SIZE, 20, 12, PALETTE.WATER_MID);
    bowl.setStrokeStyle(2, PALETTE.WOOD_DARK);
    bowl.setDepth(10 * TILE_SIZE);

    // Food bowl
    const foodBowl = this.add.ellipse(11 * TILE_SIZE + 8, 10 * TILE_SIZE, 20, 12, PALETTE.DIRT_LIGHT);
    foodBowl.setStrokeStyle(2, PALETTE.WOOD_DARK);
    foodBowl.setDepth(10 * TILE_SIZE);
  }

  private createPlayer(): void {
    this.player = this.physics.add.sprite(
      12 * TILE_SIZE + TILE_SIZE / 2,
      14 * TILE_SIZE + PLAYER_HEIGHT / 2,
      'player_down'
    );

    // Scale down the high-res sprite
    this.player.setScale(0.015);

    this.player.setSize(800, 400);
    this.player.setOffset(400, 2400);
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(this.player.y);

    // Collide with fences
    this.physics.add.collider(this.player, this.fences);
  }

  private createOwnedPets(): void {
    this.pets = this.physics.add.group();

    const caughtPets = PetManager.getCaughtPets();

    if (caughtPets.length === 0) {
      // Show message if no pets
      const noPetsText = this.add.text(
        12 * TILE_SIZE,
        9 * TILE_SIZE,
        'No pets yet!\nGo explore and catch some!',
        {
          fontSize: '10px',
          color: '#666666',
          align: 'center',
        }
      );
      noPetsText.setOrigin(0.5);
      noPetsText.setDepth(100);
      return;
    }

    // Spawn positions in the yard
    const spawnPositions = [
      { x: 6, y: 8 }, { x: 10, y: 6 }, { x: 14, y: 8 },
      { x: 8, y: 12 }, { x: 12, y: 10 }, { x: 16, y: 12 },
      { x: 5, y: 14 }, { x: 18, y: 10 },
    ];

    caughtPets.forEach((petData, index) => {
      const pos = spawnPositions[index % spawnPositions.length];
      const petType = petData.type.toLowerCase();

      // Butterflies use different sprite naming
      const spriteKey = petType.startsWith('butterfly_')
        ? petType
        : `pet_${petType}`;

      const pet = this.pets.create(
        pos.x * TILE_SIZE + TILE_SIZE / 2,
        pos.y * TILE_SIZE + TILE_SIZE / 2,
        spriteKey
      ) as Phaser.Physics.Arcade.Sprite;

      pet.setCollideWorldBounds(true);
      pet.setData('wanderTimer', Math.random() * 2000);
      pet.setData('wanderDirection', { x: 0, y: 0 });
      pet.setData('petData', petData);
      pet.setDepth(pos.y * TILE_SIZE);

      pet.setSize(10, 6);
      pet.setOffset(3, TILE_SIZE - 8);

      // Create mood indicator above pet
      const moodIndicator = this.add.text(pet.x, pet.y - 12, '', {
        fontSize: '10px',
      });
      moodIndicator.setOrigin(0.5);
      moodIndicator.setDepth(2000);
      this.moodIndicators.set(petData.id, moodIndicator);

      // Create companion indicator (star for current companion)
      const companionIndicator = this.add.text(pet.x, pet.y - 20, '', {
        fontSize: '8px',
      });
      companionIndicator.setOrigin(0.5);
      companionIndicator.setDepth(2001);
      this.companionIndicators.set(petData.id, companionIndicator);

      // Show star if this is the current companion
      if (PetManager.getCompanionId() === petData.id) {
        companionIndicator.setText('⭐');
      }
    });

    // Pets collide with fences and each other
    this.physics.add.collider(this.pets, this.fences);
    this.physics.add.collider(this.pets, this.pets);
  }

  private createExitZone(): void {
    // Exit zone at the bottom of the path
    this.exitZone = this.add.zone(12.5 * TILE_SIZE, 19 * TILE_SIZE, 3 * TILE_SIZE, TILE_SIZE);

    // Visual indicator for exit
    const exitText = this.add.text(12.5 * TILE_SIZE, 18 * TILE_SIZE, 'To World', {
      fontSize: '8px',
      color: '#ffffff',
      backgroundColor: '#2d2d44aa',
      padding: { x: 4, y: 2 },
    });
    exitText.setOrigin(0.5);
    exitText.setDepth(100);

    // Arrow indicator
    const arrow = this.add.text(12.5 * TILE_SIZE, 18.5 * TILE_SIZE, '▼', {
      fontSize: '10px',
      color: '#4ade80',
    });
    arrow.setOrigin(0.5);
    arrow.setDepth(100);

    // Animate arrow
    this.tweens.add({
      targets: arrow,
      y: arrow.y + 4,
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private createUI(): void {
    this.infoText = this.add.text(16, 16, 'WASD move | SPACE pet | F feed | T take', {
      fontSize: '10px',
      color: '#ffffff',
      backgroundColor: '#2d2d44dd',
      padding: { x: 6, y: 3 },
    });
    this.infoText.setScrollFactor(0);
    this.infoText.setDepth(1000);

    const petCount = PetManager.getPetCount();
    this.petCountText = this.add.text(16, 38, `Pets at home: ${petCount}`, {
      fontSize: '10px',
      color: '#4ade80',
      backgroundColor: '#2d2d44dd',
      padding: { x: 6, y: 3 },
    });
    this.petCountText.setScrollFactor(0);
    this.petCountText.setDepth(1000);

    // Companion status
    const companion = PetManager.getCompanion();
    const companionLabel = companion ? `Companion: ${companion.name}` : 'No companion';
    this.companionText = this.add.text(16, 60, companionLabel, {
      fontSize: '10px',
      color: companion ? '#f472b6' : '#888888',
      backgroundColor: '#2d2d44dd',
      padding: { x: 6, y: 3 },
    });
    this.companionText.setScrollFactor(0);
    this.companionText.setDepth(1000);

    // Location indicator
    const locationText = this.add.text(
      this.cameras.main.width - 16,
      16,
      'HOME',
      {
        fontSize: '10px',
        color: '#ffd700',
        backgroundColor: '#2d2d44dd',
        padding: { x: 6, y: 3 },
      }
    );
    locationText.setOrigin(1, 0);
    locationText.setScrollFactor(0);
    locationText.setDepth(1000);
  }

  private setupInput(): void {
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasd = {
        W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
      this.interactKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      this.feedKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
      this.takeKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.T);

      this.interactKey.on('down', () => this.handleInteraction());
      this.feedKey.on('down', () => this.handleFeeding());
      this.takeKey.on('down', () => this.handleTakeWithMe());
    }
  }

  private handlePlayerMovement(): void {
    let velocityX = 0;
    let velocityY = 0;
    let newDirection = this.playerDirection;

    if (this.cursors?.left.isDown || this.wasd?.A.isDown) {
      velocityX = -PLAYER_SPEED;
      newDirection = 'left';
    } else if (this.cursors?.right.isDown || this.wasd?.D.isDown) {
      velocityX = PLAYER_SPEED;
      newDirection = 'right';
    }

    if (this.cursors?.up.isDown || this.wasd?.W.isDown) {
      velocityY = -PLAYER_SPEED;
      if (velocityX === 0) newDirection = 'up';
    } else if (this.cursors?.down.isDown || this.wasd?.S.isDown) {
      velocityY = PLAYER_SPEED;
      if (velocityX === 0) newDirection = 'down';
    }

    if (velocityX !== 0 && velocityY !== 0) {
      velocityX *= 0.707;
      velocityY *= 0.707;
    }

    this.player.setVelocity(velocityX, velocityY);

    // Handle walk animation
    const moving = velocityX !== 0 || velocityY !== 0;
    if (moving && !this.isWalking) {
      this.startWalkAnimation();
    } else if (!moving && this.isWalking) {
      this.stopWalkAnimation();
    }

    if (newDirection !== this.playerDirection) {
      this.playerDirection = newDirection;
      this.player.setTexture(`player_${newDirection}`);
    }
  }

  private startWalkAnimation(): void {
    this.isWalking = true;
    if (this.walkTween) this.walkTween.stop();
    this.walkTween = this.tweens.add({
      targets: this.player,
      scaleY: { from: 0.015, to: 0.014 },
      scaleX: { from: 0.015, to: 0.016 },
      duration: 100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private stopWalkAnimation(): void {
    this.isWalking = false;
    if (this.walkTween) {
      this.walkTween.stop();
      this.walkTween = null;
    }
    this.player.setScale(0.015);
  }

  private handlePetBehavior(): void {
    const petSpeed = 15; // Slower at home, they're relaxed!

    this.pets.children.each((pet: Phaser.GameObjects.GameObject) => {
      const sprite = pet as Phaser.Physics.Arcade.Sprite;
      let timer = sprite.getData('wanderTimer') as number;

      timer -= this.game.loop.delta;

      if (timer <= 0) {
        const directions = [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: -1, y: 0 },
          { x: 0, y: 1 },
          { x: 0, y: -1 },
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          { x: 0, y: 0 }, // Even more likely to stop at home
        ];

        const newDir = directions[Math.floor(Math.random() * directions.length)];
        sprite.setData('wanderDirection', newDir);
        sprite.setData('wanderTimer', 2000 + Math.random() * 4000);
      } else {
        sprite.setData('wanderTimer', timer);
      }

      const dir = sprite.getData('wanderDirection') as { x: number; y: number };
      sprite.setVelocity(dir.x * petSpeed, dir.y * petSpeed);

      return true;
    });
  }

  private updateDepthSorting(): void {
    this.player.setDepth(this.player.y + PLAYER_HEIGHT / 2);

    this.pets.children.each((pet: Phaser.GameObjects.GameObject) => {
      const sprite = pet as Phaser.Physics.Arcade.Sprite;
      sprite.setDepth(sprite.y + TILE_SIZE / 2);
      return true;
    });
  }

  private handleInteraction(): void {
    let nearestPet: Phaser.Physics.Arcade.Sprite | null = null;
    let nearestDistance = TILE_SIZE * 3;

    this.pets.children.each((pet: Phaser.GameObjects.GameObject) => {
      const sprite = pet as Phaser.Physics.Arcade.Sprite;
      const distance = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        sprite.x, sprite.y
      );

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestPet = sprite;
      }

      return true;
    });

    if (nearestPet) {
      this.petInteraction(nearestPet);
    }
  }

  private petInteraction(pet: Phaser.Physics.Arcade.Sprite): void {
    const petData = pet.getData('petData') as CaughtPet;
    const petName = petData.name;

    // Play pet sound
    SoundManager.playPet();

    // Update happiness via PetManager
    PetManager.playWithPet(petData.id);

    // Refresh pet data
    const updatedPet = PetManager.getPetById(petData.id);
    if (updatedPet) {
      pet.setData('petData', updatedPet);
    }

    // Show love reaction
    const heart = this.add.text(pet.x, pet.y - 20, '❤️', {
      fontSize: '16px',
    });
    heart.setOrigin(0.5);
    heart.setDepth(2000);

    // Float up and fade
    this.tweens.add({
      targets: heart,
      y: heart.y - 20,
      alpha: 0,
      duration: 800,
      ease: 'Quad.easeOut',
      onComplete: () => heart.destroy(),
    });

    // Pet does happy bounce
    this.tweens.add({
      targets: pet,
      y: pet.y - 8,
      duration: 150,
      yoyo: true,
      repeat: 2,
      ease: 'Quad.easeOut',
    });

    // Show stats display
    this.showPetStats(pet, updatedPet || petData);
  }

  private checkExitZone(): void {
    const playerBounds = this.player.getBounds();
    const zoneBounds = this.exitZone.getBounds();

    if (Phaser.Geom.Rectangle.Overlaps(playerBounds, zoneBounds)) {
      this.goToWorld();
    }
  }

  private goToWorld(): void {
    // Play transition sound
    SoundManager.playClick();

    // Fade out and switch scene
    this.cameras.main.fadeOut(300, 0, 0, 0);

    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(SCENES.WORLD);
    });
  }

  private updateMoodIndicators(): void {
    this.pets.children.each((pet: Phaser.GameObjects.GameObject) => {
      const sprite = pet as Phaser.Physics.Arcade.Sprite;
      const petData = sprite.getData('petData') as CaughtPet;

      if (petData) {
        const indicator = this.moodIndicators.get(petData.id);
        if (indicator) {
          // Position above pet
          indicator.setPosition(sprite.x, sprite.y - 14);

          // Get mood emoji
          const mood = PetManager.getPetMood(petData);
          let emoji = '';
          switch (mood) {
            case 'happy': emoji = '😊'; break;
            case 'content': emoji = ''; break; // No indicator when content
            case 'hungry': emoji = '🍽️'; break;
            case 'sad': emoji = '😢'; break;
          }
          indicator.setText(emoji);
        }

        // Update companion indicator position
        const companionIndicator = this.companionIndicators.get(petData.id);
        if (companionIndicator) {
          companionIndicator.setPosition(sprite.x, sprite.y - 22);
        }
      }
      return true;
    });
  }

  private handleTakeWithMe(): void {
    let nearestPet: Phaser.Physics.Arcade.Sprite | null = null;
    let nearestDistance = TILE_SIZE * 3;

    this.pets.children.each((pet: Phaser.GameObjects.GameObject) => {
      const sprite = pet as Phaser.Physics.Arcade.Sprite;
      const distance = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        sprite.x, sprite.y
      );

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestPet = sprite;
      }
      return true;
    });

    if (nearestPet) {
      const petData = (nearestPet as Phaser.Physics.Arcade.Sprite).getData('petData') as CaughtPet;
      if (petData) {
        const currentCompanionId = PetManager.getCompanionId();

        // If clicking on current companion, remove them
        if (currentCompanionId === petData.id) {
          PetManager.clearCompanion();
          this.showMessage(`${petData.name} will stay home`, '#888888');

          // Clear all companion indicators
          this.companionIndicators.forEach(indicator => indicator.setText(''));
        } else {
          // Set new companion
          PetManager.setCompanion(petData.id);
          this.showMessage(`${petData.name} will follow you!`, '#f472b6');

          // Update companion indicators
          this.companionIndicators.forEach((indicator, id) => {
            indicator.setText(id === petData.id ? '⭐' : '');
          });
        }

        // Update companion UI text
        const companion = PetManager.getCompanion();
        const companionLabel = companion ? `Companion: ${companion.name}` : 'No companion';
        this.companionText.setText(companionLabel);
        this.companionText.setColor(companion ? '#f472b6' : '#888888');

        // Play sound
        SoundManager.playClick();
      }
    }
  }

  private showMessage(text: string, color: string): void {
    const message = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 - 40,
      text,
      {
        fontSize: '12px',
        color: color,
        backgroundColor: '#2d2d44ee',
        padding: { x: 10, y: 6 },
      }
    );
    message.setOrigin(0.5);
    message.setScrollFactor(0);
    message.setDepth(2000);

    // Animate
    message.setAlpha(0);
    message.setScale(0.5);

    this.tweens.add({
      targets: message,
      alpha: 1,
      scale: 1,
      duration: 200,
      ease: 'Back.easeOut',
    });

    this.tweens.add({
      targets: message,
      alpha: 0,
      y: message.y - 30,
      duration: 500,
      delay: 1500,
      ease: 'Quad.easeIn',
      onComplete: () => message.destroy(),
    });
  }

  private handleFeeding(): void {
    let nearestPet: Phaser.Physics.Arcade.Sprite | null = null;
    let nearestDistance = TILE_SIZE * 3;

    this.pets.children.each((pet: Phaser.GameObjects.GameObject) => {
      const sprite = pet as Phaser.Physics.Arcade.Sprite;
      const distance = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        sprite.x, sprite.y
      );

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestPet = sprite;
      }
      return true;
    });

    if (nearestPet) {
      const petSprite = nearestPet as Phaser.Physics.Arcade.Sprite;
      const petData = petSprite.getData('petData') as CaughtPet;
      if (petData) {
        // Play feeding sound
        SoundManager.playPet();

        PetManager.feedPet(petData.id);

        // Refresh pet data
        const updatedPet = PetManager.getPetById(petData.id);
        if (updatedPet) {
          petSprite.setData('petData', updatedPet);
        }

        // Show feeding animation
        const foodEmoji = this.add.text(petSprite.x, petSprite.y - 20, '🍖', {
          fontSize: '14px',
        });
        foodEmoji.setOrigin(0.5);
        foodEmoji.setDepth(2000);

        this.tweens.add({
          targets: foodEmoji,
          y: foodEmoji.y - 15,
          alpha: 0,
          duration: 600,
          ease: 'Quad.easeOut',
          onComplete: () => foodEmoji.destroy(),
        });

        // Pet does eating animation
        this.tweens.add({
          targets: nearestPet,
          scaleX: 1.1,
          scaleY: 0.9,
          duration: 100,
          yoyo: true,
          repeat: 2,
        });

        // Show stats display
        this.showPetStats(nearestPet, updatedPet || petData);
      }
    }
  }

  private showPetStats(pet: Phaser.Physics.Arcade.Sprite, petData: CaughtPet): void {
    const statsContainer = this.add.container(pet.x, pet.y + 24);
    statsContainer.setDepth(2000);

    // Background
    const bg = this.add.rectangle(0, 0, 70, 36, 0x2d2d44, 0.9);
    bg.setStrokeStyle(1, 0x4a4a6a);
    statsContainer.add(bg);

    // Pet name
    const nameText = this.add.text(0, -12, petData.name, {
      fontSize: '8px',
      color: '#ffffff',
    });
    nameText.setOrigin(0.5);
    statsContainer.add(nameText);

    // Hunger bar
    const hungerLabel = this.add.text(-30, -1, '🍖', { fontSize: '8px' });
    hungerLabel.setOrigin(0, 0.5);
    statsContainer.add(hungerLabel);

    const hungerBg = this.add.rectangle(5, -1, 40, 6, 0x333333);
    statsContainer.add(hungerBg);

    const hungerFill = this.add.rectangle(
      5 - 20 + (petData.hunger / 100) * 20,
      -1,
      (petData.hunger / 100) * 40,
      6,
      petData.hunger > 30 ? 0xf59e0b : 0xef4444
    );
    statsContainer.add(hungerFill);

    // Happiness bar
    const happyLabel = this.add.text(-30, 9, '❤️', { fontSize: '8px' });
    happyLabel.setOrigin(0, 0.5);
    statsContainer.add(happyLabel);

    const happyBg = this.add.rectangle(5, 9, 40, 6, 0x333333);
    statsContainer.add(happyBg);

    const happyFill = this.add.rectangle(
      5 - 20 + (petData.happiness / 100) * 20,
      9,
      (petData.happiness / 100) * 40,
      6,
      petData.happiness > 30 ? 0xec4899 : 0xef4444
    );
    statsContainer.add(happyFill);

    // Fade out
    this.tweens.add({
      targets: statsContainer,
      alpha: 0,
      y: statsContainer.y + 10,
      duration: 500,
      delay: 1500,
      onComplete: () => statsContainer.destroy(),
    });
  }
}
