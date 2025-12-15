import Phaser from 'phaser';

/**
 * Makes a pet flee away from the player after a failed catch attempt.
 * @param scene - The current Phaser scene
 * @param pet - The pet sprite to flee
 * @param playerX - Player's X position
 * @param playerY - Player's Y position
 * @param fleeDistance - Distance to flee (default 150px)
 * @param duration - Animation duration in ms (default 400)
 */
export function fleePetFromPlayer(
  scene: Phaser.Scene,
  pet: Phaser.Physics.Arcade.Sprite,
  playerX: number,
  playerY: number,
  fleeDistance: number = 300,
  duration: number = 400
): void {
  // Calculate direction away from player
  const dx = pet.x - playerX;
  const dy = pet.y - playerY;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;

  // Normalize and scale by flee distance
  const escapeX = pet.x + (dx / dist) * fleeDistance;
  const escapeY = pet.y + (dy / dist) * fleeDistance;

  // Animate the flee
  scene.tweens.add({
    targets: pet,
    x: escapeX,
    y: escapeY,
    duration: duration,
    ease: 'Quad.easeOut',
  });
}

/**
 * Shows a catch result message that animates in and fades out.
 * @param scene - The current Phaser scene
 * @param text - Message text to display
 * @param color - Text color (hex string like '#4ade80')
 */
export function showCatchMessage(
  scene: Phaser.Scene,
  text: string,
  color: string
): void {
  const message = scene.add.text(
    scene.cameras.main.width / 2,
    scene.cameras.main.height - 60,
    text,
    {
      fontSize: '14px',
      color: color,
      backgroundColor: '#2d2d44ee',
      padding: { x: 12, y: 6 },
    }
  );
  message.setOrigin(0.5);
  message.setScrollFactor(0);
  message.setDepth(2000);

  // Animate in
  message.setAlpha(0);
  message.setY(message.y + 20);

  scene.tweens.add({
    targets: message,
    alpha: 1,
    y: message.y - 20,
    duration: 200,
    ease: 'Back.easeOut',
  });

  // Fade out and destroy
  scene.tweens.add({
    targets: message,
    alpha: 0,
    y: message.y - 40,
    duration: 400,
    delay: 1500,
    ease: 'Quad.easeIn',
    onComplete: () => message.destroy(),
  });
}
