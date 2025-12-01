import Phaser from 'phaser';
import { SCENES, TILE_SIZE, PLAYER_SPEED, PLAYER_HEIGHT, PALETTE } from '../utils/constants';
import { CatchingUI } from '../ui/CatchingUI';
import { PetManager } from '../systems/PetManager';
import { SoundManager } from '../systems/SoundManager';
import { InventoryManager, TOOL_INFO, type ToolType } from '../systems/InventoryManager';

const MOUNTAIN_PET_TYPES = ['GOAT', 'EAGLE', 'FOX', 'BEAR_CUB'];

export class MountainScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private boulders!: Phaser.Physics.Arcade.StaticGroup;
  private pets!: Phaser.Physics.Arcade.Group;
  private eagles!: Phaser.Physics.Arcade.Group;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private infoText!: Phaser.GameObjects.Text;
  private petCountText!: Phaser.GameObjects.Text;
  private playerDirection: string = 'down';

  private catchingUI!: CatchingUI;
  private isCatching: boolean = false;
  private targetPet: Phaser.Physics.Arcade.Sprite | null = null;
  private exitZone!: Phaser.GameObjects.Zone;
  private isTransitioning: boolean = false;
  private windParticles: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private collectibles!: Phaser.Physics.Arcade.Group;
  private inventoryText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: SCENES.MOUNTAIN });
  }

  create(): void {
    this.isTransitioning = false;
    this.isCatching = false;

    this.catchingUI = new CatchingUI(this);

    this.createWorld();
    this.createPlayer();
    this.createPets();
    this.createEagles();
    this.createCollectibles();
    this.setupInput();

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(2.5);

    this.createUI();
    this.createWindEffect();

    SoundManager.playMusic('world');
  }

  update(): void {
    if (this.isCatching) return;

    this.handlePlayerMovement();
    this.handlePetBehavior();
    this.handleEagleBehavior();
    this.updateDepthSorting();
    this.checkExitZone();
  }

  private createWorld(): void {
    const worldWidth = 45;
    const worldHeight = 35;

    this.physics.world.setBounds(0, 0, worldWidth * TILE_SIZE, worldHeight * TILE_SIZE);

    // Rocky ground
    for (let y = 0; y < worldHeight; y++) {
      for (let x = 0; x < worldWidth; x++) {
        const rockType = Math.random() > 0.8 ? 'rock_pebbles' : 'rock';
        const tile = this.add.image(
          x * TILE_SIZE + TILE_SIZE / 2,
          y * TILE_SIZE + TILE_SIZE / 2,
          rockType
        );
        tile.setDepth(-10);
      }
    }

    // Mountain paths
    this.createMountainPaths();

    // Cliff walls along the top
    for (let x = 0; x < worldWidth; x++) {
      for (let y = 0; y < 3; y++) {
        const cliff = this.add.image(
          x * TILE_SIZE + TILE_SIZE / 2,
          y * TILE_SIZE + TILE_SIZE / 2,
          'cliff'
        );
        cliff.setDepth(-5);
      }
    }

    // Mountain peaks in background
    const peakPositions = [
      { x: 8, y: 2 }, { x: 20, y: 1 }, { x: 35, y: 2 },
    ];
    peakPositions.forEach(pos => {
      const peak = this.add.image(
        pos.x * TILE_SIZE + TILE_SIZE * 1.5,
        pos.y * TILE_SIZE + TILE_SIZE,
        'mountain_peak'
      );
      peak.setDepth(-8);
      peak.setAlpha(0.7);
    });

    // Boulders as obstacles
    this.boulders = this.physics.add.staticGroup();
    const boulderPositions = [
      { x: 10, y: 10 }, { x: 25, y: 8 }, { x: 38, y: 12 },
      { x: 8, y: 20 }, { x: 30, y: 18 }, { x: 15, y: 25 },
      { x: 35, y: 25 }, { x: 22, y: 30 }, { x: 40, y: 8 },
    ];

    boulderPositions.forEach(pos => {
      const boulder = this.add.image(
        pos.x * TILE_SIZE + TILE_SIZE,
        pos.y * TILE_SIZE + TILE_SIZE,
        'boulder'
      );
      boulder.setDepth(pos.y * TILE_SIZE + TILE_SIZE * 2);

      const collider = this.boulders.create(
        pos.x * TILE_SIZE + TILE_SIZE,
        pos.y * TILE_SIZE + TILE_SIZE * 1.3,
        'rock'
      ) as Phaser.Physics.Arcade.Sprite;
      collider.setVisible(false);
      collider.setSize(28, 14);
      collider.refreshBody();
    });

    // Cave entrance decoration
    const caveX = 20;
    const caveY = 5;
    const cave = this.add.image(
      caveX * TILE_SIZE + TILE_SIZE,
      caveY * TILE_SIZE + TILE_SIZE,
      'cave'
    );
    cave.setDepth(caveY * TILE_SIZE);

    // Cave collider
    const caveCollider = this.boulders.create(
      caveX * TILE_SIZE + TILE_SIZE,
      caveY * TILE_SIZE + TILE_SIZE,
      'rock'
    ) as Phaser.Physics.Arcade.Sprite;
    caveCollider.setVisible(false);
    caveCollider.setSize(32, 32);
    caveCollider.refreshBody();

    // Exit zone (path back to main world)
    this.exitZone = this.add.zone(2 * TILE_SIZE, 17 * TILE_SIZE, TILE_SIZE * 2, TILE_SIZE * 3);

    // Exit sign
    const exitText = this.add.text(2 * TILE_SIZE, 15.5 * TILE_SIZE, 'To World', {
      fontSize: '8px',
      color: '#ffffff',
      backgroundColor: '#2d2d44aa',
      padding: { x: 4, y: 2 },
    });
    exitText.setOrigin(0.5);
    exitText.setDepth(100);

    const arrow = this.add.text(2 * TILE_SIZE, 16 * TILE_SIZE, '◀', {
      fontSize: '10px',
      color: '#4ade80',
    });
    arrow.setOrigin(0.5);
    arrow.setDepth(100);

    this.tweens.add({
      targets: arrow,
      x: arrow.x - 4,
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Path tiles leading to exit
    for (let y = 15; y < 20; y++) {
      for (let x = 0; x < 4; x++) {
        const path = this.add.image(
          x * TILE_SIZE + TILE_SIZE / 2,
          y * TILE_SIZE + TILE_SIZE / 2,
          'mountain_path'
        );
        path.setDepth(-5);
      }
    }
  }

  private createMountainPaths(): void {
    // Winding path through the mountain
    const pathTiles = [
      // Main horizontal path
      ...Array.from({ length: 30 }, (_, i) => ({ x: 5 + i, y: 17 })),
      // Vertical path
      ...Array.from({ length: 10 }, (_, i) => ({ x: 20, y: 10 + i })),
      // Another path
      ...Array.from({ length: 15 }, (_, i) => ({ x: 10 + i, y: 25 })),
    ];

    pathTiles.forEach(pos => {
      const path = this.add.image(
        pos.x * TILE_SIZE + TILE_SIZE / 2,
        pos.y * TILE_SIZE + TILE_SIZE / 2,
        'mountain_path'
      );
      path.setDepth(-8);
    });
  }

  private createPlayer(): void {
    this.player = this.physics.add.sprite(
      5 * TILE_SIZE + TILE_SIZE / 2,
      17 * TILE_SIZE + PLAYER_HEIGHT / 2,
      'player_right'
    );

    this.player.setSize(12, 8);
    this.player.setOffset(2, PLAYER_HEIGHT - 10);
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(this.player.y);

    this.physics.add.collider(this.player, this.boulders);
  }

  private createPets(): void {
    this.pets = this.physics.add.group();

    // Spawn ground mountain pets (goat, fox, bear cub)
    const groundPetTypes = ['GOAT', 'FOX', 'BEAR_CUB'];
    const spawnPositions = [
      { x: 15, y: 12 }, { x: 32, y: 15 }, { x: 12, y: 22 },
      { x: 28, y: 22 }, { x: 38, y: 20 }, { x: 8, y: 28 },
      { x: 25, y: 28 }, { x: 40, y: 28 },
    ];

    spawnPositions.forEach(pos => {
      const petType = groundPetTypes[Math.floor(Math.random() * groundPetTypes.length)];
      const pet = this.pets.create(
        pos.x * TILE_SIZE + TILE_SIZE / 2,
        pos.y * TILE_SIZE + TILE_SIZE / 2,
        `pet_${petType.toLowerCase()}`
      ) as Phaser.Physics.Arcade.Sprite;

      pet.setCollideWorldBounds(true);
      pet.setData('petType', petType);
      pet.setData('wanderTimer', Math.random() * 2000);
      pet.setData('wanderDirection', { x: 0, y: 0 });
      pet.setDepth(pos.y * TILE_SIZE);

      pet.setSize(10, 6);
      pet.setOffset(3, TILE_SIZE - 8);
    });

    this.physics.add.collider(this.pets, this.boulders);
    this.physics.add.collider(this.pets, this.pets);
  }

  private createEagles(): void {
    this.eagles = this.physics.add.group();

    // Eagles fly around the mountain
    const eaglePositions = [
      { x: 12, y: 8 }, { x: 30, y: 10 }, { x: 22, y: 20 },
      { x: 38, y: 15 }, { x: 8, y: 18 },
    ];

    eaglePositions.forEach(pos => {
      const eagle = this.eagles.create(
        pos.x * TILE_SIZE + TILE_SIZE / 2,
        pos.y * TILE_SIZE + TILE_SIZE / 2,
        'pet_eagle'
      ) as Phaser.Physics.Arcade.Sprite;

      eagle.setCollideWorldBounds(true);
      eagle.setData('petType', 'EAGLE');
      eagle.setData('flyTimer', Math.random() * 1000);
      eagle.setData('flyDirection', { x: 0, y: 0 });
      eagle.setData('baseY', pos.y * TILE_SIZE + TILE_SIZE / 2);
      eagle.setDepth(1000); // Eagles fly above everything

      eagle.setSize(10, 8);
      eagle.setOffset(3, 4);

      // Soaring animation (gentle bob)
      this.tweens.add({
        targets: eagle,
        y: eagle.y - 8,
        duration: 1500 + Math.random() * 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      // Wing flapping effect
      this.tweens.add({
        targets: eagle,
        scaleX: 0.85,
        duration: 200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });
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

      this.interactKey.on('down', () => this.tryInteract());
    }
  }

  private createUI(): void {
    this.infoText = this.add.text(16, 16, 'WASD move | SPACE catch', {
      fontSize: '10px',
      color: '#ffffff',
      backgroundColor: '#2d2d44dd',
      padding: { x: 6, y: 3 },
    });
    this.infoText.setScrollFactor(0);
    this.infoText.setDepth(1000);

    this.petCountText = this.add.text(16, 38, this.getPetCountText(), {
      fontSize: '10px',
      color: '#4ade80',
      backgroundColor: '#2d2d44dd',
      padding: { x: 6, y: 3 },
    });
    this.petCountText.setScrollFactor(0);
    this.petCountText.setDepth(1000);

    // Location indicator
    const locationText = this.add.text(
      this.cameras.main.width - 16,
      16,
      'MOUNTAIN',
      {
        fontSize: '10px',
        color: '#9e9e9e',
        backgroundColor: '#2d2d44dd',
        padding: { x: 6, y: 3 },
      }
    );
    locationText.setOrigin(1, 0);
    locationText.setScrollFactor(0);
    locationText.setDepth(1000);

    this.inventoryText = this.add.text(16, 60, this.getInventoryText(), {
      fontSize: '10px', color: '#fbbf24', backgroundColor: '#2d2d44dd', padding: { x: 6, y: 3 },
    });
    this.inventoryText.setScrollFactor(0).setDepth(1000);
  }

  private getInventoryText(): string {
    const tools = InventoryManager.getTools();
    if (tools.length === 0) return 'Tools: None';
    return `Tools: ${tools.map(t => TOOL_INFO[t].name.split(' ')[0]).join(', ')}`;
  }

  private createWindEffect(): void {
    // Create dust/wind particle
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0xbcaaa4, 0.5);
    g.fillRect(0, 0, 3, 1);
    g.generateTexture('dust', 3, 1);
    g.destroy();

    // Horizontal wind particles
    this.windParticles = this.add.particles(0, 0, 'dust', {
      x: -10,
      y: { min: 0, max: this.cameras.main.height },
      lifespan: 3000,
      speedX: { min: 60, max: 100 },
      speedY: { min: -5, max: 5 },
      scale: { min: 0.5, max: 1.5 },
      alpha: { start: 0.5, end: 0 },
      frequency: 200,
    });
    this.windParticles.setScrollFactor(0);
    this.windParticles.setDepth(998);
  }

  private getPetCountText(): string {
    const count = PetManager.getPetCount();
    return `Pets: ${count}`;
  }

  private handlePlayerMovement(): void {
    let velocityX = 0;
    let velocityY = 0;
    let newDirection = this.playerDirection;

    const speed = PLAYER_SPEED;

    if (this.cursors?.left.isDown || this.wasd?.A.isDown) {
      velocityX = -speed;
      newDirection = 'left';
    } else if (this.cursors?.right.isDown || this.wasd?.D.isDown) {
      velocityX = speed;
      newDirection = 'right';
    }

    if (this.cursors?.up.isDown || this.wasd?.W.isDown) {
      velocityY = -speed;
      if (velocityX === 0) newDirection = 'up';
    } else if (this.cursors?.down.isDown || this.wasd?.S.isDown) {
      velocityY = speed;
      if (velocityX === 0) newDirection = 'down';
    }

    if (velocityX !== 0 && velocityY !== 0) {
      velocityX *= 0.707;
      velocityY *= 0.707;
    }

    this.player.setVelocity(velocityX, velocityY);

    if (newDirection !== this.playerDirection) {
      this.playerDirection = newDirection;
      this.player.setTexture(`player_${newDirection}`);
    }
  }

  private handlePetBehavior(): void {
    const petSpeed = 22;

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
        ];

        const newDir = directions[Math.floor(Math.random() * directions.length)];
        sprite.setData('wanderDirection', newDir);
        sprite.setData('wanderTimer', 1500 + Math.random() * 3000);
      } else {
        sprite.setData('wanderTimer', timer);
      }

      const dir = sprite.getData('wanderDirection') as { x: number; y: number };
      sprite.setVelocity(dir.x * petSpeed, dir.y * petSpeed);

      return true;
    });
  }

  private handleEagleBehavior(): void {
    const flySpeed = 40;

    this.eagles.children.each((eagle: Phaser.GameObjects.GameObject) => {
      const sprite = eagle as Phaser.Physics.Arcade.Sprite;
      let timer = sprite.getData('flyTimer') as number;

      timer -= this.game.loop.delta;

      if (timer <= 0) {
        // Eagles soar in circular patterns
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() > 0.2 ? 1 : 0;

        sprite.setData('flyDirection', {
          x: Math.cos(angle) * speed,
          y: Math.sin(angle) * speed * 0.3, // Mostly horizontal movement
        });
        sprite.setData('flyTimer', 800 + Math.random() * 1200);
      } else {
        sprite.setData('flyTimer', timer);
      }

      const dir = sprite.getData('flyDirection') as { x: number; y: number };
      sprite.setVelocityX(dir.x * flySpeed);
      // Don't set Y velocity - let the tween handle vertical bobbing

      // Flip sprite based on movement direction
      if (dir.x > 0.1) {
        sprite.setFlipX(false);
      } else if (dir.x < -0.1) {
        sprite.setFlipX(true);
      }

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

  private tryInteract(): void {
    if (this.isCatching) return;

    let nearestPet: Phaser.Physics.Arcade.Sprite | null = null;
    let nearestDistance = TILE_SIZE * 2.5;

    // Check ground pets
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

    // Check eagles (slightly larger range since they fly)
    this.eagles.children.each((eagle: Phaser.GameObjects.GameObject) => {
      const sprite = eagle as Phaser.Physics.Arcade.Sprite;
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
      this.startCatching(nearestPet);
    }
  }

  private startCatching(pet: Phaser.Physics.Arcade.Sprite): void {
    this.isCatching = true;
    this.targetPet = pet;

    const petType = pet.getData('petType') as string;

    this.catchingUI.start(petType, (success) => {
      if (success && this.targetPet) {
        SoundManager.playSuccess();

        PetManager.catchPet(petType);
        this.petCountText.setText(this.getPetCountText());

        this.tweens.add({
          targets: this.targetPet,
          alpha: 0,
          scale: 0.5,
          duration: 300,
          onComplete: () => {
            this.targetPet?.destroy();
            this.targetPet = null;
          },
        });
      } else {
        SoundManager.playFailure();

        if (this.targetPet) {
          const escapeX = this.targetPet.x + (Math.random() - 0.5) * 100;
          const escapeY = this.targetPet.y + (Math.random() - 0.5) * 100;

          this.tweens.add({
            targets: this.targetPet,
            x: escapeX,
            y: escapeY,
            duration: 300,
            ease: 'Quad.easeOut',
          });
        }
        this.targetPet = null;
      }

      this.isCatching = false;
    });
  }

  private checkExitZone(): void {
    if (this.isTransitioning) return;

    const playerBounds = this.player.getBounds();
    const zoneBounds = this.exitZone.getBounds();

    if (Phaser.Geom.Rectangle.Overlaps(playerBounds, zoneBounds)) {
      this.goToWorld();
    }
  }

  private goToWorld(): void {
    if (this.isCatching || this.isTransitioning) return;
    this.isTransitioning = true;

    SoundManager.playClick();

    this.cameras.main.fadeOut(300, 0, 0, 0);

    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(SCENES.WORLD);
    });
  }

  private createCollectibles(): void {
    this.collectibles = this.physics.add.group();

    // TREATS spawns in mountains - good for luring bear cubs
    if (!InventoryManager.hasTool('TREATS')) {
      this.createCollectibleItem(25, 15, 'TREATS');
    }

    this.physics.add.overlap(this.player, this.collectibles, (_, collectible) => {
      this.collectItem(collectible as Phaser.Physics.Arcade.Sprite);
    });
  }

  private createCollectibleItem(tileX: number, tileY: number, toolType: ToolType): void {
    const x = tileX * TILE_SIZE + TILE_SIZE / 2;
    const y = tileY * TILE_SIZE + TILE_SIZE / 2;

    const item = this.collectibles.create(x, y, `tool_${toolType.toLowerCase()}`) as Phaser.Physics.Arcade.Sprite;
    item.setData('toolType', toolType);
    item.setDepth(y + 10);

    // Bobbing animation
    this.tweens.add({
      targets: item,
      y: y - 4,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Sparkle effect
    const sparkle = this.add.sprite(x, y, 'collectible_sparkle');
    sparkle.setAlpha(0.7);
    sparkle.setDepth(y + 11);
    this.tweens.add({
      targets: sparkle,
      alpha: 0.3,
      scale: 1.3,
      duration: 600,
      yoyo: true,
      repeat: -1,
    });
    item.setData('sparkle', sparkle);
  }

  private collectItem(item: Phaser.Physics.Arcade.Sprite): void {
    const toolType = item.getData('toolType') as ToolType;
    const sparkle = item.getData('sparkle') as Phaser.GameObjects.Sprite;

    if (InventoryManager.addTool(toolType)) {
      SoundManager.playSuccess();
      this.showCollectMessage(toolType);
      this.updateInventoryUI();

      // Remove sparkle
      if (sparkle) sparkle.destroy();

      // Collect animation
      this.tweens.add({
        targets: item,
        y: item.y - 30,
        alpha: 0,
        scale: 1.5,
        duration: 400,
        onComplete: () => item.destroy(),
      });
    }
  }

  private showCollectMessage(toolType: ToolType): void {
    const info = TOOL_INFO[toolType];
    const msg = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 - 30,
      `Found ${info.name}!\n${info.description}`,
      { fontSize: '12px', color: '#ffffff', backgroundColor: '#2d2d44ee', padding: { x: 10, y: 6 }, align: 'center' }
    );
    msg.setOrigin(0.5).setScrollFactor(0).setDepth(2000);

    this.tweens.add({
      targets: msg,
      alpha: 0,
      y: msg.y - 20,
      delay: 2000,
      duration: 500,
      onComplete: () => msg.destroy(),
    });
  }

  private updateInventoryUI(): void {
    this.inventoryText.setText(this.getInventoryText());
  }
}
